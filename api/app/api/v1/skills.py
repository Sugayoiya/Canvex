from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.schemas.skill import (
    SkillInfo,
    SkillInvokeRequest,
    SkillResultResponse,
    SkillPollRequest,
)
from app.skills import skill_registry, SkillContext, SkillExecutor

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("/", response_model=list[SkillInfo])
async def list_skills(category: str | None = None, user=Depends(get_current_user)):
    """List all registered Skills (optionally filter by category)."""
    descriptors = skill_registry.discover(category)
    return [
        SkillInfo(
            name=d.name,
            display_name=d.display_name,
            description=d.description,
            category=d.category.value,
            execution_mode=d.execution_mode,
            estimated_duration=d.estimated_duration,
            input_schema=d.input_schema,
            output_schema=d.output_schema,
        )
        for d in descriptors
    ]


@router.get("/tools")
async def get_tool_definitions(category: str | None = None, user=Depends(get_current_user)):
    """Get Skills as OpenAI Tool Calling function definitions."""
    return skill_registry.to_tool_definitions(category)


@router.post("/invoke", response_model=SkillResultResponse)
async def invoke_skill(
    req: SkillInvokeRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invoke a Skill by name."""
    ctx = SkillContext(
        user_id=user.id,
        project_id=req.project_id,
        canvas_id=req.canvas_id,
        node_id=req.node_id,
        trigger_source="user_ui",
    )

    executor = SkillExecutor(skill_registry)
    result = await executor.invoke(req.skill_name, req.params, ctx)

    return SkillResultResponse(
        status=result.status,
        task_id=result.task_id,
        data=result.data,
        artifacts=result.artifacts,
        message=result.message,
        progress=result.progress,
    )


@router.post("/poll", response_model=SkillResultResponse)
async def poll_skill(req: SkillPollRequest, user=Depends(get_current_user)):
    """Poll async Skill execution status."""
    result = await skill_registry.poll(req.task_id)
    return SkillResultResponse(
        status=result.status,
        task_id=result.task_id,
        data=result.data,
        artifacts=result.artifacts,
        message=result.message,
        progress=result.progress,
    )
