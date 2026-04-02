import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, Float, ForeignKey, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import SoftDeleteMixin, TZDateTime, _utcnow


class Canvas(Base, SoftDeleteMixin):
    __tablename__ = "canvases"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True
    )
    source_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    source_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    viewport: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(TZDateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime, default=_utcnow, onupdate=_utcnow
    )

    nodes = relationship(
        "CanvasNode", back_populates="canvas",
        cascade="save-update, merge", passive_deletes=True,
        order_by="CanvasNode.sort_order",
    )
    edges = relationship(
        "CanvasEdge", back_populates="canvas",
        cascade="save-update, merge", passive_deletes=True,
    )


class CanvasNode(Base):
    __tablename__ = "canvas_nodes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    canvas_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("canvases.id", ondelete="CASCADE"), nullable=False
    )
    node_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # text-input | llm-generate | extract | image-gen | output
    position_x: Mapped[float] = mapped_column(Float, default=0)
    position_y: Mapped[float] = mapped_column(Float, default=0)
    width: Mapped[float | None] = mapped_column(Float, nullable=True)
    height: Mapped[float | None] = mapped_column(Float, nullable=True)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="idle")
    result_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    result_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(TZDateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime, default=_utcnow, onupdate=_utcnow
    )

    canvas = relationship("Canvas", back_populates="nodes")


class CanvasEdge(Base):
    __tablename__ = "canvas_edges"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    canvas_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("canvases.id", ondelete="CASCADE"), nullable=False
    )
    source_node_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("canvas_nodes.id", ondelete="RESTRICT"), nullable=False
    )
    target_node_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("canvas_nodes.id", ondelete="RESTRICT"), nullable=False
    )
    source_handle: Mapped[str] = mapped_column(String(50), default="output")
    target_handle: Mapped[str] = mapped_column(String(50), default="input")

    created_at: Mapped[datetime] = mapped_column(TZDateTime, default=_utcnow)

    canvas = relationship("Canvas", back_populates="edges")
    source_node = relationship("CanvasNode", foreign_keys=[source_node_id])
    target_node = relationship("CanvasNode", foreign_keys=[target_node_id])
