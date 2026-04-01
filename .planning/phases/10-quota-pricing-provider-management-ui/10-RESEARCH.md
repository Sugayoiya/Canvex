# Phase 10: Quota & Pricing & Provider Management UI - Research

**Researched:** 2026-04-01
**Domain:** Admin frontend (React/Next.js) — wiring existing backend APIs into 3 management pages
**Confidence:** HIGH

## Summary

Phase 10 replaces three placeholder pages in the admin console with fully functional management UIs for Quotas, Pricing, and Providers. The backend APIs (quota CRUD, billing/pricing CRUD, AI provider + key management) are already implemented and tested. The frontend tech stack (@tanstack/react-table, sonner, React Query) is already installed. Phase 09 produced reusable admin components (AdminDataTable, AdminPagination, FilterToolbar, ConfirmationModal, RowDropdownMenu, StatusBadge) that can be directly consumed.

Two minor backend gaps exist: (1) no `key_hint` field on AIProviderKey for masked key display (D-15), and (2) no GET endpoint to list individual keys per provider — the current provider list only returns key counts. Both are small additions. The DELETE `/billing/pricing/{id}` endpoint currently soft-deactivates (sets `is_active=False`) rather than physically deleting, which creates a semantic mismatch with the UI "Delete Rule" action.

**Primary recommendation:** Build the three pages in parallel as separate plans. Address the two backend gaps (key_hint column + key list response, pricing delete behavior) as a lightweight first wave before the UI implementation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 双 Tab 布局（Users | Teams）— 顶部 Tab 切换用户/团队视图
- **D-02:** 实时搜索（300ms debounce）— 复用 adminApi.listUsers/listTeams
- **D-03:** 简洁列表风格 — 每行显示名称 + 邮箱/成员数 + 配额摘要
- **D-04:** 展开行编辑 — 点击行展开配额详情 + 编辑表单，一次只展开一行
- **D-05:** 进度条 + 数字可视化 — 三级颜色：绿 (0-60%) → 黄 (60-85%) → 红 (85-100%)
- **D-06:** 展开区内直接编辑 — 输入框修改后点 Save 提交，无确认弹窗，toast 反馈
- **D-07:** "Unlimited" 标签 — 未设置配额显示 "Unlimited" 标签
- **D-08:** Reset 快捷操作 — 每个配额字段旁 "Reset" 按钮清除限制
- **D-09:** Modal 表单 — 点击 Create/Edit 打开弹窗表单（定价）
- **D-10:** 核心 6 列表格 — Provider/Model/Type/Price/Status/Actions
- **D-11:** Toggle 停用/启用 — 行操作菜单中 Deactivate/Activate，带确认弹窗
- **D-12:** Status 筛选 — All / Active / Inactive
- **D-13:** 动态价格字段 — 选择 pricing_model 后自动显示对应价格字段
- **D-14:** 卡片列表 — 每个 Provider 一张卡片
- **D-15:** API Key 遮蔽后 4 位 — "sk-****7a3b"
- **D-16:** 展开区内 Key 管理 — 卡片展开后显示 Key 列表 + 底部输入框
- **D-17:** Modal 表单创建/编辑 Provider
- **D-18:** 删除 Provider 确认弹窗 + 警告
- **D-19:** 状态指示：Key 数量 + is_active
- **D-20:** billingApi 内扩展 — pricing CRUD 方法放在现有 billingApi 命名空间
- **D-21:** 图标 + 描述 + CTA 按钮 — 空状态
- **D-22:** 各页独立设计 — 不强制统一模板

