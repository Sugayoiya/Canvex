# Phase 08: Admin Frontend Shell - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the admin frontend foundation — AdminGuard route guard (building on existing implementation), independent AdminShell layout with AdminSidebar, admin route structure with placeholder pages, API client extensions (`adminApi` + `quotaApi`), new dependencies (`@tanstack/react-table`, `sonner`), and conditional "Admin Console" entry in the main Sidebar. No functional admin pages in this phase — those are Phases 09–11.

</domain>

<decisions>
## Implementation Decisions

### Admin Layout & Shell Structure
- **D-01:** AdminShell 与现有 AppShell 完全独立 — 新建 `AdminShell` + `AdminSidebar` 组件，不共享 AppShell 代码。视觉风格一致（使用 `--ob-*` tokens），但布局组件分离。
- **D-02:** AdminSidebar 固定展开（始终显示图标+文字），不支持折叠。导航项只有 7-8 个，固定展开最清晰。
- **D-03:** "Back to App" 放在 AdminShell 的 Topbar 左上角（返回箭头 + 文字），而非侧边栏底部。AdminSidebar 只放导航项。

### Admin Route Organization
- **D-04:** Claude's Discretion — 路由文件结构（`app/admin/` 直接建 vs `app/(admin)/admin/` route group）由 Claude 根据 Next.js 16 最佳实践决定。
- **D-05:** 所有导航目标都创建 placeholder 页面（Dashboard / Users / Teams / Quotas / Pricing / Providers / Monitoring），每个 `page.tsx` 包含标题 + 空状态提示，方便完整验证侧边栏路由和 layout 集成。
- **D-06:** Code splitting 依赖 Next.js App Router 自动按路由 code split，不需要额外的 `next/dynamic` 懒加载。`app/admin/` 下的页面只在用户访问 `/admin/*` 时才加载。

### API Client Namespaces
- **D-07:** 按 REQ-18 要求新建 `adminApi` + `quotaApi` 双命名空间，复用现有 `billingApi`（pricing CRUD 已在）和 `aiProvidersApi`（system provider 已在）。
- **D-08:** `adminApi` 覆盖 `/admin/*` 端点：`listUsers()`、`toggleUserStatus()`、`toggleUserAdmin()`、`listTeams()`、`getDashboard()`。
- **D-09:** `quotaApi` 覆盖 `/quota/*` admin 端点：`getUserQuota()`、`updateUserQuota()`、`getTeamQuota()`、`updateTeamQuota()`。
- **D-10:** Phase 08 即全部定义好所有方法签名，后续 Phase 09-11 直接使用，不再反复编辑 `api.ts`。

### Main Sidebar Admin Entry
- **D-11:** "Admin Console" 入口放在 Sidebar 底部区域，在 Billing 下方，用一条细分隔线与普通 BOTTOM_ITEMS 区分。仅 `user.is_admin` 时条件渲染。
- **D-12:** 入口视觉样式与其他导航项一致（图标 + 文字，使用 lucide-react 图标），分隔线已起到区分作用，不需要额外强调色。

### Claude's Discretion
- AdminShell 的 Topbar 具体布局（返回按钮位置、标题显示等）
- AdminSidebar 的图标选择（lucide-react 图标库）
- Placeholder 页面的具体空状态文案和视觉
- sonner Toaster 的 Obsidian Lens 主题配置细节
- 路由文件结构选择（直接 `app/admin/` 或 route group）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §v2.1 — REQ-17 (admin route guard and layout), REQ-18 (admin API client and dependencies)

### Existing AdminGuard
- `web/src/components/auth/admin-guard.tsx` — **已存在的 AdminGuard**，checks `is_admin` via `authApi.me()` refresh，currently used by `/settings/ai`。Phase 08 应在此基础上构建，而非从头实现。

### Existing Layout Pattern
- `web/src/components/layout/app-shell.tsx` — 现有 AppShell（Sidebar + Topbar + main），AdminShell 视觉风格应对齐
- `web/src/components/layout/sidebar.tsx` — 现有 Sidebar（NAV_ITEMS + BOTTOM_ITEMS 结构），需添加 Admin Console 入口
- `web/src/components/layout/topbar.tsx` — 现有 Topbar，AdminShell Topbar 可参考

### Auth & Store
- `web/src/stores/auth-store.ts` — `User.is_admin` 已在接口定义中
- `web/src/components/auth/auth-guard.tsx` — AuthGuard hydration 模式参考

### API Client
- `web/src/lib/api.ts` — 现有 API client，新增 `adminApi` + `quotaApi` 命名空间

### Theming
- `web/src/app/globals.css` — Obsidian Lens `--ob-*` tokens 完整定义

### Backend Admin Endpoints
- `api/app/api/v1/admin_users.py` — `/admin/users` (GET), `/admin/users/{id}/status` (PATCH), `/admin/users/{id}/admin` (PATCH)
- `api/app/api/v1/admin_observability.py` — `/admin/teams` (GET), `/admin/dashboard` (GET)
- `api/app/api/v1/quota.py` — `/quota/user/{id}` (GET/PUT), `/quota/team/{id}` (GET/PUT) — admin-guarded
- `api/app/api/v1/billing.py` — `/billing/pricing/` CRUD — admin-guarded
- `api/app/api/v1/ai_providers.py` — system-scope provider management — admin-guarded

### Prior Phase Context
- `.planning/phases/06-collaboration-prod/06-CONTEXT.md` — Obsidian Lens 决策、AuthGuard 模式、Space Grotesk/Manrope 字体
- `.planning/phases/07-admin-api-foundation/07-CONTEXT.md` — Admin 后端 API 设计决策

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AdminGuard` (`web/src/components/auth/admin-guard.tsx`): 已实现 `is_admin` 校验 + `authApi.me()` 刷新，可直接复用或微调
- `AppShell` (`web/src/components/layout/app-shell.tsx`): AdminShell 的视觉风格参考（flex 布局、`--ob-surface-base`、dot grid 背景）
- `Sidebar` (`web/src/components/layout/sidebar.tsx`): NAV_ITEMS/BOTTOM_ITEMS 结构参考 + Admin Console 入口需修改此文件
- `Topbar` (`web/src/components/layout/topbar.tsx`): AdminShell 可参考 Topbar 样式
- Obsidian Lens `--ob-*` tokens 已在 `globals.css` 完整定义
- `lucide-react` 已安装，可用于 AdminSidebar 图标

### Established Patterns
- Inline styles with `--ob-*` CSS custom properties（Phase 06 确立的风格）
- `useAuthStore()` + hydration 门闩模式（AuthGuard/AdminGuard 共用）
- React Query for server state, Zustand for client state
- Axios API client 以命名空间对象组织（`authApi`, `billingApi` 等）

### Integration Points
- `web/src/lib/api.ts` — 新增 `adminApi` + `quotaApi` 导出
- `web/src/components/layout/sidebar.tsx` — 新增 Admin Console 条件入口
- `web/src/app/admin/` — 全新路由目录（layout + placeholder pages）
- `web/src/components/admin/` — AdminShell + AdminSidebar 新组件
- `web/package.json` — 安装 `@tanstack/react-table` + `sonner`

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

*Phase: 08-admin-frontend-shell*
*Context gathered: 2026-04-01*
