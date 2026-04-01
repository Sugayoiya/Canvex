# Phase 10: Quota & Pricing & Provider Management UI - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire existing backend quota/pricing/provider APIs into three admin management pages. Quota page: user/team picker with search, display current usage vs limits, inline edit. Pricing page: model pricing CRUD table with create/edit modal, deactivate toggle. Provider page: system-scope provider card list with key management. All pages replace Phase 08 placeholder pages. No new backend endpoints — all APIs already exist.

</domain>

<decisions>
## Implementation Decisions

### Quota Page Layout
- **D-01:** 双 Tab 布局（Users | Teams）— 顶部 Tab 切换用户/团队视图，每个 Tab 有独立搜索和结果列表。用户/团队配额结构不同，分开展示更清晰。
- **D-02:** 实时搜索（300ms debounce）— 与 Phase 09 Users 页一致的交互模式，复用 `adminApi.listUsers()` 和 `adminApi.listTeams()` 搜索能力。
- **D-03:** 简洁列表风格 — 每行显示名称 + 邮箱/成员数 + 配额摘要（月度用量/上限），信息密度适中。
- **D-04:** 展开行编辑 — 点击行在下方展开配额详情 + 编辑表单，一次只展开一行，不离开列表上下文。

### Quota Display & Editing
- **D-05:** 进度条 + 数字可视化 — 每个配额维度（monthly_credit_limit、daily_call_limit）显示进度条 + 右侧数字"42/100"，三级颜色：绿 (0-60%) → 黄 (60-85%) → 红 (85-100%)。
- **D-06:** 展开区内直接编辑 — 配额数字旁就是输入框，修改后点 Save 直接提交，无确认弹窗。toast 反馈。
- **D-07:** "Unlimited" 标签 — 未设置配额的用户/团队显示 "Unlimited" 标签，点击可设置限制。
- **D-08:** Reset 快捷操作 — 每个配额字段旁提供 "Reset" 按钮/链接，一键清除限制回到 Unlimited 状态。

### Pricing Page
- **D-09:** Modal 表单 — 点击 "Create" 或行操作 "Edit" 打开弹窗表单，包含所有定价字段。定价字段多，弹窗空间充足不拥挤。
- **D-10:** 核心 6 列表格 — Provider、Model、Model Type、Price（根据 pricing_model 智能合并显示）、Status（Active/Inactive Badge）、Actions。次要信息（notes、effective_from、created_at）放在编辑弹窗内。
- **D-11:** Toggle 停用/启用 — 行操作菜单中 "Deactivate/Activate"，带确认弹窗。与 Phase 09 的 status toggle 模式一致。
- **D-12:** Status 筛选 — All / Active / Inactive 三选一，后端已支持 `active_only` 参数。
- **D-13:** 动态价格字段 — 创建/编辑表单中，选择 pricing_model 后自动显示对应的价格字段（如选 per_token 只显示 input/output price），避免用户困惑。

### Provider Page
- **D-14:** 卡片列表 — 每个 Provider 一张卡片，显示名称、状态、Key 数量、操作按钮。Provider 数量不多（4-6个），卡片形式信息密度更适合。
- **D-15:** API Key 遮蔽后 4 位 — "sk-****7a3b"，加 label 和创建时间。安全且可辨识。
- **D-16:** 展开区内 Key 管理 — Provider 卡片展开后直接显示 Key 列表 + 底部输入框（key + 可选 label），点 Add 提交。删除带确认。
- **D-17:** Modal 表单创建/编辑 Provider — 点击 "Add Provider" 或卡片上 "Edit" 打开弹窗，填写 provider_name、display_name 等。
- **D-18:** 删除 Provider 确认弹窗 + 警告 — 显示 "删除后关联的 Key 将一并删除" 警告，确认按钮红色。破坏性操作必须确认。
- **D-19:** 状态指示：Key 数量 + is_active — 卡片上显示 "2 keys • Active"，利用后端已有信息，不需要额外 API。

### API Client Extension
- **D-20:** billingApi 内扩展 — pricing CRUD 方法放在现有 `billingApi` 命名空间内：`billingApi.createPricing()` / `.updatePricing()` / `.deletePricing()`。路由在 `/billing/pricing/*`，归属 billing 命名空间合理。

### Empty States
- **D-21:** 图标 + 描述 + CTA 按钮 — 与现有 placeholder 页风格一致，但换成实际操作 CTA（如 "Create First Pricing Rule"、"Add Your First Provider"）。

### Cross-Page Consistency
- **D-22:** 各页独立设计 — 三个页面根据内容类型自由布局（Quota 用 Tab + 列表，Pricing 用表格，Provider 用卡片），不强制统一模板。

### Claude's Discretion
- 配额展开区的具体布局（进度条 + 输入框排列方式）
- Pricing Modal 表单的字段分组和排列
- Provider 卡片的具体样式（间距、阴影、圆角）
- 各页面 loading skeleton 的具体实现
- 错误状态（API 调用失败）的处理方式
- Tab 组件样式（Obsidian Lens 风格下的 Tab 实现）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §v2.1 — REQ-21 (quota management UI), REQ-22 (pricing management UI), REQ-23 (system AI Provider management UI)

