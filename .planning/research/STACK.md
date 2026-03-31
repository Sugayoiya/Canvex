# Stack Research

**Domain:** SaaS admin console for AI creative tool platform
**Researched:** 2026-03-31
**Confidence:** HIGH — verified against `web/package.json`, `api/pyproject.toml`, npm registry, and existing component patterns

## Recommended Stack

### Core Technologies

Already validated and in use — **no changes to core stack.**

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Next.js | 16.2.1 | App Router, admin route group `(admin)/` | ✅ Already installed |
| React | 19.2.4 | UI rendering | ✅ Already installed |
| TypeScript | ^5 | Type safety | ✅ Already installed |
| TailwindCSS | ^4 | Utility styling for admin pages | ✅ Already installed |
| FastAPI | >=0.115.0 | Admin API endpoints | ✅ Already installed |
| SQLAlchemy | >=2.0.46 (async) | ORM for admin queries | ✅ Already installed |

### Supporting Libraries

| Library | Version | Purpose | Status | Why |
|---------|---------|---------|--------|-----|
| **@tanstack/react-table** | ^8.21.3 | Headless data tables for user/team/pricing/log lists | 🆕 **NEW** | Existing manual `<table>` (`task-list.tsx`, `usage-table.tsx`) has hand-rolled sorting and no server-side pagination. Admin has 5+ table views needing multi-column sort, search, column filters, and pagination. Headless = full Obsidian Lens styling control. v9 is alpha (9.0.0-alpha.19) — use v8 for stability. |
| **sonner** | ^2.0.7 | Toast notifications for admin actions | 🆕 **NEW** | Project currently has no toast/notification library. Admin actions (disable user, update quota, update pricing, revoke admin) need clear success/error feedback. Sonner is ~5KB, React 19 compatible, unstyled enough to theme with Obsidian Lens tokens. |
| @tanstack/react-query | ^5.95.2 | Data fetching, caching, pagination state | ✅ Already installed | Continue existing pattern. Admin queries are just new query keys + API functions. |
| Recharts | ^3.8.1 | Dashboard charts (line, bar, pie, area) | ✅ Already installed | Already used in billing dashboard (`usage-chart.tsx`, `provider-pie-chart.tsx`). Fully themed with Obsidian Lens CSS variables (`--cv5-chart-*`). |
| lucide-react | ^1.7.0 | Icons (status indicators, action buttons) | ✅ Already installed | Admin pages use same icon set. |
| Zustand | ^5.0.12 | Client state (admin filter persistence) | ✅ Already installed | Minimal new state — most admin state is server state via React Query. |
| Axios | ^1.13.6 | API client with JWT interceptors | ✅ Already installed | Admin API calls go through same `lib/api.ts` client. |

### Development Tools

| Tool | Purpose | Status |
|------|---------|--------|
| ESLint ^9 + eslint-config-next 16.2.1 | Linting | ✅ Already installed |
| TypeScript ^5 | Type checking | ✅ Already installed |
| pytest >=8.3.5 + pytest-asyncio | Backend tests | ✅ Already installed |

## Installation

```bash
# Only TWO new frontend packages needed
cd web
npm install @tanstack/react-table sonner
```

No backend dependencies needed — existing FastAPI + SQLAlchemy handles all admin query patterns.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Data Table | @tanstack/react-table v8 | AG Grid Community | 300KB+ bundle, opinionated styling conflicts with Obsidian Lens. Overkill for admin tables with < 10K rows. |
| Data Table | @tanstack/react-table v8 | MUI DataGrid | Requires Material UI (~200KB). Different design system than Obsidian Lens. |
| Data Table | @tanstack/react-table v8 | TanStack Table v9 (alpha) | Still in alpha (9.0.0-alpha.19 as of 2026-03-31). Breaking API changes from v8. Use v8 for production stability, migrate later when v9 goes stable. |
| Data Table | @tanstack/react-table v8 | Manual `<table>` HTML | Already done for billing/task tables. Works for simple cases but doesn't scale: existing `usage-table.tsx` has 250 lines of hand-rolled sort logic for 6 columns. Admin has 5+ table views each needing sort + pagination + search. |
| Charts | Recharts (already installed) | Tremor | Adds ~200KB for dashboard components already buildable with Recharts. Tremor's styling competes with `--cv4-*` / `--cv5-*` tokens. |
| Charts | Recharts (already installed) | Nivo | SSR rendering not needed for admin dashboard. Recharts v3 is performant enough. |
| Toast | sonner | react-hot-toast | Similar size, but sonner has better accessibility defaults and animation quality. Both work. |
| Toast | sonner | Built-in `alert()` | Current canvas code uses `alert()`. Acceptable for simple prompts but poor UX for async admin actions (disable user, update quota). Toast is non-blocking and auto-dismisses. |
| Date formatting | Intl.DateTimeFormat + inline helpers | date-fns | Project already uses inline `relativeTime()` and `toLocaleString()`. Adding date-fns (24KB) for the few admin date columns isn't justified. Built-in `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` cover all needs. |
| Backend Pagination | Manual offset/limit (existing pattern) | fastapi-pagination | Project already uses `offset: int = Query(0)` + `limit: int = Query(20, le=100)` in `logs.py`, `canvas_assets.py`, `agent.py`. Adding a library for the same pattern introduces unnecessary abstraction. |
| Admin UI Framework | Build with existing stack | react-admin / Refine | Full admin frameworks that take over routing and data fetching. Incompatible with existing Next.js App Router + React Query + Obsidian Lens architecture. |
| Form Library | Controlled React forms | React Hook Form | Admin forms are simple (quota limits = 2-3 fields, pricing = 5 fields, user enable/disable = single button). RHF's complexity overhead isn't justified. |

