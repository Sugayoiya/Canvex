# Phase 09: User & Team Management UI - Research

**Researched:** 2026-04-01
**Domain:** Admin CRUD UI — TanStack Table (server-side), React Query mutations, inline-style component system
**Confidence:** HIGH

## Summary

Phase 09 builds two admin data pages: a fully interactive User Management table and a read-only Team Overview table. Both sit inside the existing `AdminShell` layout (Phase 08). The tech stack is 100% established — `@tanstack/react-table` 8.21.3, `sonner` 2.0.7, `lucide-react` 1.7.0, React Query, and the project's inline-style-with-CSS-custom-properties pattern. No new dependencies required.

The main engineering challenges are: (1) wiring TanStack Table v8's manual pagination/sorting/filtering to React Query server-side queries, (2) a small backend extension to add a `teams` field to `AdminUserListItem` via JOIN, (3) detecting "last admin" state for the frontend's pre-emptive disable UX (D-10), and (4) building reusable admin table components (`AdminDataTable`, `AdminPagination`, `FilterToolbar`, `ConfirmationModal`) that Phase 10/11 can inherit.

**Primary recommendation:** Build thin, reusable wrapper components around TanStack Table with manual state control; pipe all filter/sort/page state into React Query's `queryKey` object; handle dropdown menus and modals as page-local state with `useState`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Row Dropdown 菜单（「...」按钮 → 操作列表），包含 Toggle Status / Toggle Admin
- **D-02:** 彩色 Badge 标签 — Active (绿) / Banned (红) / Admin (紫)
- **D-04:** 团队表纯展示、不可点击，不提供 drill-down
- **D-06:** 传统页码导航 — 页码 + 上/下页 + 总数显示
- **D-07:** 单列排序，默认 `created_at` desc，后端支持 `created_at` / `last_login_at` / `email`
- **D-08:** 后端扩展 `GET /admin/users` 增加 `teams` 字段（JOIN 查询）
- **D-09:** sonner toast 使用具体反馈（含用户邮箱和操作结果）
- **D-10:** Last admin 场景直接禁用 Dropdown 选项 + tooltip

### Claude's Discretion
- **D-03:** 确认弹窗的具体形式和样式（居中 modal / popover）
- **D-05:** 搜索与筛选的具体布局排列
- 表格空状态、加载骨架屏、错误状态的具体实现
- Badge 标签的具体色值（在 --ob-* 体系内选择）
- 团队表列宽和信息展示细节

### Deferred Ideas (OUT OF SCOPE)
- Admin 专属团队详情页 (`/admin/teams/[id]`) — 对应 REQ-F03
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-19 | Admin user management UI — paginated, searchable, sortable TanStack Table with server-side ops; inline status toggle and admin role toggle with confirmation modals; toast feedback via sonner | TanStack Table v8 `manualPagination`/`manualSorting` pattern + React Query keyed queries + sonner `toast.success`/`toast.error` API |
| REQ-20 | Admin team overview UI — all-teams directory with name, member count, created date | Simplified TanStack Table (no sort, no row actions) + existing `GET /admin/teams` endpoint (already has `member_count`) |
</phase_requirements>

## Project Constraints (from .cursor/rules/)

- **AGENTS.md (web/)**: "This is NOT the Next.js you know — APIs, conventions, and file structure may all differ from your training data." → Use `"use client"` directive on all page components (already established pattern).
- **Inline styles with CSS custom properties**: The project does NOT use Tailwind utility classes for admin UI — all styling is inline `style={{}}` referencing `--cv4-*` and `--ob-*` tokens.
- **No shadcn, no component library**: All UI components are hand-built with inline styles.
- **React Query for server state, Zustand for client state**: Phase 09 uses React Query only (no Zustand needed — all state page-local).

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | 8.21.3 | Headless table with manual server-side control | Installed in Phase 08; headless = full style control via inline styles |
| `sonner` | 2.0.7 | Toast notifications | Installed in Phase 08; Toaster already mounted in admin layout |
| `@tanstack/react-query` | (existing) | Server state management | Established project-wide pattern |
| `lucide-react` | 1.7.0 | Icons | Installed since Phase 02 |
| `axios` | (existing) | HTTP client | Established via `api.ts` |

