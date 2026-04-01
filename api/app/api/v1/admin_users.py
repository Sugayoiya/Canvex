import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.expression import nullslast

from app.core.deps import get_current_user, get_db, require_admin
from app.models.quota import UserQuota
from app.models.team import Team, TeamMember
from app.models.user import User
from app.schemas.admin import (
    AdminUserListItem,
    AdminUserListResponse,
    AdminUserRoleUpdate,
    AdminUserStatusUpdate,
)
from app.services.admin_audit import AuditContext

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin-users"])

_SORT_COLUMNS = {
    "created_at": User.created_at,
    "last_login_at": User.last_login_at,
    "email": User.email,
}


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    q: str | None = None,
    status: str | None = None,
    is_admin: bool | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)

    if sort_by not in _SORT_COLUMNS:
        raise HTTPException(status_code=400, detail=f"Invalid sort_by: {sort_by}")
    if sort_order not in ("asc", "desc"):
        raise HTTPException(status_code=400, detail=f"Invalid sort_order: {sort_order}")

    base = select(User)
    count_base = select(func.count(User.id))

    if q:
        pattern = f"%{q}%"
        condition = User.email.ilike(pattern) | User.nickname.ilike(pattern)
        base = base.where(condition)
        count_base = count_base.where(condition)

    if status:
        base = base.where(User.status == status)
        count_base = count_base.where(User.status == status)

    if is_admin is not None:
        base = base.where(User.is_admin == is_admin)
        count_base = count_base.where(User.is_admin == is_admin)

    col = _SORT_COLUMNS[sort_by]
    if sort_order == "desc":
        order_expr = col.desc()
    else:
        order_expr = col.asc()

    if sort_by == "last_login_at":
        order_expr = nullslast(order_expr)

    total = (await db.execute(count_base)).scalar() or 0
    rows = (await db.execute(base.order_by(order_expr).offset(offset).limit(limit))).scalars().all()

    user_ids = [u.id for u in rows]
    team_map: dict[str, list[str]] = {}
    if user_ids:
        tm_stmt = (
            select(TeamMember.user_id, Team.name)
            .join(Team, TeamMember.team_id == Team.id)
            .where(TeamMember.user_id.in_(user_ids), Team.is_deleted == False)  # noqa: E712
        )
        tm_rows = (await db.execute(tm_stmt)).all()
        for uid, tname in tm_rows:
            team_map.setdefault(uid, []).append(tname)

    admin_count_val = (await db.execute(
        select(func.count(User.id)).where(User.is_admin == True, User.status == "active")  # noqa: E712
    )).scalar() or 0

    quota_map: dict[str, UserQuota] = {}
    if user_ids:
        q_stmt = select(UserQuota).where(UserQuota.user_id.in_(user_ids))
        q_rows = (await db.execute(q_stmt)).scalars().all()
        quota_map = {q.user_id: q for q in q_rows}

    items = []
    for u in rows:
        item = AdminUserListItem.model_validate(u)
        item.teams = team_map.get(u.id, [])
        uq = quota_map.get(u.id)
        if uq:
            item.monthly_credit_limit = float(uq.monthly_credit_limit) if uq.monthly_credit_limit is not None else None
            item.current_month_usage = float(uq.current_month_usage) if uq.current_month_usage else 0
            item.daily_call_limit = uq.daily_call_limit
            item.current_day_calls = uq.current_day_calls or 0
        items.append(item)

    return AdminUserListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        admin_count=admin_count_val,
    )


@router.patch("/users/{user_id}/status", response_model=AdminUserListItem)
async def update_user_status(
    user_id: str,
    body: AdminUserStatusUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)

    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    old_status = target.status
    target.status = body.status

    if body.status == "banned":
        target.refresh_token_hash = None
        target.refresh_token_expires = None

    await db.flush()

    audit = AuditContext(db, user.id)
    await audit.log("user.status.update", "user", user_id,
        changes={"status": {"old": old_status, "new": body.status}})

    return AdminUserListItem.model_validate(target)


@router.patch("/users/{user_id}/admin", response_model=AdminUserListItem)
async def update_user_admin(
    user_id: str,
    body: AdminUserRoleUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)

    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    old_is_admin = target.is_admin
    audit = AuditContext(db, user.id)
    changes = {"is_admin": {"old": old_is_admin, "new": body.is_admin}}

    if not body.is_admin:
        if user_id == user.id:
            await audit.log("user.admin.update", "user", user_id,
                changes=changes, success=False, error_message="self_demotion_blocked")
            raise HTTPException(status_code=400, detail="Cannot demote yourself")

        active_admin_count = (
            await db.execute(
                select(func.count(User.id)).where(
                    User.is_admin == True,  # noqa: E712
                    User.status == "active",
                )
            )
        ).scalar() or 0

        if active_admin_count <= 1 and target.is_admin:
            await audit.log("user.admin.update", "user", user_id,
                changes=changes, success=False, error_message="last_admin_blocked")
            raise HTTPException(status_code=400, detail="Cannot remove the last active admin")

    target.is_admin = body.is_admin
    await db.flush()

    await audit.log("user.admin.update", "user", user_id, changes=changes)

    return AdminUserListItem.model_validate(target)
