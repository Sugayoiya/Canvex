from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class QuotaResponse(BaseModel):
    user_id: str | None = None
    team_id: str | None = None
    monthly_credit_limit: Decimal | None = None
    daily_call_limit: int | None = None
    current_month_usage: Decimal = Decimal("0")
    current_day_calls: int = 0

    model_config = {"from_attributes": True}


class QuotaUpdate(BaseModel):
    monthly_credit_limit: Decimal | None = Field(None, ge=0)
    daily_call_limit: int | None = Field(None, ge=0)


class QuotaCheckResult(BaseModel):
    allowed: bool
    reason: str = ""
    error_code: str = ""
    current_usage: Decimal = Decimal("0")
    limit: Decimal | None = None
