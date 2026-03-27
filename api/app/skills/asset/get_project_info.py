"""asset.get_project_info — Retrieve project info for context building."""
import logging
from typing import Any

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)

descriptor = SkillDescriptor(
    name="asset.get_project_info",
    display_name="获取项目信息",
    description="获取项目的基本信息（名称、描述、风格、画幅比例等）。",
    category=SkillCategory.ASSET,
    triggers=["项目信息", "project info"],
    execution_mode="sync",
    celery_queue="quick",
    estimated_duration="quick",
    requires_project=True,
    input_schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "项目 ID"},
        },
        "required": ["project_id"],
    },
)


async def handle_get_project_info(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    project_id = params.get("project_id") or ctx.project_id
    if not project_id:
        return SkillResult.failed("project_id 不能为空")

    logger.info("asset.get_project_info invoked (trace=%s, project=%s)", ctx.trace_id, project_id)

    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.project import Project

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Project).where(Project.id == project_id, Project.is_deleted == False)  # noqa: E712
        )
        project = result.scalar_one_or_none()
        if project is None:
            return SkillResult.failed("项目不存在", error_code="NOT_FOUND")

        return SkillResult(
            status="completed",
            data={
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "global_style": project.global_style,
                "aspect_ratio": project.aspect_ratio,
            },
            message=f"项目 '{project.name}' 信息获取成功",
        )


def register_asset_get_project_info_skill():
    skill_registry.register(descriptor, handle_get_project_info)
