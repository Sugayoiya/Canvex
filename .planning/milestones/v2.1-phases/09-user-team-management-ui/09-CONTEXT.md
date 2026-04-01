# Phase 09: User & Team Management UI - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the admin user directory page (paginated TanStack Table with server-side sort, search, status/admin filter, row actions) and team overview page (read-only all-teams table). Includes a small backend extension to add `teams` field to `GET /admin/users`. All interactions flow through React Query with `['admin', ...]` query keys. No admin team drill-down page — that's deferred to future phases.

</domain>

<decisions>
## Implementation Decisions

### Row Actions & Status Display
- **D-01:** 用户表每行末尾使用 **Row Dropdown 菜单**（「...」按钮 → 展开操作列表），操作包括：Toggle Status (Ban/Enable)、Toggle Admin (Grant/Revoke)。空间最省，未来扩展操作无需改表格列结构。
- **D-02:** 用户状态和管理员标记使用 **彩色 Badge 标签** — 绿色 "Active" / 红色 "Banned" 用于 status 列，紫色 "Admin" 标签用于 admin 列（非管理员不显示标签）。

### Confirmation Modals
- **D-03:** Claude's Discretion — 确认弹窗形式（居中 modal / popover / 其他）由 Claude 根据操作危险等级和需要展示的信息量（如 last-admin 警告、self-demotion 提示）选择。危险操作（封禁）确认按钮应使用红色。

### Team Overview
- **D-04:** 团队概览表 **纯展示、不可点击**，不提供 drill-down 跳转。避免 AdminShell → AppShell 的布局上下文切换。Admin 专属团队详情页作为未来 feature（REQ-F03）。

### Search, Filter & Pagination
- **D-05:** Claude's Discretion — 搜索框与筛选控件的排列布局由 Claude 根据 Obsidian Lens 风格和信息密度决定。筛选包含 status filter（All/Active/Banned）和 admin filter（All/Admin/Non-admin）。搜索支持 name 和 email，300ms debounce（per REQ-19）。
- **D-06:** 分页使用 **传统页码导航** — 底部显示页码（1, 2, 3...）+ 上一页/下一页按钮 + 总数显示（如 "Showing 1-20 of 156 users"）。用户表和团队表统一使用此分页方式。

### Sorting
- **D-07:** 单列排序，默认 `created_at` desc。列头点击切换 asc/desc 方向，当前排序列显示箭头指示器。后端支持的排序字段：`created_at`、`last_login_at`、`email`。

### Backend Extension: Teams Field
- **D-08:** Phase 09 需要扩展后端 `GET /admin/users` 端点，给 `AdminUserListItem` schema 增加 `teams` 字段（每个用户所属团队名列表或数量），通过 JOIN 查询实现。确保 REQ-19 "teams" 列完整满足。同步更新前端 `adminApi.listUsers` 的类型定义。

### Toast Feedback
- **D-09:** sonner toast 使用 **具体反馈** — 成功时包含用户邮箱和操作结果（如 "已封禁 john@example.com"、"已授予 alice@example.com 管理员权限"），失败时展示后端返回的错误信息。

### Last Admin Safeguard
- **D-10:** 当系统只剩一个管理员时，Dropdown 菜单中 "Revoke Admin" 选项 **直接禁用（置灰）+ tooltip 提示** "Cannot revoke — last admin"。从源头阻止误操作，无需进入确认弹窗。

### Claude's Discretion
- 确认弹窗的具体形式和样式（D-03）
- 搜索与筛选的具体布局排列（D-05）
- 表格空状态、加载骨架屏、错误状态的具体实现
- Badge 标签的具体色值（在 --ob-* 体系内选择）
- 团队表列宽和信息展示细节

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §v2.1 — REQ-19 (admin user management UI), REQ-20 (admin team overview UI)

