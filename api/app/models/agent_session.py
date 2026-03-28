"""Agent session and message persistence models.

# TODO: Phase 06 — add retention cron (delete messages older than 90 days
#       for archived sessions). Table growth manageable at current scale.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AgentSession(Base):
    __tablename__ = "agent_sessions"
    __table_args__ = (
        Index("ix_agent_sessions_project_canvas", "project_id", "canvas_id"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True
    )
    canvas_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_name: Mapped[str] = mapped_column(
        String(100), default="gemini-2.5-flash"
    )
    provider: Mapped[str] = mapped_column(String(50), default="gemini")
    status: Mapped[str] = mapped_column(String(20), default="active")
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    messages: Mapped[list["AgentMessage"]] = relationship(
        "AgentMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="AgentMessage.created_at",
    )


class AgentMessage(Base):
    __tablename__ = "agent_messages"
    __table_args__ = (
        Index("ix_agent_messages_session_created", "session_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("agent_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_calls_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tool_results_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pydantic_ai_messages_json: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    session: Mapped["AgentSession"] = relationship(
        "AgentSession", back_populates="messages"
    )
