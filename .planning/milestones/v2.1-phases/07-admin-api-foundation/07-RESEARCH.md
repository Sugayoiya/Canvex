# Phase 07: Admin API Foundation - Research

**Researched:** 2026-04-01
**Domain:** FastAPI admin backend APIs (authorization, audit logging, observability, KPI aggregation)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 记录所有 admin 写操作 + 失败/被拒绝的尝试（如自降权、移除最后一个 admin）。不记录纯读操作。
- **D-02:** 变更值存储格式：单个 `changes` JSON 列，格式为 `{"field": {"old": "active", "new": "banned"}}`。一次操作改多个字段时全部记录在同一行的 JSON 中。
- **D-03:** AdminAuditLog 模型字段：admin_user_id, action_type, target_type, target_id, changes (JSON), success (bool), error_message (nullable), created_at。Append-only，不可修改删除。
- **D-04:** 新的 admin 专属端点统一放在 `/admin/*` 前缀下（用户管理、审计日志查询、团队概览、dashboard 统计）。新建 `admin.py` 路由文件。
- **D-05:** 现有 `/logs/*` 和 `/quota/*` 中的 admin 内联权限逻辑保持不动。它们是共用端点（普通用户看自己的，admin 看全部的），不迁移到 `/admin/*`。
- **D-06:** 所有 `/admin/*` 端点统一使用 `require_admin` guard，403 拒绝非管理员。
- **D-08:** Dashboard 聚合指标实时查询（COUNT/SUM），不做缓存。当前数据规模可接受。未来数据量大时演进方向是 ClickHouse 等 OLAP 引擎，而非应用层缓存。
- **D-09:** 时间维度指标（任务统计、成本统计）返回多窗口聚合：24h / 7d / 30d 三个时间维度。用户数和团队数是全量统计，不分时间窗。
- **D-10:** Dashboard API 一次调用返回所有 KPI（`GET /admin/dashboard`），前端无需多次请求。

### the agent's Discretion
- 封禁级联行为的具体策略（D-07）
- AdminAuditLog 的索引设计
- Dashboard 查询的 SQL 优化策略
- admin 用户列表的排序/筛选字段细节
- last-admin / self-demotion 安全防护的具体实现方式

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<research_summary>
## Summary

The codebase already has the right primitives for Phase 07: `require_admin` and banned-user checks exist in `deps.py`, user/admin fields exist on `User`, and `/logs/*` endpoints already implement admin visibility patterns (`if not user.is_admin` then scope to current user). This means Phase 07 should be implemented as targeted extensions, not a rewrite.

The major gap is structured admin mutation auditing. Today quota updates log into `QuotaUsageLog.details`, but there is no dedicated immutable audit table covering all admin mutations (user status/admin-role changes, quota edits, pricing CRUD, provider config/key operations). A shared audit service is the cleanest path: one helper with explicit `action_type`, `target_type`, `target_id`, and structured `changes` payload.

For API surface, backend should add a dedicated `/admin` router with `GET /admin/users`, `PATCH /admin/users/{id}/status`, `PATCH /admin/users/{id}/admin`, `GET /admin/teams`, and `GET /admin/dashboard`. Existing `/logs/*` endpoints remain shared per D-05, but Phase 07 should tighten filter coverage and tests so admin cross-user scope is explicitly verified for `/logs/skills`, `/logs/ai-calls`, `/logs/ai-calls/stats`, and `/logs/trace/{trace_id}`.

**Primary recommendation:** Build a small admin domain layer (`AdminAuditLog` model + `record_admin_audit()` service + admin schemas/router) and back it with endpoint-level tests that assert both authorization and audit emissions.
</research_summary>

<phase_requirements>
## Phase Requirements Coverage Intent

| Requirement | Research-backed implementation direction |
|-------------|------------------------------------------|
| REQ-13 | New `/admin/users` endpoints with pagination/search/filter/sort + status/admin toggles + guardrails + response schemas that omit sensitive fields |
| REQ-14 | New `AdminAuditLog` append-only model + unified audit helper used by admin mutation endpoints |
| REQ-15 | Keep shared `/logs/*` endpoints, ensure admin cross-user filters are explicit and tested; add `/admin/teams` aggregate endpoint |
| REQ-16 | Add `GET /admin/dashboard` with one payload containing user/team/task/cost/provider KPIs and 24h/7d/30d windows |
</phase_requirements>

<codebase_findings>
## Verified Codebase Findings

- `api/app/core/deps.py`
  - `require_admin(user)` already enforces 403 for non-admin.
  - `get_current_user()` already blocks `status == "banned"` users with 403.
- `api/app/api/v1/logs.py`
  - `/logs/skills`, `/logs/ai-calls`, `/logs/ai-calls/stats`, `/logs/trace/{trace_id}` already contain admin bypass logic.
  - Endpoints are shared and should remain under `/logs/*` per D-05.
