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
    teams: list[str] = []
    last_login_at: datetime | None = None
    created_at: datetime
    monthly_credit_limit: float | None = None
    current_month_usage: float = 0
    daily_call_limit: int | None = None
    current_day_calls: int = 0

    model_config = {"from_attributes": True}


class AdminUserListResponse(BaseModel):
    items: list[AdminUserListItem]
    total: int
    limit: int
    offset: int
    admin_count: int


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
    owner_name: str | None = None
    monthly_credit_limit: float | None = None
    current_month_usage: float = 0
    daily_call_limit: int | None = None
    current_day_calls: int = 0

    model_config = {"from_attributes": True}


class AdminTeamListResponse(BaseModel):
    items: list[AdminTeamListItem]
    total: int
    limit: int
    offset: int


class AdminAlertsResponse(BaseModel):
    """Actionable alert counts for admin dashboard KPI card badges.

    Contract:
    - quota_warning_users: count of users where monthly_credit_limit IS NOT NULL
      AND monthly_credit_limit > 0 AND current_month_usage >= 80% of limit.
      NULL limits (unlimited quota) are excluded. Stale month counters accepted
      (lazy reset happens on user access, not in DB directly).
    - failed_tasks_24h: count of SkillExecutionLog rows with status='failed'
      AND queued_at >= now - 24 hours (UTC).
    - error_providers: count of AIProviderConfig rows with owner_type='system'
      AND is_enabled=False. This reflects admin-disabled providers, not runtime
      health — runtime errors surface via AI call log failure rates.
    """

    quota_warning_users: int
    failed_tasks_24h: int
    error_providers: int


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
