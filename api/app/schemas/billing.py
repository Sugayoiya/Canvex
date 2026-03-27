from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class PricingCreate(BaseModel):
    provider: str
    model: str
    model_type: str = "llm"
    pricing_model: str = "per_token"
    input_price_per_1k: Decimal | None = None
    output_price_per_1k: Decimal | None = None
    price_per_image: Decimal | None = None
    price_per_request: Decimal | None = None
    price_per_second: Decimal | None = None
    notes: str | None = None


class PricingUpdate(BaseModel):
    input_price_per_1k: Decimal | None = None
    output_price_per_1k: Decimal | None = None
    price_per_image: Decimal | None = None
    price_per_request: Decimal | None = None
    price_per_second: Decimal | None = None
    is_active: bool | None = None
    notes: str | None = None


class PricingResponse(BaseModel):
    id: str
    provider: str
    model: str
    model_type: str
    pricing_model: str
    input_price_per_1k: Decimal | None
    output_price_per_1k: Decimal | None
    price_per_image: Decimal | None
    price_per_request: Decimal | None
    price_per_second: Decimal | None
    is_active: bool
    notes: str | None
    effective_from: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UsageStatsResponse(BaseModel):
    provider: str
    model: str
    total_calls: int
    total_input_tokens: int
    total_output_tokens: int
    total_cost: Decimal
