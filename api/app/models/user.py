import uuid
from datetime import datetime
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TZDateTime, _utcnow


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    avatar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="active")
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(TZDateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, default=_utcnow, onupdate=_utcnow)

    refresh_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    refresh_token_expires: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)

    team_memberships = relationship("TeamMember", back_populates="user", cascade="all, delete-orphan")
