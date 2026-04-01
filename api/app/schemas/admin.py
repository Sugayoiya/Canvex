import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator


class AdminAuditLogResponse(BaseModel):
    id: str
    admin_user_id: str
    action_type: str
    target_type: str
    target_id: str
    changes: dict
    success: bool
    error_message: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("changes", mode="before")
    @classmethod
    def _parse_changes(cls, v: object) -> dict:
        if isinstance(v, str):
            return json.loads(v)
        return v  # type: ignore[return-value]


class AdminMutationResult(BaseModel):
    ok: bool
    message: str
    audit_id: str | None = None


class AdminListMeta(BaseModel):
    total: int
    limit: int
    offset: int


class AdminUserListItem(BaseModel):
    id: str
    email: str
    nickname: str
    avatar: str | None = None
    status: str
    is_admin: bool
    last_login_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserListResponse(BaseModel):
    items: list[AdminUserListItem]
    total: int
    limit: int
    offset: int


class AdminUserStatusUpdate(BaseModel):
    status: Literal["active", "banned"]


class AdminUserRoleUpdate(BaseModel):
    is_admin: bool
