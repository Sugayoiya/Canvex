"""extract.scenes — Extract scene list from text."""
import logging
from typing import Any

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)

descriptor = SkillDescriptor(
    name="extract.scenes",
    display_name="场景提取",
    description="从剧本或故事文本中使用 AI 提取场景列表，返回结构化场景数据（名称、描述、时间、地点等）。",
    category=SkillCategory.EXTRACT,
    triggers=["提取场景", "分析场景", "场景列表", "extract scenes"],
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
            "scenes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "time_of_day": {"type": "string"},
                        "location": {"type": "string"},
                    },
                },
            },
        },
    },
)


async def handle_extract_scenes(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    text = params.get("text", "")
    if not text:
        return SkillResult.failed("text 不能为空")

    logger.info("extract.scenes invoked (trace=%s, text_len=%d)", ctx.trace_id, len(text))

    # TODO: Integrate with LLM provider for real extraction (Phase 2)
    return SkillResult(
        status="completed",
        data={
            "scenes": [
                {"name": "占位场景A", "description": "从文本中提取", "time_of_day": "白天", "location": "未知"},
            ]
        },
        message=f"从 {len(text)} 字文本中提取到 1 个场景（占位）",
    )


def register_extract_scenes_skill():
    skill_registry.register(descriptor, handle_extract_scenes)
