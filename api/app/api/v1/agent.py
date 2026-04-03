"""Agent API endpoints — LangGraph SSE streaming chat + session CRUD."""
from __future__ import annotations

import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from langchain_core.messages import HumanMessage, AIMessage
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sse_starlette.sse import EventSourceResponse

from app.agent.agent_service import AgentService
from app.agent.sse_protocol import (
    sse_done,
    sse_error,
    sse_thinking,
    sse_token,
    sse_tool_call,
    sse_tool_result,
)
from app.agent.tool_context import set_tool_context, clear_tool_context
from app.core.deps import get_current_user, get_db, resolve_project_access
from app.models.agent_session import AgentMessage, AgentSession
from app.models.canvas import Canvas
from app.models.project import Project
from app.schemas.agent import (
    ChatRequest,
    MessageListResponse,
    SessionCreateRequest,
    SessionListResponse,
    SessionResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agent", tags=["agent"])
agent_service = AgentService()


async def get_owned_session(
    session_id: str,
    user,
    db: AsyncSession,
) -> AgentSession:
    """Validate session ownership (user_id match) and project access."""
    session = await agent_service.get_session(db, session_id, user.id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    await resolve_project_access(session.project_id, user, db)
    return session


# ---------------------------------------------------------------------------
# Session CRUD
# ---------------------------------------------------------------------------


@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    body: SessionCreateRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.ai.provider_manager import resolve_model_for_task, resolve_provider_for_model

    await resolve_project_access(body.project_id, user, db)

    resolved_model = await resolve_model_for_task(
        body.model_name, "llm",
        project_id=body.project_id,
        user_id=user.id,
        team_id=getattr(user, "current_team_id", None),
        db=db,
    )
    resolved_provider, _ = await resolve_provider_for_model(resolved_model, db=db)

    session = await agent_service.create_session(
        db,
        user.id,
        body.project_id,
        body.canvas_id,
        body.title,
        resolved_model,
        resolved_provider,
    )
    return session


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    project_id: str = Query(...),
    canvas_id: str | None = Query(None),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project_access(project_id, user, db)
    sessions = await agent_service.list_sessions(db, user.id, project_id, canvas_id)
    return SessionListResponse(sessions=sessions, total=len(sessions))


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_owned_session(session_id, user, db)


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_owned_session(session_id, user, db)
    deleted = await agent_service.delete_session(db, session_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


@router.get("/sessions/{session_id}/messages", response_model=MessageListResponse)
async def get_messages(
    session_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await get_owned_session(session_id, user, db)
    count_stmt = select(func.count(AgentMessage.id)).where(
        AgentMessage.session_id == session.id
    )
    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = (
        select(AgentMessage)
        .where(AgentMessage.session_id == session.id)
        .order_by(AgentMessage.created_at)
        .offset(offset)
        .limit(limit)
    )
    messages = list((await db.execute(stmt)).scalars().all())
    return MessageListResponse(messages=messages, total=total)


# ---------------------------------------------------------------------------
# SSE Chat — LangGraph streaming with fallback matrix
# ---------------------------------------------------------------------------


@router.post("/chat/{session_id}")
async def chat(
    session_id: str,
    body: ChatRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await get_owned_session(session_id, user, db)
    request_id = str(uuid.uuid4())

    async def event_generator():
        collected_text = ""
        tool_calls_log: list[dict] = []
        tool_results_log: list[dict] = []

        try:
            yield sse_thinking("analyzing", request_id=request_id)

            set_tool_context(
                project_id=session.project_id,
                user_id=user.id,
                team_id=getattr(user, "current_team_id", None),
                canvas_id=session.canvas_id,
            )

            history = await agent_service.load_message_history(db, session.id)

            project_name, canvas_name, canvas_summary = None, None, None
            try:
                project = await db.get(Project, session.project_id)
                project_name = project.name if project else None
                if session.canvas_id:
                    canvas_stmt = (
                        select(Canvas)
                        .options(selectinload(Canvas.nodes))
                        .where(Canvas.id == session.canvas_id)
                    )
                    canvas_obj = (await db.execute(canvas_stmt)).scalar_one_or_none()
                    if canvas_obj:
                        canvas_name = canvas_obj.name
                        node_types: dict[str, int] = {}
                        for n in canvas_obj.nodes:
                            node_types[n.node_type] = node_types.get(n.node_type, 0) + 1
                        canvas_summary = {"node_counts": node_types, "total_nodes": len(canvas_obj.nodes)}
            except Exception:
                logger.warning("Failed to load context for session %s", session_id)

            from app.services.ai.provider_manager import resolve_model_for_task, resolve_provider_for_model

            requested_model = body.model_name or session.model_name
            resolved_model = await resolve_model_for_task(
                requested_model, "llm",
                project_id=session.project_id,
                user_id=user.id,
                team_id=getattr(user, "current_team_id", None),
                db=db,
            )
            resolved_provider, _ = await resolve_provider_for_model(resolved_model, db=db)

            agent = await agent_service.create_agent(
                resolved_provider, resolved_model,
                project_name=project_name,
                canvas_name=canvas_name,
                canvas_summary=canvas_summary,
                team_id=getattr(user, "current_team_id", None),
                user_id=user.id,
                has_canvas=bool(session.canvas_id),
                has_episode=True,
            )

            yield sse_thinking("processing", request_id=request_id)

            input_messages = [*history, HumanMessage(content=body.message)]
            config = {"configurable": {"thread_id": session_id}}

            # --- Streaming fallback matrix ---
            # Priority 1: astream_events v2 (token-level)
            # Priority 3 (terminal): ainvoke (no streaming)
            streamed = False
            try:
                async for event in agent.astream_events(
                    {"messages": input_messages}, version="v2", config=config,
                ):
                    streamed = True
                    kind = event["event"]
                    if kind == "on_chat_model_stream":
                        chunk = event["data"]["chunk"]
                        if hasattr(chunk, "content") and chunk.content:
                            raw = chunk.content
                            if isinstance(raw, list):
                                raw = "".join(
                                    part.get("text", "") if isinstance(part, dict) else str(part)
                                    for part in raw
                                )
                            if raw:
                                collected_text += raw
                                yield sse_token(raw, request_id=request_id)
                    elif kind == "on_tool_start":
                        tool_name = event["name"]
                        tool_input = event["data"].get("input", {})
                        run_id = str(event.get("run_id", ""))
                        tool_calls_log.append({"tool": tool_name, "args": tool_input, "call_id": run_id})
                        yield sse_tool_call(tool_name, tool_input, run_id, request_id=request_id)
                    elif kind == "on_tool_end":
                        tool_name = event["name"]
                        output = str(event["data"].get("output", ""))
                        run_id = str(event.get("run_id", ""))
                        summary = output[:200] if len(output) > 200 else output
                        tool_results_log.append({"tool": tool_name, "call_id": run_id, "success": True})
                        yield sse_tool_result(tool_name, summary, run_id, success=True, request_id=request_id)
            except Exception as stream_err:
                if not streamed:
                    # Terminal fallback — ainvoke (no streaming)
                    logger.warning("Streaming failed, falling back to ainvoke: %s", stream_err)
                    result = await agent.ainvoke({"messages": input_messages}, config=config)
                    final_msg = result["messages"][-1]
                    collected_text = final_msg.content if hasattr(final_msg, "content") else str(final_msg)
                    yield sse_token(collected_text, request_id=request_id)
                else:
                    logger.warning("Streaming error mid-stream: %s", stream_err)

            usage = {"input_tokens": 0, "output_tokens": 0}
            yield sse_done(collected_text, usage, request_id=request_id, extra={"used_model": resolved_model})

            final_messages = [*input_messages, AIMessage(content=collected_text)]
            await agent_service.save_messages(
                db, session.id, final_messages,
                user_content=body.message, assistant_content=collected_text,
                tool_calls=tool_calls_log or None, tool_results=tool_results_log or None,
            )

        except asyncio.CancelledError:
            logger.info("Client disconnected from session %s", session_id)
        except Exception as e:
            logger.exception("Chat error in session %s", session_id)
            yield sse_error(str(e), "INTERNAL", request_id=request_id)
        finally:
            clear_tool_context()

    return EventSourceResponse(
        event_generator(), media_type="text/event-stream", ping=15
    )


# ---------------------------------------------------------------------------
# Skills listing
# ---------------------------------------------------------------------------


@router.get("/skills")
async def list_skills(user=Depends(get_current_user)):
    from app.agent.agent_service import _get_skill_loader
    loader = _get_skill_loader()
    return {"skills": loader.list_skills()}