### Backend Endpoints (to wire)
- `api/app/api/v1/quota.py` — `GET/PUT /quota/user/{id}`, `GET/PUT /quota/team/{id}` (admin-guarded, audit-logged)
- `api/app/api/v1/billing.py` — `GET/POST/PATCH/DELETE /billing/pricing/` (admin-guarded, audit-logged)
- `api/app/api/v1/ai_providers.py` — `GET/POST/PATCH/DELETE /ai-providers/` + `POST/DELETE /ai-providers/{id}/keys` (owner_type=system for admin scope)
- `api/app/schemas/quota.py` — `QuotaResponse` (monthly_credit_limit, daily_call_limit, current_month_usage, current_day_calls), `QuotaUpdate`
- `api/app/schemas/billing.py` — `PricingCreate`, `PricingUpdate`, `PricingResponse` (provider, model, model_type, pricing_model, 5 price fields, is_active, notes)

### Frontend Admin Shell (Phase 08 output)
- `web/src/components/admin/admin-shell.tsx` — AdminShell layout
- `web/src/app/admin/quotas/page.tsx` — Placeholder page, replace with full implementation
- `web/src/app/admin/pricing/page.tsx` — Placeholder page, replace with full implementation
- `web/src/app/admin/providers/page.tsx` — Placeholder page, replace with full implementation

### Reusable Components (Phase 09 output)
- `web/src/components/admin/admin-data-table.tsx` — TanStack Table wrapper (loading/error/empty states, sort indicators)
- `web/src/components/admin/admin-pagination.tsx` — Page navigation with total count
- `web/src/components/admin/filter-toolbar.tsx` — Search + filter controls
- `web/src/components/admin/confirmation-modal.tsx` — Confirmation dialog (danger variant)
- `web/src/components/admin/row-dropdown-menu.tsx` — Row actions menu
- `web/src/components/admin/status-badge.tsx` — Colored status badge

### API Client
- `web/src/lib/api.ts` — `quotaApi.*`, `billingApi.*` (needs pricing CRUD methods), `aiProvidersApi.*`, `adminApi.listUsers()`, `adminApi.listTeams()` — all method signatures already defined

### Theming & Styling
- `web/src/app/globals.css` — Obsidian Lens `--ob-*` tokens + `--cv4-*` tokens
- `.planning/phases/06-collaboration-prod/06-CONTEXT.md` — Inline styles with CSS custom properties pattern

### Prior Phase Context
- `.planning/phases/08-admin-frontend-shell/08-CONTEXT.md` — AdminShell layout, API client namespaces, sonner theming
- `.planning/phases/09-user-team-management-ui/09-CONTEXT.md` — AdminDataTable/Pagination/FilterToolbar patterns, toast feedback, confirmation modal patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AdminDataTable` (`web/src/components/admin/admin-data-table.tsx`): TanStack Table wrapper with sort, skeleton loading, error/empty states — reuse for Pricing table
- `AdminPagination` (`web/src/components/admin/admin-pagination.tsx`): Page navigation — reuse for Pricing and Quota lists
- `FilterToolbar` (`web/src/components/admin/filter-toolbar.tsx`): Search + filter controls — reuse for Quota search and Pricing filter
- `ConfirmationModal` (`web/src/components/admin/confirmation-modal.tsx`): Confirmation dialog — reuse for Provider delete, Pricing deactivate
- `RowDropdownMenu` (`web/src/components/admin/row-dropdown-menu.tsx`): Row actions — reuse for Pricing table
- `StatusBadge` (`web/src/components/admin/status-badge.tsx`): Colored badge — reuse for Pricing Active/Inactive status
- `quotaApi` (api.ts): getUserQuota/updateUserQuota/getTeamQuota/updateTeamQuota — ready
- `aiProvidersApi` (api.ts): Full CRUD + key management — ready
- `billingApi.pricing()` (api.ts): GET list only — needs createPricing/updatePricing/deletePricing

### Established Patterns
- Inline styles with `--ob-*` / `--cv4-*` CSS custom properties (Phase 06/08)
- React Query with `['admin', ...]` query keys (Phase 09)
- sonner toast with specific feedback messages including entity info (Phase 09 D-09)
- 300ms debounce search (Phase 09)
- Server-side pagination with offset/limit params

### Integration Points
- `web/src/lib/api.ts` — Add `billingApi.createPricing()`, `.updatePricing()`, `.deletePricing()` methods
- `web/src/app/admin/quotas/page.tsx` — Replace placeholder with Tab + list + expand edit
- `web/src/app/admin/pricing/page.tsx` — Replace placeholder with TanStack Table + modal CRUD
- `web/src/app/admin/providers/page.tsx` — Replace placeholder with card list + key management

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

*Phase: 10-quota-pricing-provider-management-ui*
*Context gathered: 2026-04-01*
