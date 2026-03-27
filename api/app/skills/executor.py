from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Any

from app.skills.context import SkillContext
from app.skills.descriptor import SkillResult
from app.skills.registry import SkillRegistry

logger = logging.getLogger(__name__)


class SkillExecutor:
    """Handles Skill execution lifecycle including logging and quota checks."""

    def __init__(self, registry: SkillRegistry) -> None:
        self.registry = registry

    async def invoke(
        self,
        name: str,
        params: dict[str, Any],
        context: SkillContext,
    ) -> SkillResult:
        descriptor = self.registry.get_descriptor(name)
        start = time.monotonic()

        # Log the skill invocation start
        log_id = await self._log_start(name, descriptor.category.value, params, context)

        try:
            result = await self.registry.invoke(name, params, context)
            duration_ms = int((time.monotonic() - start) * 1000)

            if result.status in ("completed", "failed"):
                await self._log_finish(log_id, result, duration_ms)
            # For "running" (async), completion log is written by the Celery task

            return result
        except Exception as e:
            duration_ms = int((time.monotonic() - start) * 1000)
            result = SkillResult.failed(message=str(e))
            await self._log_finish(log_id, result, duration_ms)
            raise

    async def _log_start(
        self,
        skill_name: str,
        category: str,
        params: dict[str, Any],
        ctx: SkillContext,
    ) -> str:
        from app.core.database import AsyncSessionLocal
        from app.models.skill_execution_log import SkillExecutionLog

        input_summary = json.dumps(params, ensure_ascii=False, default=str)[:2000]
        log = SkillExecutionLog(
            trace_id=ctx.trace_id,
            skill_name=skill_name,
            skill_category=category,
            user_id=ctx.user_id,
            team_id=ctx.team_id,
            project_id=ctx.project_id,
            episode_id=ctx.episode_id,
            canvas_id=ctx.canvas_id,
            node_id=ctx.node_id,
            agent_session_id=ctx.agent_session_id,
            trigger_source=ctx.trigger_source,
            status="running",
            input_summary=input_summary,
            queued_at=datetime.utcnow(),
            started_at=datetime.utcnow(),
        )

        try:
            async with AsyncSessionLocal() as session:
                session.add(log)
                await session.commit()
                return log.id
        except Exception:
            logger.exception("Failed to write SkillExecutionLog start")
            return ""

    async def _log_finish(
        self,
        log_id: str,
        result: SkillResult,
        duration_ms: int,
    ) -> None:
        if not log_id:
            return

        from sqlalchemy import select
        from app.core.database import AsyncSessionLocal
        from app.models.skill_execution_log import SkillExecutionLog

        try:
            async with AsyncSessionLocal() as session:
                stmt = select(SkillExecutionLog).where(SkillExecutionLog.id == log_id)
                row = (await session.execute(stmt)).scalar_one_or_none()
                if row is None:
                    return
                row.status = result.status
                row.completed_at = datetime.utcnow()
                row.duration_ms = duration_ms
                if result.message:
                    row.output_summary = result.message[:2000]
                if result.status == "failed":
                    row.error_message = result.message[:2000]
                    row.error_code = result.data.get("error_code")
                await session.commit()
        except Exception:
            logger.exception("Failed to write SkillExecutionLog finish")
