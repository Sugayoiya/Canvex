# Phase 11: Monitoring Dashboard & Polish - Research

**Researched:** 2026-04-01
**Domain:** Admin frontend (React dashboard + monitoring tables + backend alerts endpoint + production polish)
**Confidence:** HIGH

## Summary

Phase 11 is a frontend-heavy feature phase that builds the admin monitoring page (4-tab tabbed view with log tables and usage charts), enhances the existing dashboard page with actionable KPI cards and alert badges, adds a single new backend endpoint (`GET /admin/alerts`), and polishes all existing admin pages (Phases 08-10) for production quality. The entire tech stack is already established — React 19, TanStack Table/Query, Recharts, sonner, lucide-react — requiring zero new dependencies. All architecture patterns (AdminDataTable, FilterToolbar, TabBar, inline styles with `--ob-*`/`--cv4-*` tokens) are proven in prior phases.

The only net-new backend work is a `GET /admin/alerts` endpoint that queries `UserQuota` + `SkillExecutionLog` + `AIProviderConfig` tables and returns 3 integer counts. The frontend work splits cleanly into: (1) dashboard KPI card enhancements, (2) monitoring page 4-tab build, (3) API client extensions, (4) error boundary + polish audit across 7 admin pages. No migration, no new models, no new dependencies.

**Primary recommendation:** Implement backend alerts endpoint first, then build monitoring page tabs in parallel, enhance dashboard page separately, and finish with a cross-page polish audit pass.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** KPI cards clickable with navigation to sub-pages, alert badges embedded using existing 160px height. No separate Attention panel.
- **D-02:** Monitoring uses single-page multi-tab structure (Tasks | AI Calls | Skills | Usage & Cost) using TabBar, state via useState. Single sidebar entry, URL unchanged.
- **D-03:** All admin monitoring log tables new-built in `components/admin/`, using AdminDataTable + AdminPagination + FilterToolbar. No reuse of user-facing TaskMonitorPage. Recharts components (UsageChart, ProviderPieChart) reused directly (pure data→UI).
- **D-04:** Usage/Cost placed as 4th tab in Monitoring page. Dashboard stays pure KPI + stats + provider status, no charts. Ensures REQ-25 one-viewport constraint.
- **D-05:** New `GET /admin/alerts` endpoint separate from `GET /admin/dashboard`. Dashboard page parallel-requests both APIs.
- **D-06:** Full polish audit of all Phase 08-10 admin pages: loading skeletons, error boundaries, empty states.
- **D-07:** All monitoring API methods added to `adminApi` namespace in `api.ts`.

