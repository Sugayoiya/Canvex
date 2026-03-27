"""extract.characters — Extract character list from text."""
import logging
from typing import Any

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)

descriptor = SkillDescriptor(
    name="extract.characters",
    display_name="角色提取",
    description="从剧本或故事文本中使用 AI 提取角色列表，返回结构化角色数据（名称、描述、性别、年龄等）。",
    category=SkillCategory.EXTRACT,
    triggers=["提取角色", "分析人物", "角色列表", "extract characters"],
    execution_mode="async_celery",
    celery_queue="ai_generation",
    estimated_duration="medium",
    requires_project=True,
    input_schema={
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "待分析的剧本/故事文本"},
            "project_id": {"type": "string", "description": "项目 ID"},
        },
        "required": ["text"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "characters": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "gender": {"type": "string"},
                        "age": {"type": "string"},
                    },
                },
            },
        },
    },
)


async def handle_extract_characters(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    text = params.get("text", "")
    if not text:
        return SkillResult.failed("text 不能为空")

    logger.info("extract.characters invoked (trace=%s, text_len=%d)", ctx.trace_id, len(text))

    # TODO: Integrate with LLM provider for real extraction (Phase 2)
    return SkillResult(
        status="completed",
        data={
            "characters": [
                {"name": "占位角色A", "description": "从文本中提取", "gender": "未知", "age": "未知"},
            ]
        },
        message=f"从 {len(text)} 字文本中提取到 1 个角色（占位）",
    )


def register_extract_characters_skill():
    skill_registry.register(descriptor, handle_extract_characters)
