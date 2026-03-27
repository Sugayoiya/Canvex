from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user, require_admin
from app.models.model_pricing import ModelPricing
from app.models.ai_call_log import AICallLog
from app.schemas.billing import (
    PricingCreate,
    PricingUpdate,
    PricingResponse,
    UsageStatsResponse,
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

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(pricing, field, value)
    pricing.updated_at = datetime.utcnow()
    await db.flush()
    await db.refresh(pricing)
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
    pricing.updated_at = datetime.utcnow()
    await db.flush()
    return {"detail": "Pricing deactivated"}


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

    if not getattr(user, "is_admin", False):
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