- `api/app/models/user.py`
  - Fields already support admin flows: `is_admin`, `status`, `refresh_token_hash`, `last_login_at`.
- `api/app/api/v1/quota.py`, `api/app/api/v1/billing.py`, `api/app/api/v1/ai_providers.py`
  - Existing admin-only mutations are present; these are key integration points to emit unified admin audit records.
- `api/tests/conftest.py`
  - Existing async app/test setup can be extended with admin/non-admin dependency overrides for API assertions.
</codebase_findings>

<architecture_patterns>
## Recommended Architecture Patterns

### Pattern 1: Dedicated immutable admin audit model
- Add `api/app/models/admin_audit_log.py` with append-only write path.
- Columns: `id`, `admin_user_id`, `action_type`, `target_type`, `target_id`, `changes` (JSON/Text), `success`, `error_message`, `created_at`.
- Add indexes on `(admin_user_id, created_at)` and `(target_type, target_id, created_at)` for investigative queries.

### Pattern 2: Shared `record_admin_audit()` service
- Add `api/app/services/admin_audit.py` helper with explicit signature:
  - `record_admin_audit(db, admin_user_id, action_type, target_type, target_id, changes, success=True, error_message=None)`
- Call this helper from every admin mutation endpoint, including rejected operations (self-demotion, last-admin revoke).

### Pattern 3: Split admin router modules by concern
- Keep implementation split to reduce merge conflicts:
  - `api/app/api/v1/admin_users.py`
  - `api/app/api/v1/admin_observability.py`
- Register both in `api/app/api/v1/router.py`.

### Pattern 4: Dashboard aggregation with one query pass per metric family
- Use async SQLAlchemy `select(func.count(...), func.sum(...))` with time windows:
  - 24h, 7d, 30d for task/cost activity
  - lifetime totals for users/teams
- Keep response deterministic and front-end-ready in a single payload (D-10).
</architecture_patterns>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Leaking sensitive user fields in admin list responses
- What goes wrong: returning ORM `User` objects directly can expose `password_hash` or `refresh_token_hash`.
- How to avoid: always return explicit response schema (`AdminUserListItem`) with allowlisted fields only.

### Pitfall 2: Missing audit writes on failure paths
- What goes wrong: only successful mutations are logged, losing forensic visibility.
- How to avoid: call `record_admin_audit(..., success=False, error_message=...)` before raising known business-rule rejections.

### Pitfall 3: Inconsistent admin guard behavior across new endpoints
- What goes wrong: some `/admin/*` endpoints forget to call `require_admin`.
- How to avoid: enforce guard at top of every handler and add tests asserting 403 for non-admin on each `/admin/*` route.

### Pitfall 4: Wrong “last admin” safeguard logic
- What goes wrong: counting all admins (including banned users) can allow removing final active admin.
- How to avoid: count admins with `is_admin == True` and `status == "active"` for demotion safeguards.
</common_pitfalls>

## Validation Architecture

Nyquist validation strategy for this phase:
- Coverage anchors:
  - Endpoint authz gate tests (`403` for non-admin on all `/admin/*`)
  - Behavior tests for user status/admin toggles and safeguards
  - Audit emission tests (success + rejection)
  - Logs scope tests for admin vs non-admin visibility
  - Dashboard payload shape + non-null KPI fields
- Fast loop command: `cd api && uv run pytest api/tests/test_admin_* -q`
- Full loop command: `cd api && uv run pytest api/tests/ -q`
- Evidence style:
  - Endpoint-level assertions + schema field assertions
  - Direct DB assertions on `AdminAuditLog` insertions

<sources>
## Sources

### Primary (HIGH confidence)
- Local codebase:
  - `api/app/core/deps.py`
  - `api/app/api/v1/logs.py`
  - `api/app/api/v1/quota.py`
  - `api/app/api/v1/billing.py`
  - `api/app/api/v1/ai_providers.py`
  - `api/app/models/user.py`
  - `api/tests/conftest.py`
- Planning context:
  - `.planning/phases/07-admin-api-foundation/07-CONTEXT.md`
  - `.planning/ROADMAP.md`
  - `.planning/REQUIREMENTS.md`
</sources>

<metadata>
## Metadata

**Research scope:** Admin API backend only (no frontend)
**Confidence breakdown:**
- Authorization patterns: HIGH
- Audit model/service design: HIGH
- Dashboard aggregation approach: MEDIUM-HIGH (data shape clear, scale tuning deferred)
- Test strategy: HIGH

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (or next major schema/API shift)
</metadata>

---

*Phase: 07-admin-api-foundation*
*Research completed: 2026-04-01*
*Ready for planning: yes*
