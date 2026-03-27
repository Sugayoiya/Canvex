"""canvas.get_state — Retrieve current canvas state."""
import logging
from typing import Any

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)

descriptor = SkillDescriptor(
    name="canvas.get_state",
    display_name="获取画布状态",
    description="获取当前画布的节点和连线状态，返回节点列表和连线列表。Agent 可用此了解画布当前内容。",
    category=SkillCategory.CANVAS,
    triggers=["画布状态", "当前节点", "get canvas state"],
    execution_mode="sync",
    celery_queue="quick",
    estimated_duration="quick",
    requires_canvas=True,
    input_schema={
        "type": "object",
        "properties": {
            "canvas_id": {"type": "string", "description": "画布 ID"},
        },
        "required": ["canvas_id"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "nodes": {"type": "array"},
            "edges": {"type": "array"},
        },
    },
)


async def handle_get_state(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    canvas_id = params.get("canvas_id") or ctx.canvas_id
    if not canvas_id:
        return SkillResult.failed("canvas_id 不能为空")

    logger.info("canvas.get_state invoked (trace=%s, canvas=%s)", ctx.trace_id, canvas_id)

    # TODO: Query actual canvas data from DB (Phase 2)
    return SkillResult(
        status="completed",
        data={
            "canvas_id": canvas_id,
            "nodes": [],
            "edges": [],
        },
        message="画布状态获取成功（当前为空）",
    )


def register_canvas_get_state_skill():
    skill_registry.register(descriptor, handle_get_state)
