# Phase 11: Monitoring Dashboard & Polish - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the admin dashboard landing page with actionable KPI cards (click-to-navigate + alert badges), global monitoring views (task logs, AI call logs, skill execution logs, usage/cost time-series) in a tabbed monitoring page, and polish all admin pages (Phases 08-10) for production quality — loading skeletons, error boundaries, empty states. Includes a backend `GET /admin/alerts` endpoint for actionable dashboard data and API client extensions for monitoring.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Actionable KPI Cards
- **D-01:** KPI 卡片可点击跳转到对应子页面（Total Users → `/admin/users`，Active Tasks → `/admin/monitoring` 等）。异常指示（如"3 at quota limit"、"5 failed in 24h"）直接用红色/警告色 badge 嵌入卡片，利用现有 160px 高度空间。不需要额外的 Attention 面板。

### Monitoring Page Structure
- **D-02:** Monitoring 使用单页多 Tab 结构（Tasks | AI Calls | Skills | Usage & Cost），复用 Phase 10 的 `TabBar` 组件，Tab 状态用 `useState` 管理。侧边栏保持单一 Monitoring 入口不变，URL 不变。

### Component Reuse Strategy
- **D-03:** Admin 监控日志表格全部新建（`components/admin/` 下），使用已有的 AdminDataTable + AdminPagination + FilterToolbar 模式，保持 admin 区域自治和鉴权隔离。普通用户组件（TaskMonitorPage 等）不复用——数据 scope 不同（全用户 vs 单用户），API endpoint 不同，admin 多了 user_id/team_id 跨用户筛选维度。Recharts 纯展示组件（UsageChart、ProviderPieChart）可直接复用——它们只接收 `data` prop，不涉及鉴权和数据获取。

### Usage/Cost Visualization Placement
- **D-04:** Usage/Cost 时序图和 breakdown 放在 Monitoring 页面作为第 4 个 Tab（Usage & Cost）。Dashboard 保持纯 KPI 卡片 + 时间窗口统计 + Provider 状态，不放图表，确保 REQ-25 一屏不滚动约束。

### Dashboard Backend Data Gap
- **D-05:** 新增独立 `GET /admin/alerts` endpoint 返回异常数据（quota_warning_users count、failed_tasks_24h count、error_providers count 等），与现有 `GET /admin/dashboard` 职责分离。Dashboard 页面并行请求两个 API（dashboard + alerts）。

### Polish Scope
- **D-06:** 全量审查 Phase 08-10 所有 admin 页面（Users、Teams、Quotas、Pricing、Providers），统一补齐 loading skeletons、error boundaries、empty states 三态。确保 milestone 交付时所有 admin 页面视觉和交互一致。

### API Client Namespace
- **D-07:** 所有 monitoring 相关 API 方法扩展到 `adminApi` 命名空间（`listSkillLogs()`、`listAiCallLogs()`、`getAiCallStats()`、`getTrace()`、`getAlerts()`），保持 admin 所有 API 集中管理，与 Phase 08 D-07/D-08 策略一致。

### Claude's Discretion
- Dashboard KPI 卡片跳转的具体交互（hover 效果、cursor pointer 提示）
- Monitoring 各 Tab 的具体筛选字段组合和排列
- `GET /admin/alerts` 的具体 response schema 设计（哪些异常指标、阈值定义）
- 各日志表格的列定义和排序字段
- Error boundary 的具体实现方式（React Error Boundary 组件 vs try-catch）
- Loading skeleton 的具体样式（复用 AdminDataTable 内置 vs 自定义）
- Bundle isolation 验证方式（Next.js App Router 自动 code split 是否足够）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §v2.1 — REQ-24 (admin monitoring dashboard), REQ-25 (admin dashboard landing page)

### Backend Endpoints (existing, to wire)
- `api/app/api/v1/logs.py` — `GET /logs/skills` (admin cross-user query), `GET /logs/ai-calls` (admin cross-user query), `GET /logs/ai-calls/stats`, `GET /logs/trace/{trace_id}`
- `api/app/api/v1/admin_observability.py` — `GET /admin/dashboard` (aggregate KPIs + window stats), `GET /admin/teams`
- `api/app/api/v1/billing.py` — `GET /billing/usage/stats` (time-series data)

### Backend Endpoints (to create)
- `api/app/api/v1/admin_observability.py` — `GET /admin/alerts` (new — actionable alert counts for dashboard cards)