### Supporting (Already Installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next` | 16.x | App Router, `"use client"` pages | Page components |
| `react` | 19.x | UI rendering | Components |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Table (manual) | ag-grid | ag-grid adds 500KB+ bundle; TanStack is headless = zero style conflicts |
| Custom dropdown | Radix DropdownMenu | Radix would be clean but project convention is zero external UI primitives |
| Custom modal | Headless UI Dialog | Same — project builds everything from inline styles |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Component Structure

```
web/src/components/admin/
├── admin-data-table.tsx        # Reusable TanStack Table wrapper (Phase 10/11 reuse)
├── admin-pagination.tsx         # Reusable pagination bar
├── status-badge.tsx             # Active/Banned badge
├── admin-badge.tsx              # Admin role badge
├── row-dropdown-menu.tsx        # "..." row actions dropdown
├── confirmation-modal.tsx       # Centered confirmation dialog
├── filter-toolbar.tsx           # Search + filter controls bar
├── admin-shell.tsx              # (existing)
├── admin-sidebar.tsx            # (existing)
└── admin-topbar.tsx             # (existing)

web/src/app/admin/
├── users/page.tsx               # Replace placeholder → full implementation
└── teams/page.tsx               # Replace placeholder → full implementation
```

### Pattern 1: TanStack Table with Manual Server-Side Control

**What:** TanStack Table v8 configured with `manualPagination: true` and `manualSorting: true`. All state lives in React `useState` and flows into React Query's `queryKey`.

**When to use:** Any table where data is paginated server-side.

**Example:**

```typescript
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";

const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);

const { data, isLoading, isError, refetch } = useQuery({
  queryKey: ["admin", "users", { q: debouncedSearch, status, is_admin: adminFilter, sort_by: sorting[0]?.id, sort_order: sorting[0]?.desc ? "desc" : "asc", limit: pagination.pageSize, offset: pagination.pageIndex * pagination.pageSize }],
  queryFn: () => adminApi.listUsers({ ... }).then(r => r.data),
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

### Pattern 2: Debounced Search → React Query Key

**What:** Search input value debounced 300ms before updating the query key. This prevents API spam during typing.

**Example:**

```typescript
const [searchValue, setSearchValue] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");

useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(searchValue), 300);
  return () => clearTimeout(timer);
}, [searchValue]);

// debouncedSearch goes into queryKey, searchValue controls the input
```

### Pattern 3: Mutation with Invalidation + Toast

**What:** `useMutation` with `onSuccess` that invalidates query cache and fires sonner toast.

**Example:**

```typescript
import { toast } from "sonner";

const toggleStatus = useMutation({
  mutationFn: ({ userId, status }: { userId: string; status: "active" | "banned" }) =>
    adminApi.toggleUserStatus(userId, { status }),
  onSuccess: (_, { userId, status }) => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    const email = getUserEmail(userId);
    toast.success(status === "banned" ? `已封禁 ${email}` : `已启用 ${email}`);
  },
  onError: (err: any) => {
    toast.error(`操作失败: ${err.response?.data?.detail ?? "Unknown error"}`);
  },
});
```

### Pattern 4: Dropdown Menu with Outside Click + Escape

**What:** Custom dropdown with portal-to-body, `useEffect` for outside click and Escape key handling.

**Example:**

```typescript
const [openMenuId, setOpenMenuId] = useState<string | null>(null);

