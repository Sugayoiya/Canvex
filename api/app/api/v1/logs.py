from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user, resolve_project_access
from app.models.skill_execution_log import SkillExecutionLog
from app.models.ai_call_log import AICallLog
from app.models.canvas import Canvas, CanvasNode

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/skills")
async def list_skill_logs(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, le=100),
    offset: int = 0,
    skill_name: str | None = None,
    status: str | None = None,
):
    """Query Skill execution logs."""
    stmt = select(SkillExecutionLog).where(
        SkillExecutionLog.user_id == user.id
    ).order_by(desc(SkillExecutionLog.queued_at))

    if skill_name:
        stmt = stmt.where(SkillExecutionLog.skill_name == skill_name)
    if status:
        stmt = stmt.where(SkillExecutionLog.status == status)

    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "id": r.id,
            "trace_id": r.trace_id,
            "skill_name": r.skill_name,
            "skill_category": r.skill_category,
            "status": r.status,
            "duration_ms": r.duration_ms,
            "ai_call_count": r.ai_call_count,
            "total_input_tokens": r.total_input_tokens,
            "total_output_tokens": r.total_output_tokens,
            "queued_at": r.queued_at.isoformat() if r.queued_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "trigger_source": r.trigger_source,
        }
        for r in rows
    ]


@router.get("/ai-calls")
async def list_ai_call_logs(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, le=100),
    offset: int = 0,
    provider: str | None = None,
    model: str | None = None,
):
    """Query AI call logs."""
    stmt = select(AICallLog).where(
        AICallLog.user_id == user.id
    ).order_by(desc(AICallLog.created_at))

    if provider:
        stmt = stmt.where(AICallLog.provider == provider)
    if model:
        stmt = stmt.where(AICallLog.model == model)

    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "id": r.id,
            "trace_id": r.trace_id,
            "provider": r.provider,
            "model": r.model,
            "model_type": r.model_type,
            "input_tokens": r.input_tokens,
            "output_tokens": r.output_tokens,
            "duration_ms": r.duration_ms,
            "status": r.status,
            "cost": str(r.cost) if r.cost else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/ai-calls/stats")
