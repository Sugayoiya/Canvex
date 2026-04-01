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


class AdminTeamListItem(BaseModel):
    id: str
    name: str
    description: str | None = None
    created_at: datetime
    member_count: int

    model_config = {"from_attributes": True}


class AdminTeamListResponse(BaseModel):
    items: list[AdminTeamListItem]
    total: int
    limit: int
    offset: int


class AdminDashboardWindowStats(BaseModel):
    tasks_total: int
    tasks_failed: int
    cost_total: float


class AdminProviderStatus(BaseModel):
    enabled_count: int
    disabled_count: int


class AdminDashboardResponse(BaseModel):
    total_users: int
    total_teams: int
    active_tasks: int
    total_cost: float
    provider_status: AdminProviderStatus
    windows: dict[str, AdminDashboardWindowStats]