## What NOT to Use

| Library/Tool | Reason |
|--------------|--------|
| **react-admin / Refine** | Full admin frameworks that impose their own routing and data fetching. Would require rewriting existing Next.js App Router architecture. |
| **AG Grid / MUI DataGrid** | Heavy, opinionated styling. Admin tables are moderate size (hundreds to low thousands of rows). Headless TanStack Table + Obsidian Lens is lighter and consistent. |
| **shadcn/ui** | Copy-paste component system based on Radix primitives. The project uses inline styles with CSS variables (Obsidian Lens `--cv4-*` pattern), not the className composition pattern shadcn requires. Mixing approaches creates inconsistency. |
| **Tremor** | Dashboard component library that duplicates Recharts (already installed) and brings its own Tailwind design tokens that compete with Obsidian Lens. |
| **date-fns** | Not currently installed. The project uses `Intl.DateTimeFormat`, `toLocaleString()`, and inline helpers (`relativeTime()` in `task-list.tsx`, `formatCost()` in `kpi-cards.tsx`). These patterns are established and sufficient for admin date columns. |
| **fastapi-pagination** | External pagination library adds unnecessary abstraction. The existing manual `offset`/`limit` pattern is established in 3+ endpoints, simple, and sufficient. |
| **@tanstack/match-sorter-utils** | Client-side fuzzy filtering utility. Admin tables should use server-side search (`ILIKE` queries) for user/team lists that may have thousands of rows. |
| **WebSocket for admin updates** | Over-engineering. Polling with `refetchInterval` (existing task monitoring pattern in `task-monitor-page.tsx`) is sufficient for admin refresh rates. |

## Stack Patterns by Variant

### Data Table Pattern (Admin Tables)

Use `@tanstack/react-table` with server-side pagination via React Query:

```tsx
const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
const [sorting, setSorting] = useState<SortingState>([]);

const { data } = useQuery({
  queryKey: ['admin', 'users', pagination, sorting, searchTerm],
  queryFn: () => adminApi.listUsers({
    offset: pagination.pageIndex * pagination.pageSize,
    limit: pagination.pageSize,
    sort_by: sorting[0]?.id,
    sort_dir: sorting[0]?.desc ? 'desc' : 'asc',
    search: searchTerm,
  }),
});

const table = useReactTable({
  data: data?.items ?? [],
  columns,
  pageCount: Math.ceil((data?.total ?? 0) / pagination.pageSize),
  state: { pagination, sorting },
  onPaginationChange: setPagination,
  onSortingChange: setSorting,
  manualPagination: true,
  manualSorting: true,
  getCoreRowModel: getCoreRowModel(),
});
```

Style the rendered `<table>` with Obsidian Lens tokens (same pattern as existing `task-list.tsx`):

```tsx
// Header: fontFamily: "Space Grotesk", color: "var(--cv4-text-muted)"
// Cells: fontFamily: "Manrope", color: "var(--cv4-text-primary)"
// Borders: borderBottom: "1px solid var(--cv4-border-default)"
// Hover: background: "var(--cv4-hover-highlight)"
// Surface: background: "var(--cv4-surface-primary)", borderRadius: 12
```

### Toast Pattern (Admin Action Feedback)

Initialize `<Toaster>` once in the admin layout, call `toast()` from mutation callbacks:

