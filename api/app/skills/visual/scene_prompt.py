"""visual.scene_prompt — Generate image prompt from scene data via LLM."""
import json
import logging
from typing import Any

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)

descriptor = SkillDescriptor(
    name="visual.scene_prompt",
    display_name="场景图片提示词",
    description="根据场景信息使用 AI 生成详细的场景描述提示词，用于后续图片生成。",
    category=SkillCategory.VISUAL,
    triggers=["场景提示词", "场景图片描述", "scene prompt"],
    execution_mode="sync",
    celery_queue="ai_generation",
    estimated_duration="medium",
    requires_project=False,
    input_schema={
        "type": "object",
        "properties": {
            "scene_name": {"type": "string", "description": "场景名称"},
            "scene_data": {
                "type": "object",
                "description": "场景数据（描述、地点、时间、氛围等）",
                "properties": {
                    "description": {"type": "string"},
                    "location": {"type": "string"},
                    "time_of_day": {"type": "string"},
                    "mood": {"type": "string"},
                },
            },
            "style": {"type": "string", "description": "风格要求（可选）"},
            "provider": {"type": "string", "description": "LLM 提供商", "default": "gemini"},
            "model": {"type": "string", "description": "模型名称"},
        },
        "required": ["scene_name", "scene_data"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "生成的图片提示词"},
        },
    },
)


async def handle_scene_prompt(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    name = params.get("scene_name", "")
    data = params.get("scene_data", {})
    style = params.get("style", "")
    if not name:
        return SkillResult.failed("scene_name 不能为空")

    logger.info("visual.scene_prompt invoked (trace=%s, name=%s)", ctx.trace_id, name)

    from app.services.ai.ai_call_logger import set_ai_call_context, log_ai_call
    from app.services.ai.provider_manager import resolve_llm_provider
    from app.services.ai.base import Message
    import time

    set_ai_call_context(
        trace_id=ctx.trace_id, user_id=ctx.user_id,
        team_id=ctx.team_id, project_id=ctx.project_id,
    )

    provider_name = params.get("provider", "gemini")
    model_name = params.get("model")
    provider, _key_id = await resolve_llm_provider(provider_name, model_name, ctx)

    parts = [f"场景名：{name}"]
    if data:
        parts.append(f"场景数据：{json.dumps(data, ensure_ascii=False)}")

    system_content = (
        "你是专业的 AI 绘画提示词专家。根据场景信息生成详细的场景描述提示词。"
        "提示词应包含：环境、光线、氛围、色调、构图建议。"
    )
    if style:
        system_content += f"风格要求：{style}"
    system_content += "仅返回提示词文本，不要其他内容。"

    messages = [
        Message(role="system", content=system_content),
        Message(role="user", content="\n".join(parts)),
    ]

    start = time.monotonic()
    try:
        result_text = await provider.generate(messages, temperature=0.7, max_tokens=500)
        duration_ms = int((time.monotonic() - start) * 1000)

        await log_ai_call(
            provider=provider_name, model=model_name or "default",
            model_type="llm", status="success", duration_ms=duration_ms,
        )

        return SkillResult(
            status="completed",
            data={"prompt": result_text.strip()},
            message="场景图片提示词生成完成",
        )
    except Exception as e:
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.exception("visual.scene_prompt failed")
        await log_ai_call(
            provider=provider_name, model=model_name or "default",
            model_type="llm", status="error",
            error_message=str(e)[:200], duration_ms=duration_ms,
        )
        return SkillResult.failed(f"场景提示词生成失败: {str(e)[:200]}")


def register_scene_prompt_skill():
    skill_registry.register(descriptor, handle_scene_prompt)
