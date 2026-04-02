"""Core agent service — factory, provider resolution, session management."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from pydantic_ai import Agent
from pydantic_ai.messages import ModelMessagesTypeAdapter
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.context_builder import build_system_prompt
from app.models.agent_session import AgentMessage, AgentSession
from app.skills.context import SkillContext
from app.skills.registry import SkillRegistry

logger = logging.getLogger(__name__)


@dataclass
class AgentDeps:
    user_id: str
    project_id: str
    canvas_id: str | None
    session_id: str
    db: AsyncSession
    registry: SkillRegistry
    skill_context: SkillContext


async def resolve_pydantic_model(
    provider: str,
    model_name: str,
    *,
    team_id: str | None = None,
    user_id: str | None = None,
):
    """Resolve a PydanticAI model via DB-backed ProviderManager credentials."""
    from app.services.ai.provider_manager import get_provider_manager

    pm = get_provider_manager()
    api_key, _owner, _key_id = await pm._resolve_key(
        provider, team_id, user_id, db=None,
    )

    if provider == "gemini":
        from pydantic_ai.models.google import GoogleModel
        from pydantic_ai.providers.google import GoogleProvider
        return GoogleModel(model_name, provider=GoogleProvider(api_key=api_key))

    if provider == "openai":
        from pydantic_ai.models.openai import OpenAIModel
        from pydantic_ai.providers.openai import OpenAIProvider
        return OpenAIModel(model_name, provider=OpenAIProvider(api_key=api_key))

    if provider == "deepseek":
        from pydantic_ai.models.openai import OpenAIModel
        from pydantic_ai.providers.openai import OpenAIProvider
        return OpenAIModel(
            model_name,
            provider=OpenAIProvider(api_key=api_key, base_url="https://api.deepseek.com"),
        )

    raise NotImplementedError(f"Provider '{provider}' is not supported yet")


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
    ) -> Agent[AgentDeps, str]:
        model = await resolve_pydantic_model(
            provider, model_name, team_id=team_id, user_id=user_id,
        )
        system_prompt = build_system_prompt(
            project_name=project_name,
            canvas_name=canvas_name,
            canvas_summary=canvas_summary,
        )
        return Agent(
            model,
            deps_type=AgentDeps,
            instructions=system_prompt,
            retries=1,
        )

    async def create_session(
        self,
        db: AsyncSession,
        user_id: str,
        project_id: str,
        canvas_id: str | None = None,
        title: str | None = None,
        model_name: str = "gemini-2.5-flash",
        provider: str = "gemini",
    ) -> AgentSession:
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
    ) -> AgentSession | None:
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
    ) -> list[AgentSession]:
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
        """Load PydanticAI message history from the most recent snapshot.

        Finds the last AgentMessage with pydantic_ai_messages_json and
        deserializes via ModelMessagesTypeAdapter for roundtrip fidelity.
        """
        stmt = (
            select(AgentMessage)
            .where(
                AgentMessage.session_id == session_id,
                AgentMessage.pydantic_ai_messages_json.isnot(None),
            )
            .order_by(desc(AgentMessage.created_at))
            .limit(1)
        )
        result = await db.execute(stmt)
        last_msg = result.scalar_one_or_none()

        if last_msg is None or not last_msg.pydantic_ai_messages_json:
            return []

        try:
            messages = ModelMessagesTypeAdapter.validate_json(
                last_msg.pydantic_ai_messages_json
            )
            if len(messages) > max_messages:
                messages = messages[-max_messages:]
            return messages
        except Exception:
            logger.exception("Failed to deserialize PydanticAI messages for session %s", session_id)
            return []

    async def save_messages(
        self,
        db: AsyncSession,
        session_id: str,
        pydantic_ai_messages_json: bytes | str,
        user_content: str,
        assistant_content: str,
        tool_calls: list[dict[str, Any]] | None = None,
        tool_results: list[dict[str, Any]] | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
    ) -> None:
        """Persist user, assistant, tool-call, and tool-result messages."""
        if isinstance(pydantic_ai_messages_json, bytes):
            pydantic_ai_messages_json = pydantic_ai_messages_json.decode("utf-8")

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
            pydantic_ai_messages_json=pydantic_ai_messages_json,
            output_tokens=output_tokens,
        )
        db.add(assistant_msg)

        if tool_calls:
            tc_msg = AgentMessage(
                session_id=session_id,
                role="tool_call",
                tool_calls_json=tool_calls,
            )
            db.add(tc_msg)

        if tool_results:
            tr_msg = AgentMessage(
                session_id=session_id,
                role="tool_result",
                tool_results_json=tool_results,
            )
            db.add(tr_msg)

        session = await db.get(AgentSession, session_id)
        if session:
            session.message_count = (session.message_count or 0) + 2
            session.total_tokens = (session.total_tokens or 0) + input_tokens + output_tokens

        await db.commit()
