from datetime import datetime
from pydantic import BaseModel, field_validator
from typing import Any

VALID_NODE_TYPES = {"text", "image", "video", "audio"}


class CanvasCreate(BaseModel):
    project_id: str
    name: str | None = None


class CanvasUpdate(BaseModel):
    name: str | None = None
    viewport: dict[str, Any] | None = None


class CanvasResponse(BaseModel):
    id: str
    project_id: str
    name: str | None
    viewport: dict[str, Any] | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class NodeCreate(BaseModel):
    canvas_id: str
    node_type: str
    position_x: float = 0
    position_y: float = 0
    config: dict[str, Any] | None = None


class NodeUpdate(BaseModel):
    position_x: float | None = None
    position_y: float | None = None
    width: float | None = None
    height: float | None = None
    config: dict[str, Any] | None = None
    status: str | None = None
    result_text: str | None = None
    result_url: str | None = None
    error_message: str | None = None


class NodeResponse(BaseModel):
    id: str
    canvas_id: str
    node_type: str
    position_x: float
    position_y: float
    width: float | None = None
    height: float | None = None
    config: dict[str, Any] | None
    status: str
    result_url: str | None
    result_text: str | None
    error_message: str | None
    model_config = {"from_attributes": True}


class EdgeCreate(BaseModel):
    canvas_id: str
    source_node_id: str
    target_node_id: str
    source_handle: str = "output"
    target_handle: str = "input"


class EdgeResponse(BaseModel):
    id: str
    canvas_id: str
    source_node_id: str
    target_node_id: str
    source_handle: str
    target_handle: str
    model_config = {"from_attributes": True}


class CanvasDetailResponse(CanvasResponse):
    nodes: list[NodeResponse] = []
    edges: list[EdgeResponse] = []


# ---------------------------------------------------------------------------
# Batch execution schemas
# ---------------------------------------------------------------------------

class BatchExecuteRequest(BaseModel):
    canvas_id: str
    node_ids: list[str]

    @field_validator("node_ids")
    @classmethod
    def at_least_two(cls, v: list[str]) -> list[str]:
        if len(v) < 2:
            raise ValueError("Batch execution requires at least 2 nodes")
        return v


class BatchExecuteResponse(BaseModel):
    batch_id: str
    layers: list[list[str]]
    total_nodes: int


class BatchStatusResponse(BaseModel):
    batch_id: str
    layers: list[list[str]]
    node_statuses: dict[str, str]
    current_layer: int
    status: str


class BatchNodeUpdateRequest(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        allowed = {"queued", "running", "completed", "failed", "blocked", "timeout"}
        if v not in allowed:
            raise ValueError(f"Status must be one of {sorted(allowed)}")
        return v
