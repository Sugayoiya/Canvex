---
phase: 7
reviewers: [claude]
reviewed_at: 2026-04-01T18:00:00Z
plans_reviewed: [07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md]
---

# Cross-AI Plan Review — Phase 07

## Claude Review

### Plan 07-01: Audit Foundation (Wave 1)

#### Summary

扎实的基础设施计划。AdminAuditLog 模型设计与 D-01/D-02/D-03 完全对齐，`record_admin_audit()` 服务的单一入口点确保了一致性。索引设计（admin_user_id+created_at、target_type+target_id+created_at）对调查查询友好。测试覆盖了成功、失败和 payload 结构三条路径，是合理的最小验证集。

#### Strengths

- 清晰的关注点分离：model → service → schema → test，每层职责明确
- `changes` 列用 Text + json.dumps 是正确的跨数据库（SQLite/PostgreSQL）兼容策略
- Append-only 设计（不暴露 update/delete 端点）符合审计不可变性要求
- 复合索引设计合理，覆盖了 "谁做了什么" 和 "某个对象发生了什么" 两种查询维度
- `success` + `error_message` 双字段设计让拒绝操作也能被记录，满足 D-01

#### Concerns

- **MEDIUM — REQ-14 部分覆盖**: REQ-14 要求记录 "all admin mutations (user status, admin flag, quota, pricing, provider config)"。07-01 构建基础设施，07-02 给 user mutation 接入审计，但**现有的 quota (`/quota/*`)、pricing (`/billing/pricing/*`)、provider config (`/ai-providers/*`) 端点没有任何计划接入 `record_admin_audit`**。这意味着 Phase 07 完成后 REQ-14 实际只覆盖了 user 相关的 mutation。如果这是刻意推迟到 Phase 10/11 也可以，但需要明确标注 REQ-14 为 "partially addressed"，否则会造成验收误判。
- **LOW — `changes` 列查询能力有限**: Text 列存储 JSON 后无法在 DB 层做结构化查询（如 "找出所有 status 从 active 变成 banned 的操作"）。当前规模可接受，但如果未来审计分析需求增长，可能需要迁移到 PostgreSQL 的 JSONB 或者增加冗余列。考虑到 D-08 已声明未来走 OLAP 路线，这不是当前阻塞问题。
- **LOW — 无分页/查询端点**: 本计划只建了写入路径，审计日志的读取/查询端点未在三个计划中找到。Phase 07 ROADMAP 也没提到 `GET /admin/audit-logs`。前端 Phase 11 的 REQ-24 提到 "全站监控"，可能需要这个端点。建议确认是否该在 Phase 07 或 08 补充。

#### Suggestions

- 在 PLAN 或 CONTEXT 中明确标注 REQ-14 的 quota/pricing/provider audit wiring 推迟到哪个 Phase
- 考虑给 `record_admin_audit` 加一个 `ip_address: str | None` 参数，方便未来安全审计溯源（从 `Request` 对象获取）
- `AdminMutationResult` schema 的 `audit_id` 字段很好，可以让前端展示操作追溯链接

#### Risk Assessment

**LOW** — 这是一个纯基础设施计划，不会破坏已有功能。唯一风险是 REQ-14 覆盖度的认知偏差。

---

### Plan 07-02: Admin User Management (Wave 2)

#### Summary

用户管理 API 计划覆盖全面，端点设计（list + status toggle + admin toggle）与 REQ-13 精确对齐。安全防护（self-demotion block、last-admin block、refresh token 清除）考虑周到。审计发射同时覆盖成功和拒绝路径。测试计划有 5 个聚焦的集成测试，覆盖了最关键的行为路径。

#### Strengths

- 响应 schema 明确排除 `password_hash` 和 `refresh_token_hash`，避免 Pitfall 1
- Ban 操作同时清除 `refresh_token_hash` 和 `refresh_token_expires`，与已有 `get_current_user` banned 检查形成双重保障
- Last-admin 检查限定 `is_admin=True AND status="active"`，避免 Pitfall 4（把 banned admin 也算入）
- 审计同时记录成功和被拒操作（`success=False` + `error_message`），满足 D-01
- Sort allowlist 防止 SQL 注入，搜索用 ilike 实现模糊匹配

#### Concerns

