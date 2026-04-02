import uuid
from datetime import datetime
from sqlalchemy import String, Text, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import SoftDeleteMixin, TZDateTime, _utcnow


class CanvasAsset(Base, SoftDeleteMixin):
    __tablename__ = "canvas_assets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    created_by: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    asset_type: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    config_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    source_node_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(TZDateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime, default=_utcnow, onupdate=_utcnow
    )