### Claude's Discretion
- 配额展开区的具体布局（进度条 + 输入框排列方式）
- Pricing Modal 表单的字段分组和排列
- Provider 卡片的具体样式（间距、阴影、圆角）
- 各页面 loading skeleton 的具体实现
- 错误状态（API 调用失败）的处理方式
- Tab 组件样式（Obsidian Lens 风格下的 Tab 实现）

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-21 | Admin quota management UI — per-user and per-team quota view/edit, wired to existing PUT endpoints; user/team picker search | Backend quota endpoints verified (GET/PUT /quota/user/{id}, GET/PUT /quota/team/{id}). Frontend quotaApi already has all 4 methods. Admin user/team search via adminApi.listUsers/listTeams ready. Phase 09 FilterToolbar + AdminPagination reusable. |
| REQ-22 | Admin pricing management UI — model pricing CRUD table wired to existing endpoints; create/edit forms; deactivate with confirmation | Backend pricing endpoints verified (POST/GET/PATCH/DELETE /billing/pricing/). **Gap:** billingApi needs createPricing/updatePricing/deletePricing methods added. AdminDataTable + RowDropdownMenu + ConfirmationModal reusable. DELETE endpoint soft-deactivates — see Open Questions. |
| REQ-23 | Admin system AI Provider management UI — system-level provider list/create/edit/delete and key management, isolated from team/personal | Backend provider endpoints verified (full CRUD + POST/DELETE keys). **Gap:** No key listing endpoint; ProviderConfigResponse only returns key_count. No key_hint column for masked display. Need minor backend additions. |
</phase_requirements>

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | 8.21.3 | Pricing data table | Already used in Phase 09 AdminDataTable |
| @tanstack/react-query | 5.95.2 | Server state management | Already used across all admin pages |
| sonner | 2.0.7 | Toast notifications | Already mounted in admin layout (Phase 08) |
| lucide-react | 1.7.0 | Icons | Already used across all pages |
| axios | 1.13.6 | HTTP client | Already configured with JWT interceptors |

### Supporting (project infrastructure)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | 5.0.12 | Client state | NOT needed for Phase 10 — all state is page-local (React useState) |
| next | 16.2.1 | App Router | Page routing already configured |
| react | 19.2.4 | UI framework | Base |

### Alternatives Considered

None — all tech choices are locked by existing project stack. No new dependencies needed.

## Architecture Patterns

### Recommended Component Structure

```
web/src/
├── app/admin/
│   ├── quotas/page.tsx          # Replace placeholder → full Quota page
│   ├── pricing/page.tsx         # Replace placeholder → full Pricing page
│   └── providers/page.tsx       # Replace placeholder → full Provider page
├── components/admin/
│   ├── tab-bar.tsx              # NEW — reusable TabBar component
│   ├── progress-bar.tsx         # NEW — reusable ProgressBar with threshold colors
│   ├── pricing-form-modal.tsx   # NEW — Create/Edit pricing modal
│   ├── provider-card.tsx        # NEW — Provider card with expand/collapse
│   ├── provider-form-modal.tsx  # NEW — Create/Edit provider modal
│   ├── admin-data-table.tsx     # REUSE from Phase 09
│   ├── admin-pagination.tsx     # REUSE from Phase 09
│   ├── filter-toolbar.tsx       # REUSE from Phase 09
│   ├── confirmation-modal.tsx   # REUSE from Phase 09
│   ├── row-dropdown-menu.tsx    # REUSE from Phase 09
│   └── status-badge.tsx         # EXTEND — add "inactive" variant
└── lib/
    └── api.ts                   # EXTEND — add billingApi.createPricing/updatePricing/deletePricing
```

### Pattern 1: Page-Level Data Fetching with React Query + Debounced Search

**What:** Each admin page follows the same data fetching pattern established in Phase 09 users page.
**When to use:** All three pages.

```typescript
// Source: web/src/app/admin/users/page.tsx (Phase 09 pattern)
const [searchValue, setSearchValue] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");

useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(searchValue), 300);
  return () => clearTimeout(timer);
}, [searchValue]);

useEffect(() => {
  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
}, [debouncedSearch]);

const { data, isLoading, isError, refetch } = useQuery({
  queryKey: ["admin", "quotas", "users", { q: debouncedSearch, limit, offset }],
  queryFn: () => adminApi.listUsers(params).then((r) => r.data),
});
```

### Pattern 2: Mutation with Toast Feedback

**What:** All mutations follow Phase 09's Chinese-language toast pattern with error extraction.
**When to use:** Every save/create/update/delete/toggle action.

