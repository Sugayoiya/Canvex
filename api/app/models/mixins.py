from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column


def _utcnow():
    return datetime.now(timezone.utc)


TZDateTime = DateTime(timezone=True)


class SoftDeleteMixin:
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = _utcnow()

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(TZDateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime, default=_utcnow, onupdate=_utcnow
    )
