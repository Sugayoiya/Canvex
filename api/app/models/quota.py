import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Integer, DateTime, Numeric, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserQuota(Base):
    __tablename__ = "user_quotas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), index=True, unique=True, nullable=False)
    monthly_credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    daily_call_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_month_usage: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("0"))
    current_day_calls: Mapped[int] = mapped_column(Integer, default=0)
    last_month_reset: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_day_reset: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TeamQuota(Base):
    __tablename__ = "team_quotas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id: Mapped[str] = mapped_column(String(36), index=True, unique=True, nullable=False)
    monthly_credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    daily_call_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_month_usage: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("0"))
    current_day_calls: Mapped[int] = mapped_column(Integer, default=0)
    last_month_reset: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_day_reset: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TeamMemberQuota(Base):
    __tablename__ = "team_member_quotas"
    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_member_quota"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    monthly_credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    daily_call_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_month_usage: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("0"))
    current_day_calls: Mapped[int] = mapped_column(Integer, default=0)
    last_month_reset: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_day_reset: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class QuotaUsageLog(Base):
    __tablename__ = "quota_usage_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    team_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    skill_execution_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    credit_amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("0"))
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # "check" | "increment" | "admin_set"
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