```typescript
// Source: web/src/app/admin/users/page.tsx (Phase 09 pattern)
const mutation = useMutation({
  mutationFn: (data) => quotaApi.updateUserQuota(userId, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "quota", "user", userId] });
    toast.success(`已更新 ${name} 的配额`);
  },
  onError: (err: unknown) => {
    const message =
      (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail ?? "Unknown error";
    toast.error(`配额更新失败: ${message}`);
  },
});
```

### Pattern 3: Confirmation Modal with MODAL_COPY Map

**What:** Phase 09 established a const object map for confirmation modals to avoid switch statements.
**When to use:** Pricing deactivate/activate/delete, Provider delete, Key revoke.

```typescript
// Source: web/src/app/admin/users/page.tsx (Phase 09 pattern)
const MODAL_COPY: Record<ModalAction, { icon; title; bodyFn; confirmLabel; confirmVariant; warning? }> = {
  deactivate: { ... },
  activate: { ... },
  delete: { ... },
};
```

### Pattern 4: Inline Styles with CSS Custom Properties

**What:** All styling uses inline `style={{}}` with `--cv4-*` and `--ob-*` CSS custom properties.
**When to use:** Every component in Phase 10.

```typescript
// Source: Phase 08/09 convention
<div style={{
  background: "var(--cv4-surface-primary)",
  border: "1px solid var(--cv4-border-subtle)",
  borderRadius: 12,
  fontFamily: "var(--font-body)",
  fontSize: 12,
  color: "var(--cv4-text-primary)",
}}>
```

### Pattern 5: Expandable Row / Card with Single-Expand Constraint

**What:** Quota list rows and Provider cards expand to show details. Only one expanded at a time (D-04).
**When to use:** Quotas page rows, Provider page cards.

```typescript
const [expandedId, setExpandedId] = useState<string | null>(null);
const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);
```

### Anti-Patterns to Avoid
- **Don't use Zustand for Phase 10 state:** All state is page-local (tab, search, expanded row, form values). React useState suffices.
- **Don't create shared form components:** The pricing form modal and provider form modal have different fields — don't abstract prematurely.
- **Don't use CSS modules or styled-components:** Project uses inline styles with CSS custom properties exclusively.
- **Don't use `useSearchParams` for tab/filter state:** Phase 10 keeps all UI state component-local per CONTEXT.md.
- **Don't add shadcn:** Project explicitly does not use shadcn (custom components only).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data table | Custom table with sorting | `AdminDataTable` (Phase 09) + @tanstack/react-table | Already handles headers, sorting, skeleton, empty, error states |
| Pagination | Custom page nav | `AdminPagination` (Phase 09) | Already handles page counts, ellipsis, keyboard nav |
| Search + filter bar | Custom search component | `FilterToolbar` (Phase 09) | Already handles search input + dropdown filters |
| Confirmation dialog | Custom modal from scratch | `ConfirmationModal` (Phase 09) | Already has focus trap, key handling, variants, portal |
| Row actions dropdown | Custom dropdown | `RowDropdownMenu` (Phase 09) | Already has portal, click-outside, keyboard, destructive variant |
| Toast notifications | Custom toast system | sonner (already mounted) | Already themed with Obsidian Lens tokens |
| Status badge | Custom badge | `StatusBadge` (Phase 09) | Extend to add "inactive" variant for pricing |

**Key insight:** Phase 09 produced a comprehensive component library for admin pages. Phase 10 should reuse these components and only build truly new UI (TabBar, ProgressBar, form modals, provider cards).

## Common Pitfalls

### Pitfall 1: Backend Key Listing Gap
**What goes wrong:** The ProviderCard expanded area needs to display individual API keys with masked hints (D-15: "sk-••••7a3b"), but the current `ProviderConfigResponse` only returns `key_count` and `active_key_count` — not individual key details.
**Why it happens:** The list endpoint loads keys via `selectinload` but `_config_to_response()` only extracts counts.
**How to avoid:** Modify `_config_to_response()` to include a `keys: list[ProviderKeyResponse]` field in the response. OR add a new GET `/ai-providers/{provider_id}/keys` endpoint. The response approach is simpler and avoids N+1 queries.
**Warning signs:** Provider cards show key count but can't display the key list when expanded.