### Frontend Admin Pages (existing)
- `web/src/app/admin/page.tsx` — Dashboard page (Phase 08 output, has KPI cards + window toggle + provider status; needs actionable enhancement)
- `web/src/app/admin/monitoring/page.tsx` — Placeholder page (replace with full monitoring implementation)
- `web/src/app/admin/users/page.tsx` — Users page (Phase 09, needs polish audit)
- `web/src/app/admin/teams/page.tsx` — Teams page (Phase 09, needs polish audit)
- `web/src/app/admin/quotas/page.tsx` — Quotas page (Phase 10, needs polish audit)
- `web/src/app/admin/pricing/page.tsx` — Pricing page (Phase 10, needs polish audit)
- `web/src/app/admin/providers/page.tsx` — Providers page (Phase 10, needs polish audit)

### Reusable Admin Components (Phase 09/10 output)
- `web/src/components/admin/admin-data-table.tsx` — TanStack Table wrapper (loading/error/empty states, sort indicators)
- `web/src/components/admin/admin-pagination.tsx` — Page navigation with total count
- `web/src/components/admin/filter-toolbar.tsx` — Search + filter controls
- `web/src/components/admin/tab-bar.tsx` — Tab component (Phase 10 output)
- `web/src/components/admin/status-badge.tsx` — Colored status badge
- `web/src/components/admin/progress-bar.tsx` — Progress visualization

### Reusable Recharts Components (can reuse data→UI layer)
- `web/src/components/billing/usage-chart.tsx` — Recharts LineChart (period/calls/cost/tokens)
- `web/src/components/billing/provider-pie-chart.tsx` — Recharts PieChart (provider breakdown)

### API Client
- `web/src/lib/api.ts` — `adminApi` namespace (needs monitoring method extensions), `billingApi` (usage stats reference)

### Theming & Styling
- `web/src/app/globals.css` — Obsidian Lens `--ob-*` tokens + `--cv4-*` tokens

### Prior Phase Context
- `.planning/phases/08-admin-frontend-shell/08-CONTEXT.md` — AdminShell layout, API client namespaces, sonner theming
- `.planning/phases/09-user-team-management-ui/09-CONTEXT.md` — AdminDataTable/Pagination/FilterToolbar patterns, toast feedback
- `.planning/phases/10-quota-pricing-provider-management-ui/10-CONTEXT.md` — TabBar, ProgressBar, card patterns, modal patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AdminDataTable` (`web/src/components/admin/admin-data-table.tsx`): TanStack Table wrapper with sort, skeleton loading, error/empty states — reuse for all monitoring log tables
- `AdminPagination` (`web/src/components/admin/admin-pagination.tsx`): Page navigation — reuse for all monitoring log tables
- `FilterToolbar` (`web/src/components/admin/filter-toolbar.tsx`): Search + filter controls — reuse with monitoring-specific filters
- `TabBar` (`web/src/components/admin/tab-bar.tsx`): Tab switching component — reuse for Monitoring page 4-tab layout
- `StatusBadge` (`web/src/components/admin/status-badge.tsx`): Colored badge — reuse for task/log status display
- `ProgressBar` (`web/src/components/admin/progress-bar.tsx`): Progress visualization — potential reuse for quota warnings
- `KpiCard` (inline in `admin/page.tsx`): Dashboard KPI card — enhance with click handler and alert badge
- `WindowToggle` (inline in `admin/page.tsx`): Time window selector (24h/7d/30d) — already working
- `UsageChart` (`web/src/components/billing/usage-chart.tsx`): Recharts time-series — reuse for admin Usage & Cost tab (pure data→UI)
- `ProviderPieChart` (`web/src/components/billing/provider-pie-chart.tsx`): Recharts pie chart — reuse for provider breakdown (pure data→UI)
- `adminApi` (`web/src/lib/api.ts`): getDashboard() ready, needs monitoring method extensions
- `sonner` toast: already configured with Obsidian Lens theming at admin layout level

### Established Patterns
- Inline styles with `--ob-*` / `--cv4-*` CSS custom properties (Phase 06/08/09/10)
- React Query with `['admin', ...]` query keys (Phase 09/10)
- sonner toast with specific feedback messages (Phase 09 D-09)
- 300ms debounce search (Phase 09/10)
- Server-side pagination with offset/limit params
- Admin cross-user query via `is_admin` check in backend (logs.py)
- `refetchInterval: 60_000` for dashboard auto-refresh

### Integration Points
- `web/src/app/admin/page.tsx` — Enhance existing KPI cards with click-to-navigate + alert badges
- `web/src/app/admin/monitoring/page.tsx` — Replace placeholder with 4-tab monitoring page
- `web/src/lib/api.ts` — Add `adminApi.listSkillLogs()`, `.listAiCallLogs()`, `.getAiCallStats()`, `.getTrace()`, `.getAlerts()`
- `api/app/api/v1/admin_observability.py` — Add `GET /admin/alerts` endpoint
- All admin pages (users/teams/quotas/pricing/providers) — Polish pass for loading/error/empty states

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-monitoring-dashboard-polish*
*Context gathered: 2026-04-01*