### Claude's Discretion
- Dashboard KPI card hover effects (cursor, transitions)
- Monitoring tab filter field combinations and layout
- `GET /admin/alerts` response schema and threshold definitions
- Log table column definitions and sort fields
- Error boundary implementation (React Error Boundary class vs try-catch)
- Loading skeleton styles (reuse AdminDataTable vs custom)
- Bundle isolation verification approach

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-24 | Admin monitoring dashboard — global task monitoring, AI call logs, skill execution logs with cross-user filtering; usage/cost time-series and breakdowns | Monitoring page 4-tab architecture (D-02/D-03); existing backend log endpoints with admin scope lifting (Phase 07 REQ-15); admin API client extensions (D-07); UsageChart/ProviderPieChart reuse (D-03) |
| REQ-25 | Admin dashboard landing page — 4-6 actionable KPI cards, secondary aggregate stats, link to sub-pages. Not a vanity metrics wall | Dashboard KPI card enhancement (D-01); alerts endpoint (D-05); one-viewport constraint (D-04); click-to-navigate + alert badge pattern |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.1 | App Router pages, auto code-splitting | Already installed; admin route group (`app/admin/`) auto-splits chunks |
| React | 19.2.4 | UI framework | Already installed |
| @tanstack/react-query | 5.95.2 | Server state + caching | Already used in all admin pages with `['admin', ...]` query keys |
| @tanstack/react-table | 8.21.3 | Table primitives (sort, column defs) | Already used for Users/Teams/Pricing tables |
| recharts | 3.8.1 | Charts (LineChart, PieChart) | Already used for billing UsageChart + ProviderPieChart |
| sonner | 2.0.7 | Toast notifications | Already configured with Obsidian Lens theming at admin layout |
| lucide-react | 1.7.0 | Icons | Already used throughout admin pages |
| FastAPI | — | Backend API | Already running |
| SQLAlchemy | — | Async ORM queries | Already established patterns |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| axios | — | HTTP client | Already configured with JWT interceptors in `api.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React class Error Boundary | react-error-boundary library | Class component is 20 lines, zero dependency — better for this project's zero-library admin approach |
| URL-synced tab state | useState only | D-02 locks to useState; URL sync would add complexity for no user value |

**Installation:**
```bash
# No new packages needed — everything is already installed
```

**Version verification:** All versions verified against `npm list` output from the workspace. No new dependencies required.

## Architecture Patterns

### Recommended Project Structure

New/modified files for this phase:

```
web/src/
├── app/admin/
│   ├── page.tsx                          # MODIFY: enhance KPI cards (D-01)
│   └── monitoring/page.tsx               # REPLACE: full 4-tab monitoring page (D-02)
├── components/admin/
│   ├── task-log-table.tsx                # NEW: admin task log table (D-03)
│   ├── ai-call-log-table.tsx             # NEW: admin AI call log table (D-03)
│   ├── skill-log-table.tsx               # NEW: admin skill log table (D-03)
│   ├── admin-usage-cost-tab.tsx          # NEW: usage charts wrapper (D-03/D-04)
│   ├── admin-error-boundary.tsx          # NEW: React Error Boundary (D-06)
│   └── status-badge.tsx                  # MODIFY: extend variants for task/skill statuses
├── lib/
│   └── api.ts                            # MODIFY: extend adminApi namespace (D-07)
api/app/
├── api/v1/
│   └── admin_observability.py            # MODIFY: add GET /admin/alerts (D-05)
└── schemas/
    └── admin.py                          # MODIFY: add AdminAlertsResponse schema
```

### Pattern 1: Admin Log Table Component

**What:** Self-contained table component with embedded data fetching, filtering, sorting, and pagination.
**When to use:** Every monitoring log tab follows this pattern.

```typescript
// Pattern from admin/users/page.tsx — adapted for log tables
function TaskLogTable() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  // 300ms debounce (consuming page handles it)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  
  // Reset page on filter change
  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter]);
  
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "tasks", page, debouncedSearch, statusFilter],
    queryFn: () => adminApi.listTasks({ 
      limit: PAGE_SIZE, offset: page * PAGE_SIZE,
      status: statusFilter || undefined,
      // search mapped to user_id or skill_name query
    }).then(r => ({
      items: r.data,
      total: parseInt(r.headers["x-total-count"] || "0"),
    })),
  });
  
  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });
  
  return (
    <>
      <FilterToolbar searchValue={search} onSearchChange={setSearch} filters={[...]} />
      <AdminDataTable table={table} isLoading={isLoading} isError={isError} onRetry={refetch} />
      <AdminPagination currentPage={page} pageCount={...} onPageChange={setPage} />
    </>
  );
}
```

### Pattern 2: Clickable KPI Card with Alert Badge

**What:** Enhance existing KpiCard with onClick navigation and conditional alert badge.
**When to use:** Dashboard page KPI cards (D-01).

```typescript
// Enhanced KpiCard — add onClick, href, hover effects
function KpiCard({
  label, icon, value, badge, description, badgeVariant,
  isLoading,
  href,           // NEW: navigation target
  alertBadge,     // NEW: alert text from /admin/alerts
}: KpiCardProps) {
  const router = useRouter();
  return (
    <div
      onClick={() => href && router.push(href)}
      style={{
        cursor: href ? "pointer" : "default",
        transition: "all 150ms ease",
        // ... existing styles
      }}
      onMouseEnter={(e) => {
        if (href) {
          e.currentTarget.style.borderColor = "rgba(0,209,255,0.3)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--cv4-border-subtle)";
        e.currentTarget.style.transform = "none";
      }}
    >
      {/* ... existing content + alert badge slot */}
    </div>
  );
}
```

### Pattern 3: React Class Error Boundary

**What:** Minimal React Error Boundary matching Obsidian Lens styling.
**When to use:** Wrap each admin page content area (D-06).

```typescript
import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  
  static getDerivedStateFromError(): State {
    return { hasError: true };
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ /* centered error card with --cv4-* tokens */ }}>
          <AlertTriangle size={48} style={{ color: "var(--cv4-text-muted)", opacity: 0.5 }} />
          <div>Something went wrong</div>
          <button onClick={() => this.setState({ hasError: false })}>Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### Pattern 4: Parallel Dashboard API Requests

