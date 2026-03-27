from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.models.skill_execution_log import SkillExecutionLog
from app.models.ai_call_log import AICallLog

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
