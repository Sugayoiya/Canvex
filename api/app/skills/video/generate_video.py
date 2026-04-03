"""video.generate_video — Generate videos via Gemini Veo API."""
import logging
import time
from typing import Any

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)

descriptor = SkillDescriptor(
    name="video.generate_video",
    display_name="AI 视频生成",
    description="使用 Gemini Veo API 从文本或图片生成视频",
    category=SkillCategory.VIDEO,
    triggers=["生成视频", "AI 视频", "generate video"],
    execution_mode="async_celery",
    celery_queue="media_processing",
    estimated_duration="long",
    requires_project=False,
    input_schema={
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "视频描述 prompt"},
            "image_url": {"type": "string", "description": "首帧图片 URL (可选)"},
            "aspect_ratio": {
                "type": "string",
                "description": "画面比例",
                "default": "16:9",
            },
            "duration_seconds": {
                "type": "integer",
                "description": "视频时长（秒）",
                "default": 5,
                "minimum": 1,
                "maximum": 30,
            },
            "model": {
                "type": "string",
                "description": "Veo 模型名称",
                "default": "veo-2.0-generate-001",
            },
        },
        "required": ["prompt"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "url": {"type": "string", "description": "生成视频的访问 URL"},
            "filename": {"type": "string", "description": "文件名"},
            "duration_seconds": {"type": "integer", "description": "视频时长"},
        },
    },
)


async def handle_generate_video(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    prompt = params.get("prompt", "")
    if not prompt:
        return SkillResult.failed("prompt 不能为空")

    image_url = params.get("image_url")
    aspect_ratio = params.get("aspect_ratio", "16:9")
    duration_seconds = params.get("duration_seconds", 5)
    model = params.get("model", "veo-2.0-generate-001")

    logger.info(
        "video.generate_video invoked (trace=%s, model=%s, ratio=%s)",
        ctx.trace_id, model, aspect_ratio,
    )

    from app.services.ai.ai_call_logger import set_ai_call_context, log_ai_call
    from app.services.ai.provider_manager import get_provider_manager, resolve_provider_for_model
    from app.services.ai.key_health import get_key_health_manager

    set_ai_call_context(
        trace_id=ctx.trace_id, user_id=ctx.user_id,
        team_id=ctx.team_id, project_id=ctx.project_id,
    )

    provider_name = "gemini"
    if ctx.model_name:
        try:
            provider_name, _base_url = await resolve_provider_for_model(ctx.model_name)
        except ValueError:
            provider_name = "gemini"

    try:
        pm = get_provider_manager()
        provider, _owner, key_id = await pm.get_provider(
            provider_name, team_id=ctx.team_id, user_id=ctx.user_id,
        )
    except ValueError as e:
        return SkillResult.failed(f"Provider '{provider_name}' 未配置: {e}", error_code="PROVIDER_NOT_CONFIGURED")

    image_bytes = None
    if image_url:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(image_url)
                resp.raise_for_status()
                image_bytes = resp.content
        except Exception:
            return SkillResult.failed("无法下载首帧图片", error_code="IMAGE_DOWNLOAD_FAILED")

    start = time.monotonic()
    try:
        result = await provider.generate_video(
            prompt=prompt,
            image_bytes=image_bytes,
            aspect_ratio=aspect_ratio,
            duration_seconds=duration_seconds,
            model=model,
        )
        duration_ms = int((time.monotonic() - start) * 1000)

        await get_key_health_manager().report_success(key_id)
        await log_ai_call(
            provider=provider_name, model=model, model_type="video",
            status="success", duration_ms=duration_ms,
        )

        return SkillResult(
            status="completed",
            data={
                "url": result["url"],
                "filename": result["filename"],
                "duration_seconds": result.get("duration_seconds"),
            },
            artifacts=[{"type": "video", "url": result["url"]}],
            message="视频生成完成",
        )
    except Exception as e:
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.exception("video.generate_video failed")
        await get_key_health_manager().report_error(key_id, type(e).__name__, str(e)[:200])
        await log_ai_call(
            provider=provider_name, model=model, model_type="video",
            status="error", error_message=str(e)[:200], duration_ms=duration_ms,
        )
        return SkillResult.failed(f"视频生成失败: {str(e)[:200]}", error_code="VIDEO_GENERATION_FAILED")


def register_generate_video_skill():
    skill_registry.register(descriptor, handle_generate_video)
