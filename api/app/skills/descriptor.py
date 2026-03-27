from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class SkillCategory(str, Enum):
    TEXT = "TEXT"
    EXTRACT = "EXTRACT"
    SCRIPT = "SCRIPT"
    STORYBOARD = "STORYBOARD"
    VISUAL = "VISUAL"
    SLASH = "SLASH"
    MEDIA = "MEDIA"
    AUDIO = "AUDIO"
    VIDEO = "VIDEO"
    CANVAS = "CANVAS"
    PIPELINE = "PIPELINE"
    ASSET = "ASSET"


@dataclass
class SkillDescriptor:
    name: str
    display_name: str
    description: str
    category: SkillCategory
    input_schema: dict[str, Any]
    output_schema: dict[str, Any] = field(default_factory=dict)
    triggers: list[str] = field(default_factory=list)
    execution_mode: str = "async_celery"  # "sync" | "async_celery"
    celery_queue: str = "ai_generation"   # ai_generation | media_processing | pipeline | quick
    estimated_duration: str = "medium"    # "quick" (<10s) | "medium" (10s-2min) | "long" (>2min)
    requires_canvas: bool = False
    requires_project: bool = False

    def to_tool_definition(self) -> dict[str, Any]:
        """Convert to OpenAI Function Calling format."""
        safe_name = self.name.replace(".", "_")
        return {
            "type": "function",
            "function": {
                "name": safe_name,
                "description": self.description,
                "parameters": self.input_schema,
            },
        }


@dataclass
class SkillResult:
    status: str = "completed"   # "completed" | "running" | "failed" | "queued"
    task_id: str | None = None
    data: dict[str, Any] = field(default_factory=dict)
    artifacts: list[dict[str, Any]] = field(default_factory=list)
    message: str = ""
    progress: float = 1.0       # 0.0 ~ 1.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "task_id": self.task_id,
            "data": self.data,
            "artifacts": self.artifacts,
            "message": self.message,
            "progress": self.progress,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> SkillResult:
        return cls(
            status=d.get("status", "completed"),
            task_id=d.get("task_id"),
            data=d.get("data", {}),
            artifacts=d.get("artifacts", []),
            message=d.get("message", ""),
            progress=d.get("progress", 1.0),
        )

    @classmethod
    def running(cls, task_id: str, message: str = "任务已提交") -> SkillResult:
        return cls(status="running", task_id=task_id, message=message, progress=0.0)

    @classmethod
    def failed(cls, message: str, error_code: str | None = None) -> SkillResult:
        return cls(status="failed", message=message, data={"error_code": error_code} if error_code else {})
