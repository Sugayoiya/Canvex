from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user, require_admin
from app.models.ai_call_log import AICallLog
from app.models.ai_provider_config import AIProviderConfig
from app.models.skill_execution_log import SkillExecutionLog
from app.models.team import Team, TeamMember
from app.models.user import User
from app.schemas.admin import (
    AdminDashboardResponse,
    AdminDashboardWindowStats,
    AdminProviderStatus,
    AdminTeamListItem,
    AdminTeamListResponse,
)

router = APIRouter(prefix="/admin", tags=["admin-observability"])


@router.get("/teams", response_model=AdminTeamListResponse)
async def list_teams(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    require_admin(user)

    member_count_sub = (
        select(func.count(TeamMember.id))
        .where(TeamMember.team_id == Team.id)
        .correlate(Team)
        .scalar_subquery()
    )

    owner_sub = (
        select(User.nickname)
        .join(TeamMember, TeamMember.user_id == User.id)
        .where(
            TeamMember.team_id == Team.id,
            TeamMember.role.in_(["team_admin", "owner"]),
        )
        .correlate(Team)
        .limit(1)
        .scalar_subquery()
    )

    base_filter = Team.is_deleted == False  # noqa: E712
    if q:
        base_filter = base_filter & Team.name.ilike(f"%{q}%")

    count_stmt = select(func.count(Team.id)).where(base_filter)
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = (
        select(
            Team.id,
            Team.name,
            Team.description,
            Team.created_at,
            member_count_sub.label("member_count"),
            owner_sub.label("owner_name"),
        )
        .where(base_filter)
        .order_by(Team.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    items = [
        AdminTeamListItem(
            id=r.id,
            name=r.name,
            description=r.description,
            created_at=r.created_at,
            member_count=r.member_count or 0,
            owner_name=r.owner_name,
        )
        for r in rows
    ]
    return AdminTeamListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def dashboard(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)

    now = datetime.now(timezone.utc)
    h24 = now - timedelta(hours=24)
    d7 = now - timedelta(days=7)
    d30 = now - timedelta(days=30)

    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_teams = (
        await db.execute(
            select(func.count(Team.id)).where(Team.is_deleted == False)  # noqa: E712
        )
    ).scalar() or 0

    active_tasks = (
        await db.execute(
            select(func.count(SkillExecutionLog.id)).where(
                SkillExecutionLog.status.in_(["queued", "running"])
            )
        )
    ).scalar() or 0

    total_cost_val = (
        await db.execute(select(func.sum(AICallLog.cost)))
    ).scalar()
    total_cost = float(total_cost_val) if total_cost_val else 0.0

    # Provider status — system-scope only
    provider_stmt = select(
        func.count(case((AIProviderConfig.is_enabled == True, 1))).label("enabled"),  # noqa: E712
        func.count(case((AIProviderConfig.is_enabled == False, 1))).label("disabled"),  # noqa: E712
    ).where(AIProviderConfig.owner_type == "system")
    prow = (await db.execute(provider_stmt)).one()
    provider_status = AdminProviderStatus(
        enabled_count=prow.enabled or 0,
        disabled_count=prow.disabled or 0,
    )

    # Task windows via conditional aggregation (SQLite + PG compatible)
    task_win_stmt = select(
        func.count(case((SkillExecutionLog.queued_at >= h24, 1))).label("h24_total"),
        func.count(
            case(
                (
                    (SkillExecutionLog.queued_at >= h24)
                    & (SkillExecutionLog.status == "failed"),
                    1,
                )
            )
        ).label("h24_failed"),
        func.count(case((SkillExecutionLog.queued_at >= d7, 1))).label("d7_total"),
        func.count(
            case(
                (
                    (SkillExecutionLog.queued_at >= d7)
                    & (SkillExecutionLog.status == "failed"),
                    1,
                )
            )
        ).label("d7_failed"),
        func.count(case((SkillExecutionLog.queued_at >= d30, 1))).label("d30_total"),
        func.count(
            case(
                (
                    (SkillExecutionLog.queued_at >= d30)
                    & (SkillExecutionLog.status == "failed"),
                    1,
                )
            )
        ).label("d30_failed"),
    ).where(SkillExecutionLog.queued_at >= d30)
    tw = (await db.execute(task_win_stmt)).one()

    # Cost windows via conditional aggregation
    cost_win_stmt = select(
        func.sum(case((AICallLog.created_at >= h24, AICallLog.cost))).label("h24_cost"),
        func.sum(case((AICallLog.created_at >= d7, AICallLog.cost))).label("d7_cost"),
        func.sum(case((AICallLog.created_at >= d30, AICallLog.cost))).label("d30_cost"),
    ).where(AICallLog.created_at >= d30)
    cw = (await db.execute(cost_win_stmt)).one()

    windows = {
        "h24": AdminDashboardWindowStats(
            tasks_total=tw.h24_total or 0,
            tasks_failed=tw.h24_failed or 0,
            cost_total=float(cw.h24_cost) if cw.h24_cost else 0.0,
        ),
        "d7": AdminDashboardWindowStats(
            tasks_total=tw.d7_total or 0,
            tasks_failed=tw.d7_failed or 0,
            cost_total=float(cw.d7_cost) if cw.d7_cost else 0.0,
        ),
        "d30": AdminDashboardWindowStats(
            tasks_total=tw.d30_total or 0,
            tasks_failed=tw.d30_failed or 0,
            cost_total=float(cw.d30_cost) if cw.d30_cost else 0.0,
        ),
    }

    return AdminDashboardResponse(
        total_users=total_users,
        total_teams=total_teams,
        active_tasks=active_tasks,
        total_cost=total_cost,
        provider_status=provider_status,
        windows=windows,
    )