**What:** Dashboard fires two independent React Query requests (dashboard + alerts) and renders independently.
**When to use:** Dashboard page (D-05).

```typescript
const dashboardQuery = useQuery({
  queryKey: ["admin", "dashboard"],
  queryFn: () => adminApi.getDashboard().then(r => r.data),
  refetchInterval: 60_000,
});

const alertsQuery = useQuery({
  queryKey: ["admin", "alerts"],
  queryFn: () => adminApi.getAlerts().then(r => r.data),
  refetchInterval: 60_000,
});
// KPI cards show values from dashboardQuery, alert badges from alertsQuery
// Each query has independent loading/error states
```

### Anti-Patterns to Avoid
- **Reusing TaskMonitorPage for admin scope:** D-03 explicitly forbids this. Data scope, endpoints, and filter dimensions differ. Build fresh admin log tables.
- **Charts on dashboard page:** D-04 prohibits charts on dashboard — would break REQ-25 one-viewport constraint.
- **URL-synced tab state:** D-02 locks to `useState`. No URL param sync.
- **Combined dashboard+alerts API:** D-05 requires separate endpoints with parallel fetch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data table sorting/columns | Custom table with manual DOM | @tanstack/react-table `useReactTable` + `AdminDataTable` | Column defs, sort state, header rendering all handled |
| Pagination math | Custom pagination logic | `AdminPagination` component | Ellipsis logic, boundary checks, accessible navigation all built |
| Search debounce | Custom debounce hook | `setTimeout` + `useEffect` cleanup | Matches Phase 09/10 pattern exactly — 300ms, consuming-page-handles |
| Chart rendering | Custom SVG charts | recharts `UsageChart` / `ProviderPieChart` | Already styled with Obsidian Lens tokens, responsive, empty states |
| Toast feedback | Custom notification system | `sonner` toast | Already themed and mounted at admin layout level |
| Error boundary | Manual try-catch everywhere | React class Error Boundary | Standard React pattern, catches render errors, provides retry |

## Common Pitfalls

### Pitfall 1: Total Count from X-Total-Count Header

**What goes wrong:** `GET /logs/tasks` returns total count in `X-Total-Count` response header (not body). If admin log tables read total from response body, pagination breaks.
**Why it happens:** This endpoint uses `JSONResponse` with custom header (see `logs.py` line 215-217), unlike admin users/teams which embed `total` in body.
**How to avoid:** Read `parseInt(response.headers["x-total-count"] || "0")` for task logs. AI call logs and skill logs DON'T return total — need to add count query to backend or use `X-Total-Count` pattern.
**Warning signs:** Pagination showing "0 of 0" despite data in table.

### Pitfall 2: Admin Scope Already Implemented — Don't Re-implement

**What goes wrong:** Developer adds admin scope lifting to log endpoints that already have it.
**Why it happens:** Phase 07 REQ-15 already implemented admin cross-user query for all `/logs/*` endpoints. The `is_admin` check + `user_id`/`team_id` filter params exist.
**How to avoid:** Use existing endpoints as-is. Frontend just passes admin filter params (user_id, team_id) through `adminApi` wrapper methods.
**Warning signs:** Duplicate admin checks in backend code.

### Pitfall 3: Missing Total Count on `/logs/skills` and `/logs/ai-calls`