useEffect(() => {
  if (!openMenuId) return;
  const handleClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest("[data-dropdown]")) setOpenMenuId(null);
  };
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setOpenMenuId(null);
  };
  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKey);
  return () => {
    document.removeEventListener("click", handleClick);
    document.removeEventListener("keydown", handleKey);
  };
}, [openMenuId]);
```

### Pattern 5: Confirmation Modal with Focus Trap

**What:** Centered overlay modal using `role="dialog"`, `aria-modal="true"`, focus trapped within modal while open.

**Key details:**
- Portal to `document.body` to escape any `overflow: hidden` ancestor
- `useEffect` to trap focus: on mount, focus the cancel button; on Tab/Shift+Tab, cycle between cancel and confirm
- On close, restore focus to the trigger element (the dropdown menu button)
- Animation: CSS `opacity 0→1` + `scale 0.96→1` over 150ms

### Anti-Patterns to Avoid

- **Controlled table state in URL params:** CONTEXT.md explicitly defers URL state sync. Keep all state in `useState`.
- **Fetching all users then client-side filtering:** D-07 specifies server-side sort. Backend already supports it.
- **Using TanStack Table's built-in pagination/sorting:** Must use `manual*: true` since data is server-paginated.
- **`useRef` for debounce timer:** `setTimeout` in `useEffect` with cleanup is the idiomatic React pattern. Don't use `lodash.debounce` — it's not installed and unnecessary for a single debounce.
- **Putting table state in Zustand:** CONTEXT.md §State Management explicitly says "No Zustand needed for Phase 09 — all state is page-local."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table header/cell rendering | Custom `<table>` from scratch | `@tanstack/react-table` `flexRender()` + `getCoreRowModel()` | Column definitions, sorting state, pagination state all managed by TanStack |
| Toast notifications | Custom toast component | `sonner` `toast.success()` / `toast.error()` | Already mounted in admin layout |
| Focus trap for modal | Custom focus cycling logic | Simple `useEffect` with `querySelectorAll('[tabindex]')` | Full focus-trap libraries (focus-trap-react) are overkill for a 2-button modal |

## Common Pitfalls

### Pitfall 1: TanStack Table Re-render Loops

**What goes wrong:** Defining `columns` array inside the render function causes infinite re-renders because TanStack Table uses reference equality.
**Why it happens:** Each render creates a new `columns` array reference → TanStack detects "change" → triggers re-render → loop.
**How to avoid:** Define `columns` with `useMemo` or at module level (outside component). Since columns reference runtime callbacks (like `onAction`), use `useMemo` with stable deps.
**Warning signs:** Browser becomes sluggish on page load; React DevTools shows continuous renders.

### Pitfall 2: Debounce Timer Not Cleaned on Unmount

**What goes wrong:** Search debounce timer fires after component unmounts, causing "state update on unmounted component" warning.
**Why it happens:** `setTimeout` is not cleaned up when navigating away.
**How to avoid:** Return cleanup function from `useEffect`: `return () => clearTimeout(timer)`.
**Warning signs:** Console warnings about state updates on unmounted components when navigating between admin pages.

### Pitfall 3: Stale Closure in Mutation Callbacks

**What goes wrong:** `onSuccess` callback references stale user data (e.g., wrong email in toast).
**Why it happens:** Mutation variables are captured at mutation call time, but other state may have changed.
**How to avoid:** Pass all needed data through mutation variables (not from external state). Use the `variables` parameter in `onSuccess(data, variables)`.
**Warning signs:** Toast shows wrong user email after rapid consecutive operations.

### Pitfall 4: Dropdown Z-Index Wars

**What goes wrong:** Dropdown menu renders behind table rows or other elements.
**Why it happens:** Stacking contexts from `overflow: hidden` on table container.
**How to avoid:** Portal the dropdown to `document.body` using `createPortal`. Position using the trigger's `getBoundingClientRect()`. Set z-index 50 (per UI-SPEC).
**Warning signs:** Dropdown cut off or invisible when triggered on bottom rows.

### Pitfall 5: Last Admin Detection Race Condition

**What goes wrong:** Two admin users simultaneously try to revoke each other's admin status. The frontend shows both as "not last admin" but one succeeds and the other hits the backend guard.
**Why it happens:** Frontend admin count is stale between list fetches.
**How to avoid:** This is fundamentally a backend concern (already handled by the `active_admin_count` check in `admin_users.py`). On the frontend, if the PATCH returns 400 with "Cannot remove the last active admin", show the error toast. The D-10 pre-emptive disable is a UX optimization, not a security boundary.
**Warning signs:** Occasional 400 errors on admin revoke that the user didn't expect.

### Pitfall 6: Pagination Reset on Filter Change

**What goes wrong:** User is on page 5, changes status filter, but `pageIndex` stays at 5 — which may be beyond the new total.
**Why it happens:** Filter state and pagination state are independent.
**How to avoid:** Reset `pageIndex` to 0 whenever search, status filter, or admin filter changes. Either in the filter setter or via `useEffect`.
**Warning signs:** Empty table with "Showing 81-100 of 3 users" text.

## Code Examples

### TanStack Table v8 Column Definitions (Server-Side)

```typescript
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";

interface AdminUser {
  id: string;
  email: string;
  nickname: string;
  avatar: string | null;
  status: string;
  is_admin: boolean;
  teams: string[];
  last_login_at: string | null;
  created_at: string;
}

const columnHelper = createColumnHelper<AdminUser>();

