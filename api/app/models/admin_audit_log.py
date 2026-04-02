import uuid
from datetime import datetime

from sqlalchemy import String, Text, Boolean, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TZDateTime, _utcnow


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"
    __table_args__ = (
        Index("ix_admin_audit_admin_created", "admin_user_id", "created_at"),
        Index("ix_admin_audit_target_created", "target_type", "target_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    action_type: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    target_type: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    target_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    changes: Mapped[str] = mapped_column(Text, nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, default=_utcnow, index=True)
