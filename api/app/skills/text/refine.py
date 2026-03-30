"""text.refine — Text polishing/refinement Skill."""
import logging
from typing import Any

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)

descriptor = SkillDescriptor(
    name="text.refine",
    display_name="文本润色",
    description="使用 AI 对输入文本进行润色、优化表达，保持原意的同时提升文采和可读性。",
    category=SkillCategory.TEXT,
    triggers=["润色", "优化文本", "提升文采", "refine text", "polish"],
    execution_mode="async_celery",
    celery_queue="ai_generation",
    estimated_duration="medium",
    input_schema={
        "type": "object",
        "properties": {
            "content": {"type": "string", "description": "待润色的文本内容"},
            "style": {"type": "string", "description": "润色风格要求 (可选)", "default": "保持原意，提升文采"},
            "provider": {"type": "string", "description": "AI 提供商 (可选, 默认 gemini)"},
            "model": {"type": "string", "description": "模型名称 (可选)"},
        },
        "required": ["content"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "润色后的文本"},
        },
    },
)


async def handle_refine(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    content = params.get("content", "")
    if not content:
        return SkillResult.failed("content 不能为空")

    style = params.get("style", "保持原意，提升文采")
    provider_name = params.get("provider", "gemini")
    model_name = params.get("model")

    from app.services.ai.ai_call_logger import set_ai_call_context
    set_ai_call_context(
        trace_id=ctx.trace_id,
        user_id=ctx.user_id,
        team_id=ctx.team_id,
        project_id=ctx.project_id,
    )

    from app.services.ai.provider_manager import get_provider_manager
    from app.services.ai.base import Message

    try:
        provider = get_provider_manager().get_provider_sync(provider_name, model=model_name)
        messages = [
            Message(
                role="system",
                content=f"你是专业的文本润色编辑。要求：{style}。仅返回润色后的文本，不要解释。",
            ),
            Message(role="user", content=content),
        ]

        result_text = await provider.generate(messages, temperature=0.7)
        return SkillResult(
            status="completed",
            data={"text": result_text},
            message=f"润色完成 ({len(result_text)} 字)",
        )
    except ValueError as e:
        return SkillResult.failed(str(e))
    except Exception as e:
        logger.exception("text.refine failed")
        return SkillResult.failed(f"润色失败: {type(e).__name__}: {str(e)[:200]}")


def register_text_refine_skill():
    skill_registry.register(descriptor, handle_refine)