const columns = [
  columnHelper.accessor("nickname", {
    header: "NAME",
    cell: (info) => info.getValue(),
    enableSorting: false,
  }),
  columnHelper.accessor("email", {
    header: "EMAIL",
    cell: (info) => info.getValue(),
    enableSorting: true,
  }),
  columnHelper.accessor("status", {
    header: "STATUS",
    cell: (info) => <StatusBadge status={info.getValue()} />,
    enableSorting: false,
  }),
  // ... more columns
];
```

### Sonner Toast Patterns

```typescript
import { toast } from "sonner";

// Success with specific feedback (D-09)
toast.success(`已封禁 ${email}`);
toast.success(`已授予 ${email} 管理员权限`);

// Error with backend message
toast.error(`封禁失败: ${error.response?.data?.detail}`);
```

### React Query Keys Convention

```typescript
// User list with all filter/sort/page state in the key
["admin", "users", { q, status, is_admin, sort_by, sort_order, limit, offset }]

// Team list
["admin", "teams", { q, limit, offset }]

// Invalidation pattern — invalidate all user queries
queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
```

## Backend Extension Analysis (D-08)

### Current State

`AdminUserListItem` schema lacks `teams` field. The `list_users` endpoint queries `User` only — no JOIN to `TeamMember`/`Team`.

### Required Changes

1. **Schema** (`api/app/schemas/admin.py`):
   - Add `teams: list[str] = []` to `AdminUserListItem`

2. **Query** (`api/app/api/v1/admin_users.py`):
   - After fetching user rows, batch-load team names via a single JOIN query on `TeamMember` + `Team` for the user IDs in the current page
   - Approach: Use a correlated subquery or a post-fetch aggregation (subquery is cleaner)

3. **Frontend types** (`web/src/lib/api.ts`):
   - No TypeScript type changes needed — `adminApi.listUsers` returns untyped Axios response. The page component defines the interface.

### Implementation Options

**Option A: Post-fetch aggregation (recommended)**
```python
user_ids = [u.id for u in rows]
team_stmt = (
    select(TeamMember.user_id, func.group_concat(Team.name))  # SQLite
    .join(Team, TeamMember.team_id == Team.id)
    .where(TeamMember.user_id.in_(user_ids))
    .group_by(TeamMember.user_id)
)
team_map = {r[0]: r[1].split(",") for r in (await db.execute(team_stmt)).all()}
```

**SQLite/PG portability concern:** `group_concat` is SQLite; PostgreSQL uses `string_agg`. Use `func.group_concat` for SQLite dev and `string_agg` for PG, or better: fetch individual rows and aggregate in Python.

**Option B: Python-side aggregation (most portable)**
```python
from sqlalchemy import select
from app.models.team import TeamMember, Team

user_ids = [u.id for u in rows]
if user_ids:
    tm_stmt = (
        select(TeamMember.user_id, Team.name)
        .join(Team, TeamMember.team_id == Team.id)
        .where(TeamMember.user_id.in_(user_ids), Team.is_deleted == False)
    )
    tm_rows = (await db.execute(tm_stmt)).all()
    team_map: dict[str, list[str]] = {}
    for uid, tname in tm_rows:
        team_map.setdefault(uid, []).append(tname)
else:
    team_map = {}
