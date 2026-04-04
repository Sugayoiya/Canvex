import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TZDateTime, _utcnow


class AgentArtifact(Base):
    __tablename__ = "agent_artifacts"
    __table_args__ = (
        Index("ix_agent_artifacts_session_kind", "session_id", "skill_kind"),
        Index("ix_agent_artifacts_session_created", "session_id", "created_at"),
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
    skill_kind: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    execution_log_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("skill_execution_logs.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(TZDateTime, default=_utcnow)
