"""Agent API endpoints — SSE streaming chat + session CRUD."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.agent.agent_service import AgentDeps, AgentService
from app.agent.skill_toolset import SkillToolset
from app.agent.sse_protocol import (
    sse_done,
    sse_error,
    sse_heartbeat,
    sse_thinking,
    sse_token,
    sse_tool_call,
    sse_tool_result,
)
from app.core.deps import get_current_user, get_db, resolve_project_access
from app.models.agent_session import AgentMessage, AgentSession
from app.schemas.agent import (
    ChatRequest,
    MessageListResponse,
    SessionCreateRequest,
    SessionListResponse,
    SessionResponse,
)
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

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
    await resolve_project_access(body.project_id, user, db)
    session = await agent_service.create_session(
        db,
        user.id,
        body.project_id,
        body.canvas_id,
        body.title,
        body.model_name,
        body.provider,
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
# SSE Chat
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
        heartbeat_task: asyncio.Task | None = None
        heartbeat_stop = asyncio.Event()

        async def _heartbeat():
            while not heartbeat_stop.is_set():
                await asyncio.sleep(15)
                if not heartbeat_stop.is_set():
                    yield sse_heartbeat()

        try:
            yield sse_thinking("analyzing", request_id=request_id)

            history = await agent_service.load_message_history(db, session.id)

            context = SkillContext(
                user_id=user.id,
                project_id=session.project_id,
                canvas_id=session.canvas_id,
                agent_session_id=session.id,
                trigger_source="agent",
            )
            toolset = SkillToolset(registry=skill_registry, context=context)

            provider = body.provider or session.provider
            model_name = body.model_name or session.model_name
            agent = agent_service.create_agent(provider, model_name)

            deps = AgentDeps(
                user_id=user.id,
                project_id=session.project_id,
                canvas_id=session.canvas_id,
                session_id=session.id,
                db=db,
                registry=skill_registry,
                skill_context=context,
            )

            from pydantic_ai import Agent as AgentCls

            yield sse_thinking("processing", request_id=request_id)

            async with agent.iter(
                user_prompt=body.message,
                message_history=history,
                deps=deps,
                toolsets=[toolset],
            ) as run:
                async for node in run:
                    if AgentCls.is_model_request_node(node):
                        async with node.stream(run.ctx) as stream:
                            async for text in stream.stream_text(delta=True):
                                collected_text += text
                                yield sse_token(text, request_id=request_id)

                            resp = stream.response
                            if resp:
                                for tc in resp.tool_calls:
                                    tc_args = tc.args_as_dict()
                                    tc_id = tc.id or ""
                                    tool_calls_log.append(
                                        {"tool": tc.tool_name, "args": tc_args, "call_id": tc_id}
                                    )
                                    yield sse_tool_call(
                                        tc.tool_name, tc_args, tc_id, request_id=request_id
                                    )

                    elif AgentCls.is_call_tools_node(node):
                        yield sse_thinking("executing tools", request_id=request_id)

                run_result = run.result
                usage_info = run_result.usage()
                usage = {
                    "input_tokens": usage_info.input_tokens or 0,
                    "output_tokens": usage_info.output_tokens or 0,
                }

                final_output = run_result.output if run_result else collected_text
                yield sse_done(
                    final_output or collected_text, usage, request_id=request_id
                )

                messages_json = run_result.all_messages_json()
                await agent_service.save_messages(
                    db,
                    session.id,
                    messages_json,
                    user_content=body.message,
                    assistant_content=final_output or collected_text,
                    tool_calls=tool_calls_log or None,
                    tool_results=tool_results_log or None,
                    input_tokens=usage.get("input_tokens", 0),
                    output_tokens=usage.get("output_tokens", 0),
                )

        except asyncio.CancelledError:
            toolset.cancel()
            logger.info("Client disconnected from session %s", session_id)
            try:
                await agent_service.save_messages(
                    db,
                    session.id,
                    b"[]",
                    user_content=body.message,
                    assistant_content=collected_text,
                )
            except Exception:
                logger.exception("Failed to save partial messages on disconnect")
            return

        except Exception as e:
            logger.exception("Chat error in session %s", session_id)
            yield sse_error(str(e), "INTERNAL", request_id=request_id)
            try:
                await agent_service.save_messages(
                    db,
                    session.id,
                    b"[]",
                    user_content=body.message,
                    assistant_content=collected_text,
                )
            except Exception:
                logger.exception("Failed to save partial messages on error")

        finally:
            if heartbeat_task and not heartbeat_task.done():
                heartbeat_stop.set()
                heartbeat_task.cancel()

    return EventSourceResponse(
        event_generator(), media_type="text/event-stream", ping=15
    )