```

**Recommendation:** Option B — Python-side aggregation. Zero SQL dialect differences, clean, efficient (single query for all users on the page).

### Last Admin Count for Frontend (D-10)

The UI-SPEC says: when system has only one admin, the "Revoke Admin" dropdown item should be **disabled**. The frontend needs to know how many active admins exist.

**Options:**
1. **Include `admin_count` in the list response** — add an extra field to `AdminUserListResponse`
2. **Derive from current page data** — count `is_admin: true` users in current page (WRONG — might miss admins on other pages)
3. **Separate API call** — wasteful

**Recommendation:** Option 1 — add `admin_count: int` to `AdminUserListResponse`. It's a single `SELECT COUNT(*)` that's already computed in the `update_user_admin` endpoint. The frontend uses: `if (adminCount <= 1 && user.is_admin) → disable "Revoke Admin"`.

### Owner Field for Teams Table (REQ-20)

The UI-SPEC specifies a "OWNER" column for the teams table. The current `AdminTeamListItem` schema lacks an `owner` field. The `GET /admin/teams` endpoint doesn't return owner info.

**Implementation:** The team "owner" is the `TeamMember` with `role = "team_admin"` (or legacy `"owner"`). Add `owner_name: str | None` to `AdminTeamListItem` and query the team_admin member's nickname.

```python
owner_sub = (
    select(User.nickname)
    .join(TeamMember, TeamMember.user_id == User.id)
    .where(TeamMember.team_id == Team.id, TeamMember.role.in_(["team_admin", "owner"]))
    .correlate(Team)
    .limit(1)
    .scalar_subquery()
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Table v7 (`useTable`) | TanStack Table v8 (`useReactTable`) | 2022 | Completely different API — column helpers, manual state, getCoreRowModel |
| React Query v3 `queryClient.invalidateQueries('key')` | React Query v4/5 `invalidateQueries({ queryKey: [...] })` | 2022 | Object-based key matching |
| `react-hot-toast` | `sonner` | 2023 | sonner is the modern standard; already chosen by project |

## Open Questions

1. **Owner field ambiguity**
   - What we know: Teams have `TeamMember` with roles including `team_admin` and legacy `owner`
   - What's unclear: Should we show the first `team_admin`, or the original creator? For teams with no `team_admin`, show "—"?
   - Recommendation: Query first `team_admin` or `owner` role member; fallback to "—"

2. **Admin count freshness**
   - What we know: The `admin_count` in list response is computed at query time
   - What's unclear: If another admin removes themselves between the list fetch and the user clicking "Revoke", there's a brief window where the disable state is wrong
   - Recommendation: Accept this — the backend is the security boundary. Frontend disable is UX sugar, not security.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) — NOT currently configured; pytest (backend) — configured |
| Config file | web/ — none (no vitest.config.ts); api/ — pytest via pyproject.toml |
| Quick run command | `cd api && uv run pytest tests/test_admin_users_api.py -x` |
| Full suite command | `cd api && uv run pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-19a | User list loads with pagination | manual (no frontend test infra) | — | ❌ Manual verify |
| REQ-19b | Search debounce triggers after 300ms | manual | — | ❌ Manual verify |
| REQ-19c | Status toggle via PATCH | integration (backend) | `uv run pytest tests/test_admin_users_api.py -x` | ✅ Exists |
| REQ-19d | Admin toggle with last-admin guard | integration (backend) | `uv run pytest tests/test_admin_users_api.py -x` | ✅ Exists |
| REQ-19e | Teams field in user list response | integration (backend) | New test needed | ❌ Wave 0 |
| REQ-20a | Team list with member count and owner | integration (backend) | New test needed | ❌ Wave 0 |
| REQ-20b | Team table renders (no sort, no actions) | manual | — | ❌ Manual verify |

### Sampling Rate

- **Per task commit:** `cd api && uv run pytest tests/test_admin_users_api.py -x` (quick backend check)
- **Per wave merge:** `cd api && uv run pytest` (full backend suite)
- **Phase gate:** Full backend suite green + manual UI verification

### Wave 0 Gaps

- [ ] `api/tests/test_admin_users_api.py` — update existing tests to validate `teams` field in list response
- [ ] `api/tests/test_admin_observability_api.py` — add test for `owner_name` in team list response (if file exists) or create new test

## Sources

### Primary (HIGH confidence)
- Project codebase: `web/src/lib/api.ts` lines 311-328 — `adminApi` namespace verified
- Project codebase: `api/app/api/v1/admin_users.py` — full endpoint implementation verified
- Project codebase: `api/app/schemas/admin.py` — `AdminUserListItem` lacks `teams` field confirmed
- Project codebase: `api/app/api/v1/admin_observability.py` — `GET /admin/teams` lacks `owner` field confirmed
- Project codebase: `web/src/app/admin/layout.tsx` — Sonner Toaster with cv4 theming confirmed mounted
- npm registry: `@tanstack/react-table` 8.21.3, `sonner` 2.0.7, `lucide-react` 1.7.0 verified installed

### Secondary (MEDIUM confidence)
- TanStack Table v8 official docs — `manualPagination`, `manualSorting` API confirmed
- Sonner official docs — `toast.success()` / `toast.error()` API confirmed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, versions verified via `npm list`
- Architecture: HIGH — patterns derived from existing project code (teams page, billing dashboard)
- Pitfalls: HIGH — common React/TanStack Table issues, well-documented
- Backend extension: HIGH — schema and query modifications straightforward, codebase fully reviewed

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable — no fast-moving dependencies)
