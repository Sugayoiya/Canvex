from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, String, cast
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db, get_current_user, require_admin
from app.models.model_pricing import ModelPricing
from app.services.admin_audit import AuditContext, serialize_changes
from app.models.ai_call_log import AICallLog
from app.schemas.billing import (
    PricingCreate,
    PricingUpdate,
    PricingResponse,
    UsageStatsResponse,
    TimeSeriesPoint,
    TimeSeriesResponse,
)

router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/pricing/", response_model=PricingResponse)
async def create_pricing(
    body: PricingCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    require_admin(user)
    pricing = ModelPricing(**body.model_dump())
    db.add(pricing)
    await db.flush()
    await db.refresh(pricing)

    audit = AuditContext(db, user.id)
    await audit.log("pricing.create", "model_pricing", pricing.id,
        changes={"pricing": {"old": None, "new": {"provider": pricing.provider, "model": pricing.model, "pricing_model": pricing.pricing_model}}})

    return pricing


@router.get("/pricing/", response_model=list[PricingResponse])
async def list_pricing(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    stmt = select(ModelPricing)
    if active_only:
        stmt = stmt.where(ModelPricing.is_active == True)  # noqa: E712
    stmt = stmt.order_by(ModelPricing.provider, ModelPricing.model)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/pricing/{pricing_id}", response_model=PricingResponse)
async def update_pricing(
    pricing_id: str,
    body: PricingUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    require_admin(user)
    result = await db.execute(
        select(ModelPricing).where(ModelPricing.id == pricing_id)
    )
    pricing = result.scalar_one_or_none()
    if not pricing:
        raise HTTPException(status_code=404, detail="Pricing not found")

    update_fields = body.model_dump(exclude_unset=True)
    old_values = serialize_changes({k: getattr(pricing, k) for k in update_fields})

    for field, value in update_fields.items():
        setattr(pricing, field, value)
    pricing.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(pricing)

    audit = AuditContext(db, user.id)
    await audit.log("pricing.update", "model_pricing", pricing_id,
        changes={"pricing": {"old": old_values, "new": serialize_changes(update_fields)}})

    return pricing


@router.delete("/pricing/{pricing_id}")
async def delete_pricing(
    pricing_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    require_admin(user)
    result = await db.execute(
        select(ModelPricing).where(ModelPricing.id == pricing_id)
    )
    pricing = result.scalar_one_or_none()
    if not pricing:
        raise HTTPException(status_code=404, detail="Pricing not found")

    pricing.is_active = False
    pricing.updated_at = datetime.now(timezone.utc)
    await db.flush()

    audit = AuditContext(db, user.id)
    await audit.log("pricing.deactivate", "model_pricing", pricing_id,
        changes={"is_active": {"old": True, "new": False}})

    return {"detail": "Pricing deactivated"}


@router.get("/usage-timeseries/", response_model=TimeSeriesResponse)
async def get_usage_timeseries(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    granularity: str = Query("day", pattern="^(hour|day|week)$"),
    project_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    # UTC normalization at query boundary
    if start_date.tzinfo is not None:
        start_date = start_date.astimezone(timezone.utc).replace(tzinfo=None)
    if end_date.tzinfo is not None:
        end_date = end_date.astimezone(timezone.utc).replace(tzinfo=None)

    if settings.USE_SQLITE:
        fmt_map = {"hour": "%Y-%m-%d %H:00", "day": "%Y-%m-%d", "week": "%Y-%W"}
        date_group = func.strftime(fmt_map[granularity], AICallLog.created_at)
    else:
        date_group = cast(
            func.date_trunc(granularity, AICallLog.created_at), String
        )

    stmt = select(
        date_group.label("period"),
        func.count().label("calls"),
        func.coalesce(func.sum(AICallLog.cost), 0).label("cost"),
        func.coalesce(
            func.sum(AICallLog.input_tokens + AICallLog.output_tokens), 0
        ).label("tokens"),
    )

    if not user.is_admin:
        stmt = stmt.where(AICallLog.user_id == user.id)

    stmt = stmt.where(
        AICallLog.created_at >= start_date,
        AICallLog.created_at <= end_date,
    )
    if project_id:
        stmt = stmt.where(AICallLog.project_id == project_id)

    stmt = stmt.group_by("period").order_by("period")
    result = await db.execute(stmt)
    rows = result.all()

    return TimeSeriesResponse(
        granularity=granularity,
        points=[
            TimeSeriesPoint(
                period=str(row.period),
                calls=row.calls,
                cost=row.cost,
                tokens=row.tokens,
            )
            for row in rows
        ],
    )


@router.get("/usage-stats/", response_model=list[UsageStatsResponse])
async def get_usage_stats(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    project_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    stmt = select(
        AICallLog.provider,
        AICallLog.model,
        func.count().label("total_calls"),
        func.coalesce(func.sum(AICallLog.input_tokens), 0).label("total_input_tokens"),
        func.coalesce(func.sum(AICallLog.output_tokens), 0).label(
            "total_output_tokens"
        ),
        func.coalesce(func.sum(AICallLog.cost), 0).label("total_cost"),
    )

    if not user.is_admin:
        stmt = stmt.where(AICallLog.user_id == user.id)

    if start_date:
        stmt = stmt.where(AICallLog.created_at >= start_date)
    if end_date:
        stmt = stmt.where(AICallLog.created_at <= end_date)
    if project_id:
        stmt = stmt.where(AICallLog.project_id == project_id)

    stmt = stmt.group_by(AICallLog.provider, AICallLog.model)
    result = await db.execute(stmt)
    rows = result.all()

    return [
        UsageStatsResponse(
            provider=row.provider,
            model=row.model,
            total_calls=row.total_calls,
            total_input_tokens=row.total_input_tokens,
            total_output_tokens=row.total_output_tokens,
            total_cost=row.total_cost,
        )
        for row in rows
    ]
