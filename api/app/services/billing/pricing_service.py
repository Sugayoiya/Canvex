from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_pricing import ModelPricing


async def calculate_cost(
    provider: str,
    model: str,
    model_type: str = "llm",
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    db_session: AsyncSession | None = None,
) -> Decimal | None:
    """Look up active pricing and compute cost. Returns None if no pricing found."""
    if db_session is None:
        from app.core.database import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            return await _do_calc(
                session, provider, model, model_type, input_tokens, output_tokens
            )
    return await _do_calc(
        db_session, provider, model, model_type, input_tokens, output_tokens
    )


async def calculate_cost_with_snapshot(
    provider: str,
    model: str,
    model_type: str = "llm",
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    db_session: AsyncSession | None = None,
) -> dict[str, Any] | None:
    """Calculate cost and return price snapshot for auditability."""
    if db_session is None:
        from app.core.database import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            return await _do_calc_with_snapshot(
                session, provider, model, model_type, input_tokens, output_tokens
            )
    return await _do_calc_with_snapshot(
        db_session, provider, model, model_type, input_tokens, output_tokens
    )


async def _do_calc(
    session: AsyncSession,
    provider: str,
    model: str,
    model_type: str,
    input_tokens: int | None,
    output_tokens: int | None,
) -> Decimal | None:
    pricing = await _lookup_pricing(session, provider, model)
    if not pricing:
        return None
    return _compute_cost(pricing, input_tokens, output_tokens)


async def _do_calc_with_snapshot(
    session: AsyncSession,
    provider: str,
    model: str,
    model_type: str,
    input_tokens: int | None,
    output_tokens: int | None,
) -> dict[str, Any] | None:
    pricing = await _lookup_pricing(session, provider, model)
    if not pricing:
        return None
    cost = _compute_cost(pricing, input_tokens, output_tokens)
    return {
        "cost": cost,
        "input_unit_price": pricing.input_price_per_1k,
        "output_unit_price": pricing.output_price_per_1k,
        "pricing_id": pricing.id,
    }


async def _lookup_pricing(
    session: AsyncSession, provider: str, model: str
) -> ModelPricing | None:
    result = await session.execute(
        select(ModelPricing)
        .where(
            ModelPricing.provider == provider,
            ModelPricing.model == model,
            ModelPricing.is_active == True,  # noqa: E712
        )
        .order_by(ModelPricing.effective_from.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def _compute_cost(
    pricing: ModelPricing,
    input_tokens: int | None,
    output_tokens: int | None,
) -> Decimal:
    cost = Decimal("0")
    if pricing.pricing_model == "per_token":
        if input_tokens and pricing.input_price_per_1k:
            cost += (
                Decimal(str(input_tokens))
                / Decimal("1000")
                * pricing.input_price_per_1k
            )
        if output_tokens and pricing.output_price_per_1k:
            cost += (
                Decimal(str(output_tokens))
                / Decimal("1000")
                * pricing.output_price_per_1k
            )
    elif pricing.pricing_model == "per_image" and pricing.price_per_image:
        cost = pricing.price_per_image
    elif pricing.pricing_model == "per_request" and pricing.price_per_request:
        cost = pricing.price_per_request
    return cost
