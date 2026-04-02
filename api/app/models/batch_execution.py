import uuid
from datetime import datetime

from sqlalchemy import Column, String, JSON, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TZDateTime


class BatchExecution(Base):
    __tablename__ = "batch_executions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    canvas_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    layers: Mapped[dict] = mapped_column(JSON, nullable=False)
    node_statuses: Mapped[dict] = mapped_column(JSON, nullable=False)
    current_layer: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="running")
    total_nodes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at = Column(TZDateTime, server_default=func.now())
