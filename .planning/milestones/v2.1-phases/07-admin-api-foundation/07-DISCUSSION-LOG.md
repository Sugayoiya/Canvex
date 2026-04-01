# Phase 07: Admin API Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 07-admin-api-foundation
**Areas discussed:** Audit Log Scope, Admin Route Organization, User Ban Behavior, Dashboard KPI Strategy

---

## Audit Log Scope

### Q1: AdminAuditLog should record which operations?

| Option | Description | Selected |
|--------|-------------|----------|
| 仅写操作 | 用户状态切换、admin 权限变更、配额修改、Provider 配置变更等实际变更。失败不记录。 | |
| 写操作 + 失败尝试 | 全部写操作 + 被拒绝的操作（自降权、移除最后 admin）。用于安全审计。 | ✓ |
| 写操作 + 失败 + 关键读操作 | 全部 + admin 查看用户详情、导出日志等敏感读操作。最完整但数据量大。 | |

**User's choice:** 写操作 + 失败尝试
**Notes:** None

### Q2: old/new values storage format?

| Option | Description | Selected |
|--------|-------------|----------|
| JSON diff 字段 | 单个 `changes` JSON 列存储 `{"field": {"old": ..., "new": ...}}`，灵活通用 | ✓ |
| 结构化独立字段 | `old_value` + `new_value` 两个 text 列，简单但多字段变更需多行 | |
| Claude 决定 | | |

**User's choice:** JSON diff 字段
**Notes:** None

---

## Admin Route Organization

### Q1: Where should new admin-exclusive endpoints live?

| Option | Description | Selected |
|--------|-------------|----------|
| 统一 `/admin/*` 前缀 | 新端点放 `/admin/*`，现有 `/logs/*` `/quota/*` admin 逻辑保持不动 | ✓ |
| 全部迁移到 `/admin/*` | 新端点 + 现有 admin-only 端点全部迁移，形成隔离的 admin 路由空间。破坏现有 API。 | |
| Claude 决定 | | |

**User's choice:** 统一 `/admin/*` 前缀
**Notes:** 现有共用端点（logs, quota）保持原位，避免破坏现有前端调用

---

## User Ban Behavior

### Q1: Ban cascading effect on active sessions?

| Option | Description | Selected |
|--------|-------------|----------|
| 仅失效 refresh token（软封禁） | 当前 access token 仍有效（最长 30 分钟），到期自然退出。Celery 任务正常完成。 | |
| 失效 refresh token + access token 黑名单（硬封禁） | get_current_user 中增加 banned 检查，已发出 access token 立即失效。Celery 正常完成。 | |
| Claude 决定 | | ✓ |

**User's choice:** Claude 决定
**Notes:** 由实现阶段根据安全性和复杂度权衡

---

## Dashboard KPI Strategy

### Q1: Data computation approach?

| Option | Description | Selected |
|--------|-------------|----------|
| 实时查询 | 每次请求直接 COUNT/SUM，数据永远最新，大数据量时可能变慢 | ✓ |
| 定时缓存 | 后台定期计算写入缓存，API 读缓存，数据有延迟但响应快 | |
| Claude 决定 | | |

**User's choice:** 实时查询
**Notes:** 数据量大了考虑换 ClickHouse 等 OLAP 引擎，不在应用层缓存

### Q2: KPI time range definition?

| Option | Description | Selected |
|--------|-------------|----------|
| 固定窗口 | 24h 活跃/失败任务、本月累计成本。用户数和团队数全量。 | |
| 多窗口聚合 | 同时返回 24h / 7d / 30d 多个时间维度，前端可切换查看 | ✓ |
| Claude 决定 | | |

**User's choice:** 多窗口聚合
**Notes:** None

---

## Claude's Discretion

- 封禁级联行为具体策略
- AdminAuditLog 索引设计
- Dashboard 查询 SQL 优化
- admin 用户列表排序/筛选字段细节
- last-admin / self-demotion 安全防护实现方式

## Deferred Ideas

None
