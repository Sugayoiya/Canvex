import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.expression import nullslast

from app.core.deps import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas.admin import (
    AdminUserListItem,
    AdminUserListResponse,
    AdminUserRoleUpdate,
    AdminUserStatusUpdate,
)
from app.services.admin_audit import record_admin_audit

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

    return AdminUserListResponse(
        items=[AdminUserListItem.model_validate(u) for u in rows],
        total=total,
        limit=limit,
        offset=offset,
    )
