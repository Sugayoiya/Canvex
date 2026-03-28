from datetime import datetime
from pydantic import BaseModel
from typing import Any

VALID_NODE_TYPES = {"text-input", "llm-generate", "extract", "image-gen", "output"}


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
