import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user, require_admin
from app.models.quota import UserQuota, TeamQuota, QuotaUsageLog
from app.schemas.quota import QuotaResponse, QuotaUpdate
from app.services.admin_audit import AuditContext, serialize_changes

router = APIRouter(prefix="/quota", tags=["quota"])


@router.get("/my", response_model=QuotaResponse)
async def get_my_quota(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Current user's own quota status (any authenticated user)."""
    result = await db.execute(select(UserQuota).where(UserQuota.user_id == user.id))
    quota = result.scalar_one_or_none()
    if not quota:
        return QuotaResponse(user_id=user.id)
    return quota


@router.get("/user/{user_id}", response_model=QuotaResponse)
async def get_user_quota(
    user_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user quota (admin only)."""
    require_admin(user)
    result = await db.execute(select(UserQuota).where(UserQuota.user_id == user_id))
    quota = result.scalar_one_or_none()
    if not quota:
        return QuotaResponse(user_id=user_id)
    return quota


@router.put("/user/{user_id}", response_model=QuotaResponse)
async def set_user_quota(
    user_id: str,
    req: QuotaUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set user quota limits (admin only, writes audit log)."""
    require_admin(user)

    result = await db.execute(select(UserQuota).where(UserQuota.user_id == user_id))
    quota = result.scalar_one_or_none()

    old_values = {}
    if quota:
        old_values = serialize_changes({
            "monthly_credit_limit": quota.monthly_credit_limit,
            "daily_call_limit": quota.daily_call_limit,
        })
    else:
        quota = UserQuota(user_id=user_id)
        db.add(quota)

    new_values = req.model_dump(exclude_unset=True)
    for k, v in new_values.items():
        setattr(quota, k, v)
    quota.updated_at = datetime.now(timezone.utc)

    new_serialized = serialize_changes(new_values)
    db.add(QuotaUsageLog(
        user_id=user_id,
        skill_execution_id=str(uuid.uuid4()),
        credit_amount=Decimal("0"),
        action="admin_set",
        details=json.dumps({"old": old_values, "new": new_serialized, "admin_user_id": user.id}, ensure_ascii=False),
    ))

    await db.flush()

    audit = AuditContext(db, user.id)
    await audit.log("quota.user.set", "user_quota", user_id,
        changes={"quota": {"old": old_values, "new": new_serialized}})

    return quota


@router.get("/team/{team_id}", response_model=QuotaResponse)
async def get_team_quota(
    team_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get team quota (admin only)."""
    require_admin(user)
    result = await db.execute(select(TeamQuota).where(TeamQuota.team_id == team_id))
    quota = result.scalar_one_or_none()
    if not quota:
        return QuotaResponse(team_id=team_id)
    return quota


@router.put("/team/{team_id}", response_model=QuotaResponse)
async def set_team_quota(
    team_id: str,
    req: QuotaUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set team quota limits (admin only, writes audit log)."""
    require_admin(user)

    result = await db.execute(select(TeamQuota).where(TeamQuota.team_id == team_id))
    quota = result.scalar_one_or_none()

    old_values = {}
    if quota:
        old_values = serialize_changes({
            "monthly_credit_limit": quota.monthly_credit_limit,
            "daily_call_limit": quota.daily_call_limit,
        })
    else:
        quota = TeamQuota(team_id=team_id)
        db.add(quota)

    new_values = req.model_dump(exclude_unset=True)
    for k, v in new_values.items():
        setattr(quota, k, v)
    quota.updated_at = datetime.now(timezone.utc)

    new_serialized = serialize_changes(new_values)
    db.add(QuotaUsageLog(
        user_id=user.id,
        team_id=team_id,
        skill_execution_id=str(uuid.uuid4()),
        credit_amount=Decimal("0"),
        action="admin_set",
        details=json.dumps({"old": old_values, "new": new_serialized, "admin_user_id": user.id}, ensure_ascii=False),
    ))

    await db.flush()

    audit = AuditContext(db, user.id)
    await audit.log("quota.team.set", "team_quota", team_id,
        changes={"quota": {"old": old_values, "new": new_serialized}})

    return quota