**What goes wrong:** AdminPagination requires `totalItems` but `/logs/skills` and `/logs/ai-calls` return only arrays — no total count.
**Why it happens:** These were built before paginated admin UI existed. `/logs/tasks` added `X-Total-Count` later.
**How to avoid:** Either: (a) add `X-Total-Count` header to skills and ai-calls endpoints with a count query, or (b) use offset-based "load more" without total. Option (a) is better for AdminPagination consistency.
**Warning signs:** Pagination not showing total count, only "Showing 1-20 of ???".

### Pitfall 4: StatusBadge Type Union Breaking Existing Pages

**What goes wrong:** Extending `StatusBadge` type from `"active" | "banned"` to include `"running" | "completed" | "failed" | "timeout" | "queued" | "success"` could break type-checking in existing admin/users/page.tsx.
**Why it happens:** TypeScript union expansion is additive, but if the component was narrowly typed.
**How to avoid:** Simply widen the union in the type definition. Existing "active"/"banned" values still match. No breaking change.
**Warning signs:** TypeScript errors on users page after status-badge.tsx edit.

### Pitfall 5: KPI Card href Navigation vs Link Prefetching

**What goes wrong:** Using `router.push(href)` inside `onClick` on a `<div>` instead of `<Link>` loses Next.js prefetching and accessibility.
**Why it happens:** KpiCard is a `<div>` with custom styles, not a semantic link.
**How to avoid:** Wrap the KpiCard `<div>` in a `<div onClick>` handler using `useRouter().push()`. For accessibility, add `role="link"` and `tabIndex={0}` with Enter key handler. Prefetching is less important for admin pages (low traffic, fast navigation).
**Warning signs:** Cards not keyboard-navigable, no hover cursor.

### Pitfall 6: Quota Warning Threshold Calculation