### Pitfall 2: No key_hint for Masked Display
**What goes wrong:** D-15 requires displaying "sk-••••7a3b" (last 4 chars of original key). The `AIProviderKey` model stores `api_key_encrypted` (Fernet-encrypted). You cannot extract last 4 chars from the encrypted blob without decrypting.
**Why it happens:** The encryption was designed for secure storage, not for partial display.
**How to avoid:** Add a `key_hint` column (String(8)) to `AIProviderKey`. Store the last 4 characters of the original key at creation time in `add_provider_key()`. Update `ProviderKeyResponse` to include `key_hint`. Auto-migrate will add the column.
**Warning signs:** Key table shows "Untitled" or just the label without the "sk-••••" prefix.

### Pitfall 3: Pricing DELETE Semantic Mismatch
**What goes wrong:** The UI-SPEC defines three actions: "Edit Rule", "Deactivate/Activate Rule" (toggle), and "Delete Rule" (permanent). But the backend `DELETE /billing/pricing/{id}` currently soft-deactivates (`is_active = False`) — it doesn't physically delete the record.
**Why it happens:** The original billing implementation chose soft-deactivation for data integrity.
**How to avoid:** Either (A) modify the backend DELETE to physically delete the record, or (B) remove "Delete Rule" from the UI and only offer "Deactivate". Recommendation: Option A — add physical deletion since admin explicitly chose to delete, and pricing records can be recreated.
**Warning signs:** "Deleted" rules reappear when filtering with "Inactive" status.

### Pitfall 4: Quota Response Missing current_month_usage for New Users
**What goes wrong:** The quota GET endpoint returns a default `QuotaResponse(user_id=user_id)` when no quota record exists. This gives `current_month_usage=0` and `current_day_calls=0`, but both limits are `None` — meaning "Unlimited". The ProgressBar component must handle `null` limits correctly (show UnlimitedBadge, hide progress bar).
**Why it happens:** Quota records are created lazily — only when admin explicitly sets limits.
**How to avoid:** Always check for `null` limits before computing percentages. When limit is `null`, render "Unlimited" badge. The progress bar percentage calculation `usage / limit * 100` will crash on `null` limit.

### Pitfall 5: StatusBadge Type Restriction
**What goes wrong:** The existing `StatusBadge` component only accepts `"active" | "banned"` as status values. The pricing table needs `"active" | "inactive"`.
**Why it happens:** Phase 09 built StatusBadge specifically for user status.
**How to avoid:** Either extend `StatusBadge` to accept `"inactive"` as an alias for "banned" styling, or create a separate inline badge in the pricing table. Extending is cleaner.

### Pitfall 6: Decimal Handling in Price Inputs
**What goes wrong:** Price fields in PricingCreate/PricingUpdate use Python `Decimal` types. JavaScript doesn't have native Decimal — JSON serialization sends strings. Input fields need to handle string-to-number conversion carefully.
**Why it happens:** Backend uses Decimal for financial precision; frontend receives JSON numbers or strings.
**How to avoid:** Use `parseFloat()` for display, send string values in API calls. Validate that price inputs are positive numbers before submission. Backend Pydantic will handle string-to-Decimal conversion.

### Pitfall 7: FilterToolbar Without Search (Pricing Page)
**What goes wrong:** The Pricing page uses `FilterToolbar` for status filtering but NOT for text search. The component expects `searchValue` and `onSearchChange` as required props.
**Why it happens:** FilterToolbar was designed with search as the primary control.
**How to avoid:** Either pass an empty search (searchValue="" with a no-op handler and hide via CSS), or use the filter dropdown standalone without FilterToolbar. The former is simpler — just hide the search input with CSS `display: none` or pass `searchPlaceholder=""`.

