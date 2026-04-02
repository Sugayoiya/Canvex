"""Core agent service — LangChain/LangGraph factory, session management."""
from __future__ import annotations

import json
import logging
import threading
from typing import Any

from langchain_core.messages import messages_to_dict, messages_from_dict, HumanMessage, AIMessage
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.context_builder import build_system_prompt
from app.agent.skill_loader import SkillLoader

logger = logging.getLogger(__name__)

_skill_loader: SkillLoader | None = None
_loader_init_lock = threading.Lock()


def _get_skill_loader() -> SkillLoader:
    """Thread-safe singleton SkillLoader with mtime-based hot-reload."""
    global _skill_loader
    if _skill_loader is None:
        with _loader_init_lock:
            if _skill_loader is None:
                sl = SkillLoader()
                sl.load_metadata()
                _skill_loader = sl
    else:
        _skill_loader.reload_if_changed()
    return _skill_loader


class AgentService:
    """Agent factory, provider resolution, session management."""

    async def create_agent(
        self,
        provider: str,
        model_name: str,
        project_name: str | None = None,
        canvas_name: str | None = None,
        canvas_summary: dict | None = None,
        *,
        team_id: str | None = None,
        user_id: str | None = None,
        has_canvas: bool = False,
        has_episode: bool = False,
    ):
        """Create a LangChain agent with context-gated tools.

        Uses langchain.agents.create_agent (NOT deprecated create_react_agent).
        Returns a CompiledStateGraph supporting astream_events / ainvoke.
        """
        from app.services.ai.provider_manager import get_provider_manager
        from app.agent.tools import get_tools_for_context
        from langchain.agents import create_agent

        pm = get_provider_manager()
        llm = await pm.resolve_langchain_llm(
            provider, model_name, team_id=team_id, user_id=user_id,
        )
        tools = get_tools_for_context(has_canvas=has_canvas, has_episode=has_episode)
        skill_loader = _get_skill_loader()
        system_prompt = build_system_prompt(
            skill_loader=skill_loader,
            project_name=project_name,
            canvas_name=canvas_name,
            canvas_summary=canvas_summary,
        )
        return create_agent(llm, tools, system_prompt=system_prompt)

    async def create_session(
        self,
        db: AsyncSession,
        user_id: str,
        project_id: str,
        canvas_id: str | None = None,
        title: str | None = None,
        model_name: str = "gemini-2.5-flash",
        provider: str = "gemini",
    ):
        from app.models.agent_session import AgentSession
        session = AgentSession(
            user_id=user_id,
            project_id=project_id,
            canvas_id=canvas_id,
            title=title,
            model_name=model_name,
            provider=provider,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    async def get_session(
        self,
        db: AsyncSession,
        session_id: str,
        user_id: str,
    ):
        from app.models.agent_session import AgentSession
        stmt = select(AgentSession).where(
            AgentSession.id == session_id,
            AgentSession.user_id == user_id,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_sessions(
        self,
        db: AsyncSession,
        user_id: str,
        project_id: str,
        canvas_id: str | None = None,
        limit: int = 50,
    ):
        from app.models.agent_session import AgentSession
        stmt = (
            select(AgentSession)
            .where(
                AgentSession.user_id == user_id,
                AgentSession.project_id == project_id,
            )
            .order_by(desc(AgentSession.updated_at))
            .limit(limit)
        )
        if canvas_id is not None:
            stmt = stmt.where(AgentSession.canvas_id == canvas_id)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def delete_session(
        self,
        db: AsyncSession,
        session_id: str,
        user_id: str,
    ) -> bool:
        session = await self.get_session(db, session_id, user_id)
        if session is None:
            return False
        await db.delete(session)
        await db.commit()
        return True

    async def load_message_history(
        self,
        db: AsyncSession,
        session_id: str,
        max_messages: int = 20,
    ) -> list:
        """Load LangChain message history from the most recent snapshot.

        Falls back to empty for legacy PydanticAI sessions (no langchain_messages_json).
        """
        from app.models.agent_session import AgentMessage
        stmt = (
            select(AgentMessage)
            .where(
                AgentMessage.session_id == session_id,
                AgentMessage.langchain_messages_json.isnot(None),
            )
            .order_by(desc(AgentMessage.created_at))
            .limit(1)
        )
        result = await db.execute(stmt)
        last_msg = result.scalar_one_or_none()

        if last_msg is None or not last_msg.langchain_messages_json:
            return []

        try:
            messages = messages_from_dict(json.loads(last_msg.langchain_messages_json))
            return messages[-max_messages:] if len(messages) > max_messages else messages
        except Exception:
            logger.exception("Failed to deserialize LangChain messages for session %s", session_id)
            return []

    async def save_messages(
        self,
        db: AsyncSession,
        session_id: str,
        langchain_messages: list,
        user_content: str,
        assistant_content: str,
        tool_calls: list[dict[str, Any]] | None = None,
        tool_results: list[dict[str, Any]] | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
    ) -> None:
        """Persist messages in LangChain format (messages_to_dict serialization)."""
        from app.models.agent_session import AgentMessage, AgentSession
        langchain_json = json.dumps(messages_to_dict(langchain_messages), ensure_ascii=False)

        user_msg = AgentMessage(
            session_id=session_id,
            role="user",
            content=user_content,
            input_tokens=input_tokens,
        )
        db.add(user_msg)

        assistant_msg = AgentMessage(
            session_id=session_id,
            role="assistant",
            content=assistant_content,
            langchain_messages_json=langchain_json,
            output_tokens=output_tokens,
        )
        db.add(assistant_msg)

        if tool_calls:
            db.add(AgentMessage(
                session_id=session_id,
                role="tool_call",
                tool_calls_json=json.dumps(tool_calls, ensure_ascii=False),
            ))
        if tool_results:
            db.add(AgentMessage(
                session_id=session_id,
                role="tool_result",
                tool_results_json=json.dumps(tool_results, ensure_ascii=False),
            ))

        session = await db.get(AgentSession, session_id)
        if session:
            session.message_count = (session.message_count or 0) + 2
            session.total_tokens = (session.total_tokens or 0) + input_tokens + output_tokens

        await db.commit()
