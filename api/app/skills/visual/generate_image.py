"""visual.generate_image — Generate images via Gemini Imagen API."""
import logging
import time
from typing import Any

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)

descriptor = SkillDescriptor(
    name="visual.generate_image",
    display_name="AI 图片生成",
    description="使用 Gemini Imagen API 根据提示词生成图片，返回图片 URL。",
    category=SkillCategory.VISUAL,
    triggers=["生成图片", "AI 图片", "generate image"],
    execution_mode="async_celery",
    celery_queue="ai_generation",
    estimated_duration="long",
    requires_project=False,
    input_schema={
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "图片生成提示词"},
            "aspect_ratio": {
                "type": "string",
                "description": "画面比例",
                "default": "16:9",
            },
            "model": {
                "type": "string",
                "description": "Imagen 模型名称",
                "default": "imagen-4.0-generate-001",
            },
        },
        "required": ["prompt"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "url": {"type": "string", "description": "生成图片的访问 URL"},
            "filename": {"type": "string", "description": "文件名"},
        },
    },
)


async def handle_generate_image(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    prompt = params.get("prompt", "")
    if not prompt:
        return SkillResult.failed("prompt 不能为空")

    aspect_ratio = params.get("aspect_ratio", "16:9")
    model = params.get("model", "imagen-4.0-generate-001")

    logger.info(
        "visual.generate_image invoked (trace=%s, model=%s, ratio=%s)",
        ctx.trace_id, model, aspect_ratio,
    )

    from app.services.ai.ai_call_logger import set_ai_call_context, log_ai_call
    from app.services.ai.errors import ContentBlockedError
    from app.services.ai.provider_manager import get_provider_manager, resolve_provider_for_model
    from app.services.ai.key_health import get_key_health_manager

    set_ai_call_context(
        trace_id=ctx.trace_id, user_id=ctx.user_id,
        team_id=ctx.team_id, project_id=ctx.project_id,
    )

    image_model = model or "imagen-4.0-generate-001"
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
        return SkillResult.failed(f"Provider '{provider_name}' 未配置: {e}")

    start = time.monotonic()
    try:
        result = await provider.generate_image(prompt, aspect_ratio=aspect_ratio, model=model)
        duration_ms = int((time.monotonic() - start) * 1000)

        await get_key_health_manager().report_success(key_id)
        await log_ai_call(
            provider=provider_name, model=model, model_type="image",
            status="success", duration_ms=duration_ms,
        )

        return SkillResult(
            status="completed",
            data=result,
            artifacts=[{"type": "image", "url": result["url"]}],
            message="图片生成完成",
        )
    except ContentBlockedError as e:
        duration_ms = int((time.monotonic() - start) * 1000)
        await get_key_health_manager().report_error(key_id, type(e).__name__, str(e)[:200])
        await log_ai_call(
            provider=provider_name, model=model, model_type="image",
            status="blocked", error_message=str(e)[:200], duration_ms=duration_ms,
        )
        return SkillResult.failed(f"内容安全策略拦截: {str(e)[:200]}")
    except Exception as e:
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.exception("visual.generate_image failed")
        await get_key_health_manager().report_error(key_id, type(e).__name__, str(e)[:200])
        await log_ai_call(
            provider=provider_name, model=model, model_type="image",
            status="error", error_message=str(e)[:200], duration_ms=duration_ms,
        )
        return SkillResult.failed(f"图片生成失败: {str(e)[:200]}")


def register_generate_image_skill():
    skill_registry.register(descriptor, handle_generate_image)