- **MEDIUM — NULL 排序行为未定义**: `sort_by` 允许 `last_login_at`，但从未登录的用户该字段为 NULL。不同数据库对 NULL 排序行为不同（PostgreSQL: NULLS LAST by default, SQLite: NULLS FIRST）。建议在实现中统一加 `nullslast()` 或 `nullsfirst()` 包装，确保跨数据库一致性。
- **MEDIUM — 竞态条件**: last-admin 检查（count active admins → decide → update）存在 TOCTOU 竞态：两个并发请求同时降权最后两个 admin 时，count 检查都通过但实际会导致零 admin。当前用户规模下概率极低，但建议在代码注释或 PLAN 中明确此限制。生产环境可用 `SELECT ... FOR UPDATE` 解决。
- **LOW — 缺少对 "admin ban self" 的保护**: 计划有 self-demotion 保护（admin 不能撤销自己的 admin 权限），但没有提到 admin 是否能 ban 自己。虽然 ban 自己在业务上几乎不会发生，但加一个防护更安全。
- **LOW — 无批量操作**: 只有单用户操作，如果将来需要批量 ban/unban 会需要新端点。但当前需求没有提到批量操作，不是 scope creep。

#### Suggestions

- 在 `GET /admin/users` 返回中添加 `total` 总数字段（Plan 中的 `AdminUserListResponse` 已包含，确认实现一致）
- 考虑加 `reason: str | None` 参数到 status toggle，记录 ban 的原因（存入 audit changes 中）
- Status toggle 返回值改为 `AdminUserListItem` 很好，减少前端额外 refetch
- 代码验证 `sort_by` 是否在 allowlist 中时使用 dict mapping 而非 if-else，更优雅

#### Risk Assessment

**LOW-MEDIUM** — 核心逻辑清晰，主要风险在 NULL 排序跨数据库差异和极端场景下的竞态。两者在当前规模下都不是 blocker。

---

### Plan 07-03: Admin Observability (Wave 3)

#### Summary

可观测性计划分三个清晰任务：收紧 `/logs/*` scope、添加 `/admin/teams` + `/admin/dashboard`、集成测试。Dashboard 的 one-shot KPI payload 设计符合 D-10。但存在一些与现有代码对齐的问题需要注意。

#### Strengths

- 遵循 D-05 原则：不迁移现有 `/logs/*` 到 `/admin/*`，只增强过滤能力
- Dashboard 多时间窗口（24h/7d/30d）设计符合 D-09，一次调用返回所有 KPI 符合 D-10
- `provider_status`（enabled/disabled count）是有用的运维指标
- 测试计划覆盖了 authz（非 admin 403）和 behavior（scope 限制、payload 结构）

#### Concerns

- **HIGH — `/logs/*` 范围不完整**: Plan Task 1 说要为 `/logs/skills`、`/logs/ai-calls`、`/logs/ai-calls/stats`、`/logs/trace/{trace_id}` 添加 `team_id` 和 `project_id` 过滤器。**但实际 `logs.py` 还有 `/logs/tasks`、`/logs/tasks/counts`、`/logs/node-history/{node_id}` 三个端点**。其中 `/logs/tasks` 已有 `user_id` 和 `project_id` 过滤但缺少 `team_id`；`/logs/tasks/counts` 也缺少 `team_id` 和完整 admin scope 处理。Plan 必须覆盖所有 6 个 `/logs/*` 端点，否则 admin 使用时会遇到不一致行为。

  **现有 `/logs/*` 端点完整列表**:
  1. `GET /logs/skills` — 有 user_id filter, 缺 team_id/project_id ✗
  2. `GET /logs/ai-calls` — 有 user_id filter, 缺 team_id/project_id ✗
  3. `GET /logs/ai-calls/stats` — 有 user_id filter, 缺 team_id/project_id ✗
  4. `GET /logs/tasks` — 有 user_id/project_id filter, 缺 team_id ✗
  5. `GET /logs/tasks/counts` — 缺 user_id/team_id filter (admin 全量, 非 admin self-scoped) ✗
  6. `GET /logs/node-history/{node_id}` — 通过 canvas→project access 控制, 不需要额外 filter ✓
  7. `GET /logs/trace/{trace_id}` — admin/non-admin 已对称处理 ✓

- **MEDIUM — Dashboard 查询效率**: `active_tasks` 用 `status in ["queued", "running"]` 全表扫描 + 3 个时间窗口各做 COUNT/SUM = 至少 7+ 独立查询。在当前规模下可接受（D-08），但建议实现时用条件聚合（CASE WHEN）合并为 2-3 个查询，减少数据库往返。例如：

  ```sql
  SELECT
    COUNT(*) FILTER (WHERE created_at >= now() - interval '24h') as h24_total,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '7d') as d7_total,
    ...
  FROM skill_execution_logs
  ```

  注意 SQLite 不支持 `FILTER (WHERE ...)`，需要用 `CASE WHEN ... END` 替代。