```tsx
// In (admin)/layout.tsx — add <Toaster /> with Obsidian Lens theming
import { Toaster } from 'sonner';
<Toaster
  toastOptions={{
    style: {
      background: 'var(--cv4-surface-primary)',
      border: '1px solid var(--cv4-border-default)',
      color: 'var(--cv4-text-primary)',
      fontFamily: 'Manrope, sans-serif',
      fontSize: 13,
    },
  }}
/>

// In mutation callbacks:
import { toast } from 'sonner';
const disableUser = useMutation({
  mutationFn: (userId: string) => adminApi.disableUser(userId),
  onSuccess: () => {
    toast.success('用户已禁用');
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  },
  onError: (err) => toast.error(`操作失败: ${err.message}`),
});
```

### Dashboard Stats Pattern (Admin Dashboard)

Reuse existing `KPICards` pattern from billing dashboard, with new aggregate data:

```tsx
// Fetch from new GET /admin/dashboard/stats endpoint
const { data: stats } = useQuery({
  queryKey: ['admin', 'dashboard', 'stats'],
  queryFn: () => adminApi.getDashboardStats(),
  refetchInterval: 30_000,
});
```

### Chart Pattern (Usage Over Time)

Reuse existing `UsageChart` component pattern — Recharts with Obsidian Lens CSS variable theming:

```tsx
// Already themed with: --cv5-chart-grid, --cv5-chart-series-1, --cv5-chart-series-2
// Already themed with: --cv5-chart-tooltip-bg, --cv4-border-default
// Reuse or extend existing UsageChart / ProviderPieChart components
```

### Backend Pagination Pattern (Admin Endpoints)

Continue established `offset`/`limit` pattern with total count in response body:

```python
@router.get("/admin/users")
async def list_users(
    admin=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, le=100, ge=1),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None),
    status: str | None = Query(None),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc"),
):
    require_admin(admin)
    stmt = select(User)
    if search:
        stmt = stmt.where(
            or_(User.email.ilike(f"%{search}%"), User.nickname.ilike(f"%{search}%"))
        )
    if status:
        stmt = stmt.where(User.status == status)
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    col = getattr(User, sort_by, User.created_at)
    stmt = stmt.order_by(desc(col) if sort_dir == "desc" else asc(col))
    stmt = stmt.offset(offset).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return {"items": [...], "total": total}
```

### Admin Route Guard Pattern (Frontend)

Use Next.js App Router layout + Zustand auth store:

```tsx
// web/src/app/(admin)/layout.tsx
// Check user.is_admin from auth store
// Redirect non-admins to 403 or home page
// Show admin sidebar navigation
```

No Next.js middleware needed — the existing JWT + `is_admin` check in Zustand auth store is sufficient for client-side routing. Backend `require_admin` dependency (in `app/core/deps.py`) provides the real authorization boundary.

## Version Compatibility

| Package | Version | React 19 | Next.js 16 | Notes |
|---------|---------|----------|------------|-------|
| @tanstack/react-table | ^8.21.3 | ✅ Compatible | ✅ Compatible | Documented React 16.8–19 support. See React Compiler note below. |
| sonner | ^2.0.7 | ✅ Compatible | ✅ Compatible | Peer dep `react >= 18.0.0`. Renders via portal, no SSR issues. |
| Recharts | ^3.8.1 | ✅ Compatible | ✅ Compatible | v3.x has full React 19 support. `react-is` peer dep aligned. |
| @tanstack/react-query | ^5.95.2 | ✅ Compatible | ✅ Compatible | Already in production use. |

### React Compiler Note

If the project enables React Compiler (ships with React 19), TanStack Table components may need the `"use no memo"` directive. The React Compiler breaks TanStack Table's state management because `useReactTable` mutates state objects in place rather than creating new instances. The React team has added TanStack Table to its list of known incompatible libraries (facebook/react#31820). Workaround: add `"use no memo"` at the top of files using `useReactTable`.

This is a known, documented caveat — not a blocker.

## Sources

- TanStack Table npm: https://www.npmjs.com/package/@tanstack/react-table — v8.21.3 latest stable, v9.0.0-alpha.19 latest alpha (HIGH confidence)
- TanStack Table docs: https://tanstack.com/table/latest/docs/installation — React 16.8–19 compatibility confirmed (HIGH confidence)
- Recharts npm: https://www.npmjs.com/package/recharts — v3.8.1 latest, released 2026-03-25 (HIGH confidence)
- Sonner npm: https://www.npmjs.com/package/sonner — v2.0.7, 24.5M weekly downloads (HIGH confidence)
- React Compiler + TanStack Table: https://github.com/facebook/react/issues/33057, https://github.com/facebook/react/pull/31820 (HIGH confidence)
- Existing codebase audit: `web/package.json` (actual versions), `api/pyproject.toml`, `web/src/components/billing/`, `web/src/components/tasks/task-list.tsx`, `api/app/api/v1/logs.py`, `api/app/core/deps.py` (HIGH confidence)
