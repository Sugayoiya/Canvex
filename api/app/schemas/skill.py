from typing import Any
from pydantic import BaseModel


class SkillInfo(BaseModel):
    name: str
    display_name: str
    description: str
    category: str
    execution_mode: str
    estimated_duration: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]


class SkillInvokeRequest(BaseModel):
    skill_name: str
    params: dict[str, Any] = {}
    project_id: str | None = None
    canvas_id: str | None = None
    node_id: str | None = None
    model_name: str | None = None


class SkillResultResponse(BaseModel):
    status: str
    task_id: str | None = None
    data: dict[str, Any] = {}
    artifacts: list[dict[str, Any]] = []
    message: str = ""
    progress: float = 1.0


class SkillPollRequest(BaseModel):
    task_id: str
