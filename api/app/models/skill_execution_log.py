import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Text, Integer, Numeric, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TZDateTime, _utcnow


class SkillExecutionLog(Base):
    __tablename__ = "skill_execution_logs"
    __table_args__ = (
        Index("ix_sel_status_queued", "status", "queued_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trace_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    skill_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    skill_category: Mapped[str] = mapped_column(String(30), nullable=False)

    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    team_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    episode_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    canvas_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    node_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    agent_session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    trigger_source: Mapped[str] = mapped_column(String(20), default="user_ui")

    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    input_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(50), nullable=True)

    queued_at: Mapped[datetime] = mapped_column(TZDateTime, default=_utcnow)
    started_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    ai_call_count: Mapped[int] = mapped_column(Integer, default=0)
    total_input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 6), nullable=True)
