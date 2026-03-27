import asyncio
import json
import logging
import time
from datetime import datetime

import structlog

from app.celery_app import celery_app
from app.skills.context import SkillContext
from app.skills.descriptor import SkillResult

logger = logging.getLogger(__name__)


def _get_or_create_event_loop():
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError
        return loop
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop


@celery_app.task(bind=True, acks_late=True, max_retries=2, name="app.tasks.skill_task.run_skill_task")
def run_skill_task(self, skill_name: str, params: dict, context_dict: dict):
    """Generic Celery task that executes any registered Skill."""
    ctx = SkillContext.from_dict(context_dict)

    structlog.contextvars.bind_contextvars(
        trace_id=ctx.trace_id,
        user_id=ctx.user_id,
        team_id=ctx.team_id,
        project_id=ctx.project_id,
        celery_task_id=self.request.id,
        skill_name=skill_name,
    )

    logger.info("Celery worker executing skill: %s (trace=%s)", skill_name, ctx.trace_id)

    from app.skills.registry import skill_registry

    try:
        descriptor, handler = skill_registry.get(skill_name)
    except KeyError:
        logger.error("Skill '%s' not found in worker registry", skill_name)
        return SkillResult.failed(f"Skill '{skill_name}' not found").to_dict()

    start = time.monotonic()
    loop = _get_or_create_event_loop()

    try:
        result = loop.run_until_complete(handler(params, ctx))
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.info("Skill '%s' completed in %dms", skill_name, duration_ms)

        _update_log(self.request.id, result, duration_ms, ctx)
        return result.to_dict()
    except Exception as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.exception("Skill '%s' failed after %dms", skill_name, duration_ms)
        error_result = SkillResult.failed(str(exc))
        _update_log(self.request.id, error_result, duration_ms, ctx)
        raise self.retry(exc=exc, countdown=min(60, 2 ** self.request.retries * 10))


def _update_log(celery_task_id: str, result: SkillResult, duration_ms: int, ctx: SkillContext):
    """Update the SkillExecutionLog from within the worker."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.skill_execution_log import SkillExecutionLog
        from sqlalchemy import select

        loop = _get_or_create_event_loop()

        async def _do_update():
            async with AsyncSessionLocal() as session:
                stmt = select(SkillExecutionLog).where(
                    SkillExecutionLog.celery_task_id == celery_task_id
                )
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
                await session.commit()

        loop.run_until_complete(_do_update())
    except Exception:
        logger.exception("Failed to update SkillExecutionLog from worker")
