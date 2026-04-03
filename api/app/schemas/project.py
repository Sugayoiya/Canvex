from datetime import datetime

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    owner_type: str = "personal"
    owner_id: str | None = None

class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    global_style: str | None = None
    aspect_ratio: str | None = None
    settings: dict | None = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    owner_type: str
    owner_id: str
    created_by: str | None = None
    aspect_ratio: str | None = None
    settings: dict | None = None
    created_at: datetime
    updated_at: datetime
    canvas_count: int = 0

    model_config = {"from_attributes": True}

class ProjectCloneRequest(BaseModel):
    target_owner_type: str
    target_owner_id: str
