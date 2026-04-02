import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Text, Integer, Numeric, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TZDateTime, _utcnow


class AICallLog(Base):
    __tablename__ = "ai_call_logs"
    __table_args__ = (
        Index("ix_acl_user_created", "user_id", "created_at"),
        Index("ix_acl_team_created", "team_id", "created_at"),
        Index("ix_acl_project_created", "project_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trace_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    skill_execution_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    team_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    group_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    canvas_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    node_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    key_owner_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    key_owner_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    provider: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    model_type: Mapped[str] = mapped_column(String(20), nullable=False)
    api_endpoint: Mapped[str | None] = mapped_column(String(500), nullable=True)

    input_type: Mapped[str] = mapped_column(String(30), default="text")
    input_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    input_images_count: Mapped[int] = mapped_column(Integer, default=0)
    input_videos_count: Mapped[int] = mapped_column(Integer, default=0)

    output_type: Mapped[str] = mapped_column(String(30), default="text")
    output_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="success")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)

    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 8), nullable=True)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 6), nullable=True)
    pricing_model: Mapped[str | None] = mapped_column(String(20), nullable=True)

    input_unit_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 8), nullable=True)
    output_unit_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 8), nullable=True)
    pricing_snapshot_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    credential_source: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(TZDateTime, default=_utcnow)
