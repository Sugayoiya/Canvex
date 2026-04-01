import uuid
from datetime import datetime
from sqlalchemy import (
    String, Integer, Boolean, DateTime, Text, ForeignKey,
    Index, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class AIProviderConfig(Base, TimestampMixin):
    __tablename__ = "ai_provider_configs"
    __table_args__ = (
        Index("ix_provider_owner", "provider_name", "owner_type", "owner_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider_name: Mapped[str] = mapped_column(String(50), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    owner_type: Mapped[str] = mapped_column(String(20), nullable=False, default="system")
    owner_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    keys = relationship("AIProviderKey", back_populates="provider_config", cascade="all, delete-orphan")


class AIProviderKey(Base, TimestampMixin):
    __tablename__ = "ai_provider_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider_config_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_provider_configs.id"), nullable=False, index=True,
    )
    api_key_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    key_hint: Mapped[str | None] = mapped_column(String(8), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    rate_limit_rpm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_count: Mapped[int] = mapped_column(Integer, default=0)

    provider_config = relationship("AIProviderConfig", back_populates="keys")


class AIModelConfig(Base, TimestampMixin):
    __tablename__ = "ai_model_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    model_type: Mapped[str] = mapped_column(String(20), nullable=False)
    capabilities: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    provider_mappings = relationship(
        "AIModelProviderMapping", back_populates="model_config", cascade="all, delete-orphan",
    )


class AIModelProviderMapping(Base):
    __tablename__ = "ai_model_provider_mappings"
    __table_args__ = (
        UniqueConstraint("model_config_id", "provider_config_id", name="uq_model_provider"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    model_config_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_model_configs.id"), nullable=False, index=True,
    )
    provider_config_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_provider_configs.id"), nullable=False, index=True,
    )
    priority: Mapped[int] = mapped_column(Integer, default=0)

    model_config = relationship("AIModelConfig", back_populates="provider_mappings")
    provider_config = relationship("AIProviderConfig")
