# Phase 07: Admin API Foundation - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Build all backend admin endpoints and data models needed by the admin console — user management (list/search/filter/sort, status toggle, admin role toggle), structured audit trail (`AdminAuditLog`), log scope lifts for admin cross-user queries, team overview API, and dashboard aggregation endpoint. No frontend work in this phase.

</domain>

<decisions>
## Implementation Decisions

### Audit Log Scope
- **D-01:** 记录所有 admin 写操作 + 失败/被拒绝的尝试（如自降权、移除最后一个 admin）。不记录纯读操作。
- **D-02:** 变更值存储格式：单个 `changes` JSON 列，格式为 `{"field": {"old": "active", "new": "banned"}}`。一次操作改多个字段时全部记录在同一行的 JSON 中。
- **D-03:** AdminAuditLog 模型字段：admin_user_id, action_type, target_type, target_id, changes (JSON), success (bool), error_message (nullable), created_at。Append-only，不可修改删除。

### Admin Route Organization
- **D-04:** 新的 admin 专属端点统一放在 `/admin/*` 前缀下（用户管理、审计日志查询、团队概览、dashboard 统计）。新建 `admin.py` 路由文件。
- **D-05:** 现有 `/logs/*` 和 `/quota/*` 中的 admin 内联权限逻辑保持不动。它们是共用端点（普通用户看自己的，admin 看全部的），不迁移到 `/admin/*`。
- **D-06:** 所有 `/admin/*` 端点统一使用 `require_admin` guard，403 拒绝非管理员。

### User Ban Behavior
- **D-07:** Claude's Discretion — 封禁级联行为（仅失效 refresh token vs 同时在 get_current_user 中拦截 banned 状态）由实现阶段根据安全性和复杂度权衡决定。已提交的 Celery 任务不中断。

### Dashboard KPI Strategy
- **D-08:** Dashboard 聚合指标实时查询（COUNT/SUM），不做缓存。当前数据规模可接受。未来数据量大时演进方向是 ClickHouse 等 OLAP 引擎，而非应用层缓存。
- **D-09:** 时间维度指标（任务统计、成本统计）返回多窗口聚合：24h / 7d / 30d 三个时间维度。用户数和团队数是全量统计，不分时间窗。
- **D-10:** Dashboard API 一次调用返回所有 KPI（`GET /admin/dashboard`），前端无需多次请求。

### Claude's Discretion
- 封禁级联行为的具体策略（D-07）
- AdminAuditLog 的索引设计
- Dashboard 查询的 SQL 优化策略
- admin 用户列表的排序/筛选字段细节
- last-admin / self-demotion 安全防护的具体实现方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §v2.1 — REQ-13 (admin user management API), REQ-14 (audit trail), REQ-15 (log scope lifting), REQ-16 (dashboard stats)

### Existing Admin Infrastructure
- `api/app/core/deps.py` — `require_admin` guard, `get_current_user` (already checks `status=="banned"`), role priority dicts
- `api/app/models/user.py` — User model (is_admin, status, refresh_token_hash fields)
- `api/app/api/v1/logs.py` — Existing log endpoints with inline admin scope lifting (is_admin bypass pattern)
- `api/app/api/v1/quota.py` — Existing admin-only quota endpoints (require_admin pattern, QuotaUsageLog audit trail)

### Models & Schemas
- `api/app/models/team.py` — Team/TeamMember/Group/GroupMember models (for team overview aggregation)
- `api/app/schemas/user.py` — UserSearchResult, UserProfileResponse (reference for admin response schemas)
- `api/app/models/ai_call_log.py` — AICallLog model (for cost aggregation in dashboard)
- `api/app/models/skill_execution_log.py` — SkillExecutionLog model (for task stats in dashboard)

### Route Registration
- `api/app/api/v1/router.py` — Route aggregation (new admin router must be registered here)

### Prior Phase Context
- `.planning/phases/06-collaboration-prod/06-CONTEXT.md` — Phase 06 decisions on org hierarchy, auth, billing dimensions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `require_admin(user)` in `deps.py` — simple guard function, already used by quota/billing endpoints
- `get_current_user` already checks `user.status == "banned"` and raises 403 — ban enforcement on access token level is already in place
- `logs.py` admin scope pattern: `if not user.is_admin: stmt = stmt.where(...user_id == user.id)` — established pattern for admin cross-user queries
- `QuotaUsageLog` with JSON `details` field — existing audit trail pattern (but not structured, AdminAuditLog should be more formal)
- `User` model has `status` field (default "active") and `refresh_token_hash` — ban toggle can set status + clear refresh_token_hash

### Established Patterns
- FastAPI router with `APIRouter(prefix=..., tags=[...])` per resource
- `Depends(get_current_user)` + `require_admin(user)` for admin authorization
- Pydantic response models in `schemas/` directory
- SQLAlchemy async queries with `select().where().offset().limit()`
- JSON response with manual dict construction (not all endpoints use response_model)

### Integration Points
- `api/app/api/v1/router.py` — new admin router must be included here
- `api/app/core/database.py` — new AdminAuditLog model auto-created via `metadata.create_all()`
- `api/app/models/` — new model file for AdminAuditLog
- `api/app/schemas/` — new schema file for admin request/response types

</code_context>

<specifics>
## Specific Ideas

- 数据量大了换 ClickHouse 等 OLAP 引擎做聚合，不在应用层做缓存
- Dashboard 多窗口聚合（24h/7d/30d）让 admin 快速了解不同时间维度的趋势

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-admin-api-foundation*
*Context gathered: 2026-04-01*