### Backend Admin Endpoints (to wire)
- `api/app/api/v1/admin_users.py` — `GET /admin/users` (paginated, search, filter, sort), `PATCH /admin/users/{id}/status`, `PATCH /admin/users/{id}/admin`
- `api/app/api/v1/admin_observability.py` — `GET /admin/teams` (paginated, search)
- `api/app/schemas/admin.py` — `AdminUserListItem`, `AdminUserListResponse`, `AdminTeamListItem`, `AdminTeamListResponse`, `AdminUserStatusUpdate`, `AdminUserRoleUpdate`

### Frontend Admin Shell (Phase 08 output)
- `web/src/components/admin/admin-shell.tsx` — AdminShell layout (独立于 AppShell)
- `web/src/components/admin/admin-sidebar.tsx` — AdminSidebar 导航
- `web/src/components/admin/admin-topbar.tsx` — AdminTopbar（含 Back to App）
- `web/src/app/admin/users/page.tsx` — 现有 placeholder 页面，Phase 09 替换为完整实现
- `web/src/app/admin/teams/page.tsx` — 现有 placeholder 页面，Phase 09 替换为完整实现

### API Client
- `web/src/lib/api.ts` — `adminApi.listUsers()`, `adminApi.toggleUserStatus()`, `adminApi.toggleUserAdmin()`, `adminApi.listTeams()` 方法已定义

### Theming & Styling
- `web/src/app/globals.css` — Obsidian Lens `--ob-*` tokens + `--cv4-*` tokens
- `.planning/phases/06-collaboration-prod/06-CONTEXT.md` — Obsidian Lens 决策、inline styles with CSS custom properties 风格

### Prior Phase Decisions
- `.planning/phases/07-admin-api-foundation/07-CONTEXT.md` — Admin 后端 API 设计（audit log、ban behavior、dashboard）
- `.planning/phases/08-admin-frontend-shell/08-CONTEXT.md` — AdminShell 布局、API client namespace、路由结构、sonner/TanStack Table 安装

### Dependencies
- `@tanstack/react-table` ^8.21 — 已安装，用于用户表和团队表
- `sonner` ^2.0 — 已安装，用于 toast 反馈
- `lucide-react` — 已安装，用于图标

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AdminShell` + `AdminSidebar` + `AdminTopbar` (`web/src/components/admin/`): Phase 08 产出，独立于 AppShell 的 admin 布局
- `adminApi` (`web/src/lib/api.ts`): `listUsers()`、`toggleUserStatus()`、`toggleUserAdmin()`、`listTeams()` 方法签名已就绪
- Obsidian Lens `--ob-*` + `--cv4-*` CSS tokens 已在 `globals.css` 完整定义
- `lucide-react` 图标库已安装
- `useAuthStore()` + hydration 模式（AdminGuard 已使用）

### Established Patterns
- Inline styles with `--ob-*` / `--cv4-*` CSS custom properties（Phase 06/08 确立）
- React Query for server state, Zustand for client state
- Axios API client 以命名空间对象组织（`adminApi`, `quotaApi` 等）
- `['admin', 'users']` / `['admin', 'teams']` React Query key 约定

### Integration Points
- `web/src/app/admin/users/page.tsx` — 替换 placeholder 为完整用户管理页
- `web/src/app/admin/teams/page.tsx` — 替换 placeholder 为完整团队概览页
- `api/app/api/v1/admin_users.py` — 扩展 `list_users` endpoint 增加 teams 字段
- `api/app/schemas/admin.py` — 扩展 `AdminUserListItem` schema 增加 teams 字段
- `api/app/models/user.py` + `api/app/models/team.py` — JOIN 查询获取用户团队关联

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

- **Admin 专属团队详情页** (`/admin/teams/[id]`) — admin 视角的团队管理（强制移除成员、查看团队配额/活动统计），对应 REQ-F03。当前 Phase 09 团队表纯展示不跳转，避免 AdminShell → AppShell 布局切换的割裂体验。

</deferred>

---

*Phase: 09-user-team-management-ui*
*Context gathered: 2026-04-01*
