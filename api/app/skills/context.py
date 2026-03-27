from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SkillContext:
    """Carries identity and tracing info across Skill invocations and Celery tasks."""

    trace_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    team_id: str | None = None
    project_id: str | None = None
    episode_id: str | None = None
    canvas_id: str | None = None
    node_id: str | None = None
    agent_session_id: str | None = None
    trigger_source: str = "user_ui"   # "user_ui" | "agent" | "pipeline" | "celery_beat"
    ip_address: str | None = None
    request_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "trace_id": self.trace_id,
            "user_id": self.user_id,
            "team_id": self.team_id,
            "project_id": self.project_id,
            "episode_id": self.episode_id,
            "canvas_id": self.canvas_id,
            "node_id": self.node_id,
            "agent_session_id": self.agent_session_id,
            "trigger_source": self.trigger_source,
            "ip_address": self.ip_address,
            "request_id": self.request_id,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> SkillContext:
        return cls(
            trace_id=d.get("trace_id", str(uuid.uuid4())),
            user_id=d.get("user_id", ""),
            team_id=d.get("team_id"),
            project_id=d.get("project_id"),
            episode_id=d.get("episode_id"),
            canvas_id=d.get("canvas_id"),
            node_id=d.get("node_id"),
            agent_session_id=d.get("agent_session_id"),
            trigger_source=d.get("trigger_source", "user_ui"),
            ip_address=d.get("ip_address"),
            request_id=d.get("request_id"),
        )