async def ai_call_stats(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate statistics for AI calls."""
    stmt = select(
        func.count(AICallLog.id).label("total_calls"),
        func.sum(AICallLog.input_tokens).label("total_input_tokens"),
        func.sum(AICallLog.output_tokens).label("total_output_tokens"),
        func.sum(AICallLog.cost).label("total_cost"),
    ).where(AICallLog.user_id == user.id)

    result = await db.execute(stmt)
    row = result.one()

    return {
        "total_calls": row.total_calls or 0,
        "total_input_tokens": row.total_input_tokens or 0,
        "total_output_tokens": row.total_output_tokens or 0,
        "total_cost": str(row.total_cost) if row.total_cost else "0",
    }


@router.get("/tasks")
async def list_tasks(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, le=100, ge=1),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None),
    project_id: str | None = Query(None),
    user_id: str | None = Query(None),
):
    is_admin = getattr(user, "is_admin", False)

    stmt = select(SkillExecutionLog)
    count_stmt = select(func.count(SkillExecutionLog.id))

    if not is_admin:
        stmt = stmt.where(SkillExecutionLog.user_id == user.id)
        count_stmt = count_stmt.where(SkillExecutionLog.user_id == user.id)
    elif user_id:
        stmt = stmt.where(SkillExecutionLog.user_id == user_id)
        count_stmt = count_stmt.where(SkillExecutionLog.user_id == user_id)

    if status:
        stmt = stmt.where(SkillExecutionLog.status == status)
        count_stmt = count_stmt.where(SkillExecutionLog.status == status)
    if project_id:
        stmt = stmt.where(SkillExecutionLog.project_id == project_id)
        count_stmt = count_stmt.where(SkillExecutionLog.project_id == project_id)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    stmt = stmt.order_by(desc(SkillExecutionLog.queued_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    data = [
        {
            "id": r.id,
            "skill_name": r.skill_name,
            "skill_category": r.skill_category,
            "status": r.status,
            "duration_ms": r.duration_ms,
            "total_input_tokens": r.total_input_tokens,
            "total_output_tokens": r.total_output_tokens,
            "total_cost": str(r.total_cost) if r.total_cost else None,
            "queued_at": r.queued_at.isoformat() if r.queued_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "trigger_source": r.trigger_source,
            "project_id": r.project_id,
        }
        for r in rows
    ]

    response = JSONResponse(content=data)
    response.headers["X-Total-Count"] = str(total)
    return response


@router.get("/tasks/counts")
async def task_status_counts(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    project_id: str | None = Query(None),
):
    is_admin = getattr(user, "is_admin", False)

    stmt = select(
        SkillExecutionLog.status,
        func.count(SkillExecutionLog.id).label("cnt"),
    )

    if not is_admin:
        stmt = stmt.where(SkillExecutionLog.user_id == user.id)
    if project_id:
        stmt = stmt.where(SkillExecutionLog.project_id == project_id)

    stmt = stmt.group_by(SkillExecutionLog.status)
    result = await db.execute(stmt)
    rows = result.all()

    counts: dict[str, int] = {}
    total = 0
    for row in rows:
        counts[row.status] = row.cnt
        total += row.cnt

    return {
        "running": counts.get("running", 0),
        "completed": counts.get("completed", 0),
        "failed": counts.get("failed", 0),
        "timeout": counts.get("timeout", 0),
        "queued": counts.get("queued", 0),
        "total": total,
    }


@router.get("/node-history/{node_id}")
async def get_node_execution_history(
    node_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(10, le=50),
):
    node_result = await db.execute(
        select(CanvasNode).where(CanvasNode.id == node_id)
    )
    node = node_result.scalar_one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    canvas_result = await db.execute(
        select(Canvas).where(Canvas.id == node.canvas_id)
    )
    canvas = canvas_result.scalar_one_or_none()
    if canvas is None:
        raise HTTPException(status_code=404, detail="Canvas not found")

    await resolve_project_access(canvas.project_id, user, db)

    stmt = (
        select(SkillExecutionLog)
        .where(SkillExecutionLog.node_id == node_id)
        .order_by(desc(SkillExecutionLog.queued_at))
        .limit(limit)
    )

    if not getattr(user, "is_admin", False):
        stmt = stmt.where(SkillExecutionLog.user_id == user.id)

    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "id": r.id,
            "skill_name": r.skill_name,
            "status": r.status,
            "duration_ms": r.duration_ms,
            "total_cost": str(r.total_cost) if r.total_cost else None,
            "queued_at": r.queued_at.isoformat() if r.queued_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in rows
    ]


@router.get("/trace/{trace_id}")
async def get_trace(
    trace_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get complete trace: Skill execution + all child AI calls."""
    skill_stmt = select(SkillExecutionLog).where(
        SkillExecutionLog.trace_id == trace_id,
        SkillExecutionLog.user_id == user.id,
    )
    skill_result = await db.execute(skill_stmt)
    skill_logs = skill_result.scalars().all()

    ai_stmt = select(AICallLog).where(
        AICallLog.trace_id == trace_id,
        AICallLog.user_id == user.id,
    ).order_by(AICallLog.created_at)
    ai_result = await db.execute(ai_stmt)
    ai_logs = ai_result.scalars().all()

    return {
        "trace_id": trace_id,
        "skills": [
            {
                "id": s.id,
                "skill_name": s.skill_name,
                "status": s.status,
                "duration_ms": s.duration_ms,
                "queued_at": s.queued_at.isoformat() if s.queued_at else None,
            }
            for s in skill_logs
        ],
        "ai_calls": [
            {
                "id": a.id,
                "provider": a.provider,
                "model": a.model,
                "input_tokens": a.input_tokens,
                "output_tokens": a.output_tokens,
                "duration_ms": a.duration_ms,
                "status": a.status,
                "cost": str(a.cost) if a.cost else None,
            }
            for a in ai_logs
        ],
    }
