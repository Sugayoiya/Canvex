import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, DateTime, Text, Numeric, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import _utcnow


class ModelPricing(Base):
    __tablename__ = "model_pricing"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    provider: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    model_type: Mapped[str] = mapped_column(String(20), nullable=False)
    pricing_model: Mapped[str] = mapped_column(String(20), nullable=False)

    input_price_per_1k: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 8), nullable=True
    )
    output_price_per_1k: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 8), nullable=True
    )
    price_per_image: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 8), nullable=True
    )
    price_per_second: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 8), nullable=True
    )
    price_per_request: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 8), nullable=True
    )

    effective_from: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow
    )
    effective_to: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow
    )