### Pitfall 8: Provider Create Requires owner_type
**What goes wrong:** The `aiProvidersApi.create()` method requires `owner_type` in the request body. For system providers, this must be `"system"` with no `owner_id`.
**Why it happens:** The provider API serves multiple scopes (system/team/personal).
**How to avoid:** Always set `owner_type: "system"` in provider create calls from the admin page. Don't pass `owner_id`.

## Code Examples

### Quota Page: Fetching User Quota on Row Expand

```typescript
// Fetch individual user quota when row is expanded
const { data: quotaData, isLoading: quotaLoading } = useQuery({
  queryKey: ["admin", "quota", "user", expandedUserId],
  queryFn: () => quotaApi.getUserQuota(expandedUserId!).then(r => r.data),
  enabled: !!expandedUserId,
});
```

### Pricing: billingApi Extension (D-20)

```typescript
// Add to billingApi in web/src/lib/api.ts
export const billingApi = {
  // ... existing methods
  pricing: (params?: { active_only?: boolean }) =>
    api.get("/billing/pricing/", { params }),
  createPricing: (data: Record<string, unknown>) =>
    api.post("/billing/pricing/", data),
  updatePricing: (id: string, data: Record<string, unknown>) =>
    api.patch(`/billing/pricing/${id}`, data),
  deletePricing: (id: string) =>
    api.delete(`/billing/pricing/${id}`),
};
```

### Provider: System-Scope Provider List

```typescript
// Fetch system-scope providers only
const { data: providers } = useQuery({
  queryKey: ["admin", "providers", { owner_type: "system" }],
  queryFn: () => aiProvidersApi.list({ owner_type: "system" }).then(r => r.data),
});
```

### ProgressBar: Threshold Color Logic

```typescript
function getProgressColor(percent: number): string {
  if (percent >= 85) return "var(--ob-error)";
  if (percent >= 60) return "var(--ob-tertiary)";
  return "var(--ob-success)";
}
```

### Dynamic Pricing Fields (D-13)

```typescript
// Show different price fields based on pricing_model selection
const PRICING_FIELDS: Record<string, string[]> = {
  per_token: ["input_price_per_1k", "output_price_per_1k"],
  fixed_request: ["price_per_request"],
  per_image: ["price_per_image"],
  per_second: ["price_per_second"],
};

const visibleFields = PRICING_FIELDS[pricingModel] ?? [];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS modules/styled-components | Inline styles + CSS custom properties | Phase 06 (Obsidian Lens) | All Phase 10 components use inline styles |
| Separate form libraries (react-hook-form) | Plain React useState for forms | Phase 08-09 convention | No form library needed — forms are simple |
| shadcn/radix UI | Custom components with inline styles | Phase 08 decision | Don't import any component library |

## Open Questions

1. **Pricing DELETE behavior**
   - What we know: Backend DELETE `/billing/pricing/{id}` soft-deactivates (`is_active=false`). UI-SPEC shows both "Deactivate Rule" (PATCH) and "Delete Rule" (DELETE) as separate actions.
   - What's unclear: Should "Delete Rule" physically delete the record, or should it be removed from the UI?
   - Recommendation: Modify the backend DELETE endpoint to physically delete the record (`await db.delete(pricing)`). The PATCH endpoint already handles deactivation. Admin explicitly choosing "Delete" expects permanent removal. This is a 3-line backend change.

2. **Key listing for Provider expanded area**
   - What we know: Backend loads keys via `selectinload` but response only returns counts. No separate GET `/ai-providers/{id}/keys` endpoint.
   - What's unclear: Should we modify the existing provider list response to include key details, or add a new endpoint?
   - Recommendation: Modify `ProviderConfigResponse` to include `keys: list[ProviderKeyResponse]` field. Update `_config_to_response()` to populate it. Avoids N+1 queries since keys are already loaded via selectinload.

3. **BottomStats and OrgTotalBar data source**
   - What we know: The UI-SPEC defines BottomStats (Users tab: Active Users, Avg Monthly Usage, Total Overhead) and OrgTotalBar (Teams tab: aggregate usage). No existing endpoints return aggregate quota statistics.
   - What's unclear: Where does this aggregate data come from?
   - Recommendation: Compute from the user/team list data fetched on the page, or add lightweight aggregation. Since the quota page already fetches the user/team list, display these as client-side computed values from available data. "Active Users" = total from paginated response, "Avg Monthly Usage" = not directly available. Simplify: show counts from the pagination response and skip metrics that require new backend endpoints. Flag BottomStats/OrgTotalBar as best-effort — display what's available.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) + pytest (backend) |
| Config file | `web/vitest.config.ts`, `api/pyproject.toml` |
| Quick run command | `cd web && npm run test` |
| Full suite command | `cd web && npm run test && cd ../api && uv run pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-21 | Quota page renders, user tab + team tab switch, search triggers API call, expand row shows quota, save calls updateUserQuota/updateTeamQuota | integration/unit | `cd web && npx vitest run --reporter=verbose src/app/admin/quotas` | ❌ Wave 0 |
| REQ-22 | Pricing page renders table, create/edit modal, status filter, deactivate/delete with confirmation | integration/unit | `cd web && npx vitest run --reporter=verbose src/app/admin/pricing` | ❌ Wave 0 |
| REQ-23 | Provider page renders cards, expand shows keys, add/revoke key, create/edit/delete provider | integration/unit | `cd web && npx vitest run --reporter=verbose src/app/admin/providers` | ❌ Wave 0 |
| REQ-21-23 | Backend API gap fixes (key_hint column, pricing delete, provider key response) | unit | `cd api && uv run pytest tests/ -x -k "quota or pricing or provider"` | Partial — existing backend tests |