- **MEDIUM — `provider_status` 语义模糊**: Plan 说 `enabled_count`/`disabled_count` from `AIProviderConfig`，但 `AIProviderConfig` 的 `is_enabled` 是 per-config (system/team/user level)，且有 `owner_type` 区分。Dashboard 应该只统计 `owner_type='system'` 的 provider 配置还是所有级别？需要明确。建议只统计 system-level，与 "系统管理员视角" 一致。

- **MEDIUM — Teams 端点缺分页**: `GET /admin/teams` 返回 "all teams"。如果团队数量增长，一次性返回所有团队会有性能问题。建议加 limit/offset 分页，与 user list 一致。

- **LOW — Test 3 (`test_logs_trace_scope_non_admin_forbidden_for_other_trace`) 描述不准确**: 现有 trace 端点对非 admin 的行为不是返回 403，而是只返回属于当前用户的行。即非 admin 查询别人的 trace 会得到空结果（skills: [], ai_calls: []），不是 forbidden。测试断言需要与实际行为对齐。

#### Suggestions

- 把 `/logs/tasks`、`/logs/tasks/counts` 加入 Task 1 的修改范围，确保所有 log 端点的 admin filter 行为一致
- Dashboard 查询用条件聚合减少 DB round-trip，同时注意 SQLite/PostgreSQL 语法差异
- `GET /admin/teams` 加 limit/offset + optional `q` search 参数
- `provider_status` 明确限定 `owner_type='system'` 范围

#### Risk Assessment

**MEDIUM** — 核心关注点是 `/logs/*` 端点覆盖不完整（HIGH 级别的遗漏），如果不修复会导致前端 admin 全局日志视图出现部分端点没有跨用户过滤能力的不一致问题。Dashboard 查询效率是 MEDIUM 但 D-08 已声明当前不优化。

---

## Consensus Summary

### Agreed Strengths

- **架构一致性好**: 三个计划严格遵循已有代码模式（`require_admin` guard、`Depends(get_current_user)` auth、Pydantic schemas、SQLAlchemy async queries）
- **安全考虑全面**: 响应排除敏感字段、ban 清除 refresh token、self-demotion/last-admin 防护、admin guard 在所有 `/admin/*` 端点
- **决策对齐度高**: 计划与 D-01 到 D-10 的用户决策完全一致，没有偏离
- **Wave 依赖合理**: 01(基础) → 02(用户管理) → 03(可观测性) 的依赖链清晰，每个 wave 产出独立可测试
- **测试策略务实**: 每个计划都有聚焦的测试（authz + behavior + payload），而非追求覆盖率数字

### Agreed Concerns

1. **HIGH — `/logs/*` 端点覆盖不完整**: Plan 07-03 遗漏了 `/logs/tasks`、`/logs/tasks/counts` 的 admin filter 增强。需要补充。
2. **MEDIUM — REQ-14 审计接入不完整**: Phase 07 完成后只有 user mutation 被审计，quota/pricing/provider 的审计接入没有计划。需要明确是推迟还是补充。
3. **MEDIUM — NULL 排序跨数据库差异**: `last_login_at` 排序在 SQLite vs PostgreSQL 行为不同，需要实现时统一处理。
4. **MEDIUM — Dashboard provider_status 范围未明确**: 需要确认是统计 system-level 还是所有级别的 provider config。

### Action Items

| # | 严重度 | 建议行动 |
|---|--------|----------|
| 1 | HIGH | 07-03 Task 1 补充 `/logs/tasks` 和 `/logs/tasks/counts` 的 `team_id` filter + admin scope 一致性 |
| 2 | MEDIUM | 在 Phase CONTEXT 或 PLAN 中明确 REQ-14 余下 audit 接入的时间表 |
| 3 | MEDIUM | 07-02 实现时为 `last_login_at` 排序加 `nullslast()`/`nullsfirst()` |
| 4 | MEDIUM | 07-03 明确 `provider_status` 只统计 `owner_type='system'` |
| 5 | LOW | 考虑 `GET /admin/teams` 加分页参数 |
| 6 | LOW | 考虑给 `record_admin_audit` 预留 `ip_address` 参数 |

---

*Review completed by Claude (running in Cursor IDE)*
*Plans authored by Codex*
*Review date: 2026-04-01*
