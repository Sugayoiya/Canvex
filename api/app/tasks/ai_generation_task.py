import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone

import structlog

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


def _get_or_create_event_loop():
    """Reuse existing or create new event loop (Celery worker runs in sync thread)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError
        return loop
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop


def _create_execution_log(loop, *, skill_name, user_id, team_id, project_id, celery_task_id, input_summary):
    """Create SkillExecutionLog row before execution (per D-21)."""
    async def _do():
        from app.core.database import AsyncSessionLocal
        from app.models.skill_execution_log import SkillExecutionLog
        async with AsyncSessionLocal() as db:
            log_entry = SkillExecutionLog(
                trace_id=str(uuid.uuid4()),
                skill_name=skill_name,
                skill_category="VISUAL" if "image" in skill_name else "VIDEO",
                user_id=user_id,
                team_id=team_id,
                project_id=project_id,
                celery_task_id=celery_task_id,
                trigger_source="agent_tool",
                status="started",
                started_at=datetime.now(timezone.utc),
                input_summary=input_summary[:2000] if input_summary else None,
            )
            db.add(log_entry)
            await db.commit()
            await db.refresh(log_entry)
            return log_entry.id
    try:
        return loop.run_until_complete(_do())
    except Exception:
        logger.exception("Failed to create execution log")
        return None


def _update_execution_log(loop, log_id, *, status, duration_ms, output_summary=None, error_message=None):
    """Update SkillExecutionLog after execution."""
    if not log_id:
        return
    async def _do():
        from app.core.database import AsyncSessionLocal
        from app.models.skill_execution_log import SkillExecutionLog
        async with AsyncSessionLocal() as db:
            row = await db.get(SkillExecutionLog, log_id)
            if row:
                row.status = status
                row.completed_at = datetime.now(timezone.utc)
                row.duration_ms = duration_ms
                if output_summary:
                    row.output_summary = output_summary[:2000]
                if error_message:
                    row.error_message = error_message[:2000]
                await db.commit()
    try:
        loop.run_until_complete(_do())
    except Exception:
        logger.exception("Failed to update execution log %s", log_id)


@celery_app.task(
    bind=True,
    acks_late=True,
    max_retries=2,
    name="app.tasks.ai_generation_task.generate_image_task",
)
def generate_image_task(self, *, prompt, aspect_ratio, model, team_id, user_id, project_id=None):
    """Celery task for image generation. Calls ProviderManager + ImageProvider."""
    structlog.contextvars.bind_contextvars(
        celery_task_id=self.request.id, skill_name="generate_image",
        user_id=user_id, team_id=team_id,
    )
    loop = _get_or_create_event_loop()
    log_id = _create_execution_log(
        loop, skill_name="generate_image", user_id=user_id,
        team_id=team_id, project_id=project_id,
        celery_task_id=self.request.id,
        input_summary=f"prompt={prompt[:200]}, ratio={aspect_ratio}, model={model}",
    )
    start = time.monotonic()
    try:
        result = loop.run_until_complete(
            _async_generate_image(prompt, aspect_ratio, model, team_id, user_id)
        )
        duration_ms = int((time.monotonic() - start) * 1000)
        _update_execution_log(loop, log_id, status="completed", duration_ms=duration_ms,
                              output_summary=str(result)[:500])
        return {"log_id": log_id, **result}
    except Exception as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        _update_execution_log(loop, log_id, status="failed", duration_ms=duration_ms,
                              error_message=str(exc)[:500])
        logger.exception("generate_image_task failed")
        raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))


@celery_app.task(
    bind=True,
    acks_late=True,
    max_retries=2,
    name="app.tasks.ai_generation_task.generate_video_task",
)
def generate_video_task(self, *, prompt, aspect_ratio, model, team_id, user_id,
                        image_url=None, duration_seconds=5, project_id=None):
    """Celery task for video generation. Calls ProviderManager + VideoProvider."""
    structlog.contextvars.bind_contextvars(
        celery_task_id=self.request.id, skill_name="generate_video",
        user_id=user_id, team_id=team_id,
    )
    loop = _get_or_create_event_loop()
    log_id = _create_execution_log(
        loop, skill_name="generate_video", user_id=user_id,
        team_id=team_id, project_id=project_id,
        celery_task_id=self.request.id,
        input_summary=f"prompt={prompt[:200]}, ratio={aspect_ratio}, model={model}",
    )
    start = time.monotonic()
    try:
        result = loop.run_until_complete(
            _async_generate_video(prompt, aspect_ratio, model, team_id, user_id,
                                  image_url, duration_seconds)
        )
        duration_ms = int((time.monotonic() - start) * 1000)
        _update_execution_log(loop, log_id, status="completed", duration_ms=duration_ms,
                              output_summary=str(result)[:500])
        return {"log_id": log_id, **result}
    except Exception as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        _update_execution_log(loop, log_id, status="failed", duration_ms=duration_ms,
                              error_message=str(exc)[:500])
        logger.exception("generate_video_task failed")
        raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))


IMAGE_PROVIDER_TIMEOUT = 110
VIDEO_PROVIDER_TIMEOUT = 280


async def _async_generate_image(prompt, aspect_ratio, model, team_id, user_id):
    from app.services.ai.provider_manager import get_provider_manager
    from app.services.ai.key_health import get_key_health_manager

    pm = get_provider_manager()
    provider, _owner, key_id = await pm.get_provider(
        "gemini", team_id=team_id, user_id=user_id,
    )
    try:
        result = await asyncio.wait_for(
            provider.generate_image(prompt, aspect_ratio=aspect_ratio, model=model),
            timeout=IMAGE_PROVIDER_TIMEOUT,
        )
        await get_key_health_manager().report_success(key_id)
        return result
    except asyncio.TimeoutError:
        await get_key_health_manager().report_error(key_id, "TimeoutError", f"图片生成超时 ({IMAGE_PROVIDER_TIMEOUT}s)")
        raise
    except Exception as e:
        await get_key_health_manager().report_error(key_id, type(e).__name__, str(e)[:200])
        raise


async def _async_generate_video(prompt, aspect_ratio, model, team_id, user_id,
                                image_url, duration_seconds):
    from app.services.ai.provider_manager import get_provider_manager
    from app.services.ai.key_health import get_key_health_manager

    pm = get_provider_manager()
    provider, _owner, key_id = await pm.get_provider(
        "gemini", team_id=team_id, user_id=user_id,
    )
    image_bytes = None
    if image_url:
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(image_url)
            resp.raise_for_status()
            image_bytes = resp.content

    try:
        result = await asyncio.wait_for(
            provider.generate_video(
                prompt=prompt, image_bytes=image_bytes,
                aspect_ratio=aspect_ratio, duration_seconds=duration_seconds, model=model,
            ),
            timeout=VIDEO_PROVIDER_TIMEOUT,
        )
        await get_key_health_manager().report_success(key_id)
        return {
            "url": result["url"],
            "filename": result["filename"],
            "duration_seconds": result.get("duration_seconds"),
        }
    except asyncio.TimeoutError:
        await get_key_health_manager().report_error(key_id, "TimeoutError", f"视频生成超时 ({VIDEO_PROVIDER_TIMEOUT}s)")
        raise
    except Exception as e:
        await get_key_health_manager().report_error(key_id, type(e).__name__, str(e)[:200])
        raise