**What goes wrong:** The `GET /admin/alerts` `quota_warning_users` count is incorrect because it doesn't handle `NULL` limits (unlimited quota) or stale month/day counters.
**Why it happens:** `UserQuota.monthly_credit_limit` can be NULL (unlimited). Also, `current_month_usage` uses lazy reset — the reset happens on access in the quota check service, not in the database directly.
**How to avoid:** Only count users where `monthly_credit_limit IS NOT NULL AND (current_month_usage / monthly_credit_limit) >= 0.8`. Also consider: if last_month_reset is in a previous month, `current_month_usage` is stale (hasn't been lazily reset yet). For the alerts endpoint, use raw values and accept slight staleness — admin is informational, not enforcement.
**Warning signs:** All users showing as "at quota limit" because NULL limits counted, or zero warnings because stale data.

### Pitfall 7: Recharts SSR Issues

**What goes wrong:** Recharts `ResponsiveContainer` throws during SSR because it accesses `window`/DOM measurements.
**Why it happens:** Next.js 16 App Router can SSR even `"use client"` components on initial render.
**How to avoid:** Both `UsageChart` and `ProviderPieChart` already have `"use client"` and work in production (Phase 05 validated). The monitoring page is also `"use client"`, so no SSR issue. Just ensure the monitoring page.tsx keeps `"use client"`.
**Warning signs:** Hydration mismatch errors mentioning SVG or ResponsiveContainer.

## Code Examples

### Backend: GET /admin/alerts Endpoint

```python
# Source: Pattern from admin_observability.py dashboard endpoint
@router.get("/alerts")
async def get_alerts(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    now = datetime.now(timezone.utc)
    h24 = now - timedelta(hours=24)

    # Quota warning: users where monthly usage >= 80% of limit
    quota_stmt = select(func.count(UserQuota.id)).where(
        UserQuota.monthly_credit_limit.isnot(None),
        UserQuota.monthly_credit_limit > 0,
        UserQuota.current_month_usage >= UserQuota.monthly_credit_limit * Decimal("0.8"),
    )
    quota_warning = (await db.execute(quota_stmt)).scalar() or 0

    # Failed tasks in last 24h
    failed_stmt = select(func.count(SkillExecutionLog.id)).where(
        SkillExecutionLog.status == "failed",
        SkillExecutionLog.queued_at >= h24,
    )
    failed_24h = (await db.execute(failed_stmt)).scalar() or 0

    # Error providers: system-scope disabled
    error_prov_stmt = select(func.count(AIProviderConfig.id)).where(
        AIProviderConfig.owner_type == "system",
        AIProviderConfig.is_enabled == False,  # noqa: E712
    )
    error_providers = (await db.execute(error_prov_stmt)).scalar() or 0

    return {"quota_warning_users": quota_warning, "failed_tasks_24h": failed_24h, "error_providers": error_providers}
```

### Frontend: Admin API Client Extensions

```typescript
// Source: Pattern from existing adminApi in api.ts
export const adminApi = {
  // ... existing methods ...
  getAlerts: () => api.get("/admin/alerts"),
  listTasks: (params?: {
    limit?: number; offset?: number;
    status?: string; user_id?: string; team_id?: string;
  }) => api.get("/logs/tasks", { params }),
  listSkillLogs: (params?: {
    limit?: number; offset?: number;
    skill_name?: string; status?: string; user_id?: string; team_id?: string;
  }) => api.get("/logs/skills", { params }),
  listAiCallLogs: (params?: {
    limit?: number; offset?: number;
    provider?: string; model?: string; user_id?: string; team_id?: string;
  }) => api.get("/logs/ai-calls", { params }),
  getAiCallStats: (params?: { user_id?: string; team_id?: string }) =>
    api.get("/logs/ai-calls/stats", { params }),
  getTrace: (traceId: string) => api.get(`/logs/trace/${traceId}`),
};
```

### Frontend: Monitoring Page Tab Structure

```typescript
// Source: Pattern from admin/quotas/page.tsx TabBar usage
const MONITORING_TABS = [
  { id: "tasks", label: "Tasks", icon: <ListTodo size={14} /> },
  { id: "ai-calls", label: "AI Calls", icon: <Cpu size={14} /> },
  { id: "skills", label: "Skills", icon: <Zap size={14} /> },
  { id: "usage", label: "Usage & Cost", icon: <TrendingUp size={14} /> },
];

export default function AdminMonitoringPage() {
  const [activeTab, setActiveTab] = useState("tasks");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Page header */}
      <TabBar tabs={MONITORING_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "tasks" && <TaskLogTable />}
      {activeTab === "ai-calls" && <AiCallLogTable />}
      {activeTab === "skills" && <SkillLogTable />}
      {activeTab === "usage" && <AdminUsageCostTab />}
    </div>
  );
}
```

### Frontend: Extended StatusBadge

```typescript
// Extend existing VARIANTS map in status-badge.tsx
const VARIANTS: Record<string, { bg: string; color: string; label: string }> = {
  active:    { bg: "#4CAF5020", color: "var(--ob-success)", label: "Active" },
  banned:    { bg: "#FFB4AB20", color: "var(--ob-error)", label: "Banned" },
  running:   { bg: "#007AFF20", color: "var(--cv5-status-running)", label: "Running" },
  completed: { bg: "#4CAF5020", color: "var(--ob-success)", label: "Completed" },
  failed:    { bg: "#FFB4AB20", color: "var(--ob-error)", label: "Failed" },
  timeout:   { bg: "#FF950020", color: "var(--cv5-status-blocked)", label: "Timeout" },
  queued:    { bg: "#8E8E9320", color: "var(--cv5-status-queued)", label: "Queued" },
  success:   { bg: "#4CAF5020", color: "var(--ob-success)", label: "Success" },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Log endpoints without total count | `X-Total-Count` header for paginated responses | Phase 05 (`/logs/tasks`) | Need to backport pattern to `/logs/skills` and `/logs/ai-calls` |
| No admin error boundaries | React class Error Boundary per page | This phase | Catches render errors; Admin pages are read-only so retry is safe |
| Dashboard as static KPI wall | Actionable KPI cards with navigation + alert badges | This phase | Dashboard becomes a routing hub, not just metrics display |

## Open Questions

1. **CSS custom property `--cv5-status-running` existence**
   - What we know: UI-SPEC references `--cv5-status-running` and `--cv5-status-queued` for StatusBadge
   - What's unclear: Whether these are already defined in `globals.css` or need to be added
   - Recommendation: Check `globals.css` during implementation; if missing, add them. Use `#007AFF` for running (blue), `#8E8E93` for queued (gray). Low risk — purely additive CSS.

2. **`/logs/skills` and `/logs/ai-calls` missing total count**
   - What we know: These endpoints return arrays without total count. `/logs/tasks` has `X-Total-Count`.
   - What's unclear: Whether to add count queries or use a "hasMore" pagination pattern.
   - Recommendation: Add `X-Total-Count` header to both endpoints (copy `/logs/tasks` pattern). Small backend change, big frontend consistency win.

3. **Lazy quota reset staleness in alerts**
   - What we know: `UserQuota.current_month_usage` uses lazy reset on access. Alerts endpoint reads raw DB values.
   - What's unclear: Whether stale values are acceptable for alert counts.
   - Recommendation: Accept staleness — alerts are informational, not enforcement. Document as known limitation. The accuracy improves as users access their quotas naturally.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (frontend), pytest (backend) |
| Config file | `web/vitest.config.ts`, `api/pyproject.toml` |
| Quick run command | `cd web && npm run test -- --run` / `cd api && uv run pytest -x` |
| Full suite command | `cd web && npm run test` / `cd api && uv run pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-24 | Monitoring 4-tab renders and switches | smoke | Manual browser verification | ❌ Wave 0 |
| REQ-24 | Admin log tables load with data | integration | Manual API + UI verification | ❌ Wave 0 |
| REQ-24 | Filter/pagination on log tables | integration | Manual interaction test | ❌ Wave 0 |
| REQ-25 | Dashboard KPI cards clickable | smoke | Manual browser verification | ❌ Wave 0 |
| REQ-25 | Dashboard alerts badge shows counts | integration | `cd api && uv run pytest tests/test_admin_alerts.py -x` | ❌ Wave 0 |
| REQ-25 | Dashboard fits one viewport | visual | Manual viewport check (no scroll at 1080p) | N/A manual-only |
| REQ-24/25 | Bundle isolation (admin chunks not loaded for non-admin) | smoke | Manual network tab inspection | N/A manual-only |

### Sampling Rate
- **Per task commit:** `cd api && uv run pytest -x --timeout=30`
- **Per wave merge:** Full suite for both frontend and backend
- **Phase gate:** All admin pages visually inspected + backend test green

### Wave 0 Gaps
- [ ] `api/tests/test_admin_alerts.py` — covers REQ-25 alerts endpoint
- [ ] Backend count query addition for `/logs/skills` and `/logs/ai-calls` — need `X-Total-Count`

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `web/src/app/admin/page.tsx` — existing dashboard page (564 lines, verified all patterns)
- Codebase inspection: `web/src/app/admin/monitoring/page.tsx` — placeholder page (confirmed replacement target)
- Codebase inspection: `api/app/api/v1/admin_observability.py` — existing dashboard endpoint (verified query patterns)
- Codebase inspection: `api/app/api/v1/logs.py` — existing log endpoints with admin scope (verified is_admin checks)
- Codebase inspection: `web/src/components/admin/admin-data-table.tsx` — TanStack Table wrapper (verified loading/error/empty states)
- Codebase inspection: `web/src/components/admin/tab-bar.tsx` — Tab component (verified API and accessibility)
- Codebase inspection: `web/src/components/billing/usage-chart.tsx` — Recharts LineChart (verified pure data→UI)
- Codebase inspection: `web/src/components/billing/provider-pie-chart.tsx` — Recharts PieChart (verified pure data→UI)
- Codebase inspection: `web/src/lib/api.ts` — API client (verified adminApi, logsApi, billingApi namespaces)
- Codebase inspection: `api/app/models/quota.py` — UserQuota/TeamQuota models (verified field types for alert query)
- Package verification: `npm list` — confirmed all dependency versions installed

### Secondary (MEDIUM confidence)
- UI-SPEC: `.planning/phases/11-monitoring-dashboard-polish/11-UI-SPEC.md` — design contract approved by gsd-ui-checker

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all patterns proven in prior phases
- Architecture: HIGH — direct extension of Phase 08-10 patterns, all component APIs verified
- Pitfalls: HIGH — derived from direct codebase inspection of existing endpoints and components

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable — no external dependency changes expected)
