from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    model_name: str | None = None
    provider: str | None = None


class SessionCreateRequest(BaseModel):
    project_id: str
    canvas_id: str | None = None
    title: str | None = None
    model_name: str | None = None
    provider: str | None = None  # deprecated — backend auto-resolves from model_name


class SessionResponse(BaseModel):
    id: str
    project_id: str
    canvas_id: str | None
    user_id: str
    title: str | None
    model_name: str
    provider: str
    status: str
    message_count: int
    total_tokens: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str | None
    tool_calls_json: Any | None
    tool_results_json: Any | None
    input_tokens: int
    output_tokens: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    sessions: list[SessionResponse]
    total: int


class MessageListResponse(BaseModel):
    messages: list[MessageResponse]
    total: int