### Sampling Rate
- **Per task commit:** `cd web && npx vitest run --reporter=verbose`
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Frontend test files for quota/pricing/provider pages (unit/integration)
- [ ] Backend test for key_hint column addition
- [ ] Backend test for pricing physical delete

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). All tools and packages are already installed. This is a pure frontend + minor backend code change with no new external tooling required.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** — Read all referenced source files:
  - `api/app/api/v1/quota.py` — Verified GET/PUT user/team quota endpoints
  - `api/app/api/v1/billing.py` — Verified POST/GET/PATCH/DELETE pricing endpoints; confirmed DELETE soft-deactivates
  - `api/app/api/v1/ai_providers.py` — Verified full CRUD + key POST/DELETE; confirmed no key GET endpoint
  - `api/app/schemas/quota.py` — QuotaResponse/QuotaUpdate schema fields confirmed
  - `api/app/schemas/billing.py` — PricingCreate/Update/Response fields confirmed (5 price fields + is_active + notes)
  - `api/app/schemas/ai_provider.py` — ProviderConfigResponse returns key_count/active_key_count only; ProviderKeyResponse has no key_hint
  - `api/app/models/ai_provider_config.py` — AIProviderKey has api_key_encrypted (Fernet), no key_hint column
  - `web/src/lib/api.ts` — quotaApi (4 methods ready), billingApi (missing 3 pricing CRUD), aiProvidersApi (full CRUD + keys)
  - `web/src/components/admin/*.tsx` — All 6 Phase 09 reusable components verified
  - `web/src/app/admin/quotas/page.tsx` — Placeholder page confirmed
  - `web/src/app/admin/pricing/page.tsx` — Placeholder page confirmed
  - `web/src/app/admin/providers/page.tsx` — Placeholder page confirmed
  - `web/src/app/admin/users/page.tsx` — Phase 09 reference implementation for patterns
  - `web/package.json` — All dependencies installed, versions verified

### Secondary (MEDIUM confidence)
- **Phase 10 UI-SPEC** (`.planning/phases/10-quota-pricing-provider-management-ui/10-UI-SPEC.md`) — Approved by gsd-ui-checker, detailed component specs

### Tertiary (LOW confidence)
None — all findings are from direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and in use, versions verified from package.json
- Architecture: HIGH — patterns directly derived from Phase 09 implementation, same project
- Pitfalls: HIGH — identified from direct code reading (backend gaps, type constraints, schema mismatches)

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable — no external library dependencies added)
