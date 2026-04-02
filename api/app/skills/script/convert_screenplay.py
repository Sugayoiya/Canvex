"""script.convert_screenplay — Convert a clip narrative into formatted screenplay text."""
import logging
from typing import Any

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)

descriptor = SkillDescriptor(
    name="script.convert_screenplay",
    display_name="剧本转换",
    description="将片段叙事文本转换为标准剧本格式，包含场景标题、角色对话、动作描述和镜头指示。",
    category=SkillCategory.SCRIPT,
    triggers=["转换剧本", "生成剧本", "convert screenplay", "screenplay format"],
    execution_mode="async_celery",
    celery_queue="ai_generation",
    estimated_duration="medium",
    input_schema={
        "type": "object",
        "properties": {
            "clip_content": {"type": "string", "description": "片段叙事内容"},
            "characters": {"type": "string", "description": "角色上下文 (可选)"},
            "scenes": {"type": "string", "description": "场景上下文 (可选)"},
            "provider": {"type": "string", "description": "AI 提供商 (可选, 默认 gemini)"},
            "model": {"type": "string", "description": "模型名称 (可选)"},
        },
        "required": ["clip_content"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "screenplay": {"type": "string", "description": "标准格式剧本文本"},
        },
    },
)

_SYSTEM_PROMPT = (
    "你是专业的编剧。将以下内容转换为标准剧本格式，包含:\n"
    "场景标题(INT/EXT. 地点 - 时间)、角色对话、动作描述、镜头指示。\n"
    "{character_context}"
    "{scene_context}"
    "仅返回剧本文本，不要 JSON 包装或其他说明。"
)


async def handle_convert_screenplay(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    clip_content = params.get("clip_content", "")
    if not clip_content:
        return SkillResult.failed("clip_content 不能为空")

    characters = params.get("characters", "")
    scenes = params.get("scenes", "")
    provider_name = params.get("provider", "gemini")
    model_name = params.get("model")

    from app.services.ai.ai_call_logger import set_ai_call_context
    set_ai_call_context(
        trace_id=ctx.trace_id,
        user_id=ctx.user_id,
        team_id=ctx.team_id,
        project_id=ctx.project_id,
    )

    from app.services.ai.provider_manager import resolve_llm_provider
    from app.services.ai.base import Message

    char_ctx = f"参考角色信息:\n{characters}\n" if characters else ""
    scene_ctx = f"参考场景信息:\n{scenes}\n" if scenes else ""
    system_prompt = _SYSTEM_PROMPT.format(
        character_context=char_ctx,
        scene_context=scene_ctx,
    )

    try:
        provider, _key_id = await resolve_llm_provider(provider_name, model_name, ctx)
        messages = [
            Message(role="system", content=system_prompt),
            Message(role="user", content=clip_content),
        ]
        result_text = await provider.generate(messages, temperature=0.5, max_tokens=8000)
    except ValueError as e:
        return SkillResult.failed(str(e))
    except Exception as e:
        logger.exception("script.convert_screenplay LLM call failed")
        return SkillResult.failed(f"LLM 调用失败: {type(e).__name__}: {str(e)[:200]}")

    if not result_text or not result_text.strip():
        return SkillResult.failed("模型返回空结果")

    return SkillResult(
        status="completed",
        data={"screenplay": result_text.strip()},
        message=f"剧本转换完成 ({len(result_text)} 字)",
    )


def register_convert_screenplay_skill():
    skill_registry.register(descriptor, handle_convert_screenplay)
