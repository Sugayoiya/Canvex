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
    system_prompt = params.get("system_prompt", "你是一个专业的影视创作助手。")

    if not prompt:
        return SkillResult.failed("prompt 不能为空")

    # TODO: Integrate with actual LLM provider (Phase 2)
    # For now, return a placeholder to verify the pipeline
    logger.info("text.llm_generate invoked (trace=%s, prompt_len=%d)", ctx.trace_id, len(prompt))

    return SkillResult(
        status="completed",
        data={"text": f"[LLM 占位响应] 收到 prompt ({len(prompt)} 字符), 系统 prompt: {system_prompt[:50]}..."},
        message="文本生成完成",
    )


def register_text_skills():
    skill_registry.register(descriptor, handle_llm_generate)
