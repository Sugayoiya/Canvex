"""text.llm_generate — Generic LLM text generation Skill."""
import logging
from typing import Any

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)

descriptor = SkillDescriptor(
    name="text.llm_generate",
    display_name="LLM 文本生成",
    description="使用大语言模型根据 prompt 生成文本内容。可用于文案创作、改写、翻译等通用文本任务。",
    category=SkillCategory.TEXT,
    triggers=["生成文本", "写文案", "翻译", "改写", "generate text"],
    execution_mode="async_celery",
    celery_queue="ai_generation",
    estimated_duration="medium",
    input_schema={
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "生成提示词"},
            "system_prompt": {"type": "string", "description": "系统提示词 (可选)"},
            "max_tokens": {"type": "integer", "description": "最大生成 token 数", "default": 2000},
            "provider": {"type": "string", "description": "AI 提供商 (可选, 默认 gemini)"},
            "model": {"type": "string", "description": "模型名称 (可选, 使用提供商默认模型)"},
        },
        "required": ["prompt"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "生成的文本"},
        },
    },
)


async def handle_llm_generate(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    prompt = params.get("prompt", "")
    if not prompt:
        return SkillResult.failed("prompt 不能为空")

    system_prompt = params.get("system_prompt", "你是一个专业的影视创作助手。")
    max_tokens = params.get("max_tokens", 2000)
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

    try:
        provider, _key_id = await resolve_llm_provider(provider_name, model_name, ctx)
        messages: list[Message] = []
        if system_prompt:
            messages.append(Message(role="system", content=system_prompt))
        messages.append(Message(role="user", content=prompt))

        result_text = await provider.generate(messages, max_tokens=max_tokens)
        return SkillResult(
            status="completed",
            data={"text": result_text},
            message=f"文本生成完成 ({len(result_text)} 字)",
        )
    except ValueError as e:
        return SkillResult.failed(str(e))
    except Exception as e:
        logger.exception("text.llm_generate failed")
        return SkillResult.failed(f"LLM 调用失败: {type(e).__name__}: {str(e)[:200]}")


def register_text_skills():
    skill_registry.register(descriptor, handle_llm_generate)
