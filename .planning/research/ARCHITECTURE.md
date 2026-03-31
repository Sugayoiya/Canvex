# Architecture Research

**Domain:** SaaS admin console for AI creative tool platform
**Researched:** 2026-03-31
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│                                                                     │
│  ┌──────────────────────┐     ┌──────────────────────────────────┐  │
│  │ Regular App           │     │ Admin Console                    │  │
│  │ /projects, /teams,    │     │ /admin/users, /admin/quotas,     │  │
│  │ /billing, /tasks,     │     │ /admin/pricing, /admin/providers │  │
│  │ /settings/ai, /canvas │     │ /admin/monitoring, /admin/teams  │  │
│  │                       │     │                                  │  │
│  │ AppShell (Sidebar +   │     │ AdminShell (AdminSidebar +       │  │
│  │  Topbar)              │     │  Topbar — reused)                │  │
│  │ AuthGuard             │     │ AuthGuard + AdminGuard           │  │
│  └───────────┬───────────┘     └──────────────┬───────────────────┘  │
│              │                                │                     │
│              └──────────┬─────────────────────┘                     │
│                         │ Axios (JWT auto-attach)                   │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │   FastAPI /api/v1/    │
              │                       │
              │  Existing routes:     │       New route:
              │  /quota/* (admin)     │    ┌──────────────┐
              │  /billing/* (mixed)   │    │ /admin/*     │
              │  /logs/* (mixed)      │    │ user list    │
              │  /ai-providers/*      │    │ user toggle  │
              │  /teams/*             │    │ admin grant  │
              │                       │    │ team overview│
              │  Guard: require_admin │    │ audit log    │
              │  Scope: is_admin →    │    │ dashboard KPI│
              │    bypass user_id     │    └──────┬───────┘
              └───────────┬───────────┘           │
                          │                       │
              ┌───────────▼───────────────────────▼──┐
              │  SQLAlchemy async                     │
              │  User (is_admin, status)              │
              │  UserQuota / TeamQuota                │
              │  ModelPricing                         │
              │  AIProviderConfig / AIProviderKey      │
              │  SkillExecutionLog / AICallLog         │
              │  Team / TeamMember                    │
              │  QuotaUsageLog (audit)                │
              └──────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Current State |
|---|---|---|
| `require_admin` (deps.py) | Backend gate — checks `User.is_admin` | ✅ Exists, used in quota/billing/provider routes |
| `User.is_admin` | System admin boolean flag | ✅ Exists on model, exposed in JWT profile, in auth store |
| `User.status` | Account lifecycle (active/banned) | ✅ Exists, enforced in `get_current_user` |
| `AuthGuard` | Frontend route protection (redirect to /login) | ✅ Exists, wraps all routes via Providers |
| `AdminGuard` | Frontend admin gate (redirect non-admins) | ❌ New — reads `user.is_admin` from auth store |
| `AdminShell` | Admin-specific layout (sidebar + topbar) | ❌ New — parallel to AppShell |
| `admin.py` router | Backend admin-only aggregate endpoints | ❌ New — user CRUD, team overview, dashboard KPIs |
| `adminApi` | Frontend API client for admin endpoints | ❌ New — added to `lib/api.ts` |
| Billing endpoints | Usage stats + timeseries | ✅ Already admin-aware (bypass user_id when is_admin) |
| Logs endpoints | Tasks + AI calls + traces | ✅ Partially admin-aware (/tasks, /tasks/counts bypass user_id) |
| Quota endpoints | User/team quota CRUD | ✅ Already admin-guarded |
| Pricing endpoints | Model pricing CRUD | ✅ Already admin-guarded |
| AI Provider endpoints | System/team/personal provider CRUD | ✅ Already ownership-scoped, system = admin |

## Recommended Project Structure

New files/folders within existing structure:

```
web/src/
├── app/
│   └── admin/                          # NEW — admin route tree
│       ├── layout.tsx                  # AdminShell + AdminGuard wrapper
│       ├── page.tsx                    # Dashboard — KPIs, at-a-glance
│       ├── users/
│       │   └── page.tsx               # User management table
│       ├── quotas/
│       │   └── page.tsx               # Quota management (user + team)
│       ├── pricing/
│       │   └── page.tsx               # Model pricing CRUD
│       ├── providers/
│       │   └── page.tsx               # System-level AI provider management
│       ├── monitoring/
│       │   └── page.tsx               # Global task + AI call logs
│       └── teams/
│           └── page.tsx               # All-teams overview
├── components/
│   └── admin/                          # NEW — admin-specific components
│       ├── admin-guard.tsx            # Redirect non-admins to /projects
│       ├── admin-shell.tsx            # Layout: AdminSidebar + Topbar
│       ├── admin-sidebar.tsx          # Admin navigation
│       ├── admin-kpi-cards.tsx        # Dashboard KPI cards (4-6 metrics)
│       ├── user-table.tsx             # Paginated user directory
│       ├── user-status-toggle.tsx     # Enable/disable user action
│       ├── admin-role-toggle.tsx      # Grant/revoke admin
│       ├── quota-editor.tsx           # Inline quota edit form
│       └── team-overview-table.tsx    # All-teams list with member counts
└── lib/
    └── api.ts                          # MODIFIED — add adminApi namespace

api/app/
├── api/v1/
│   ├── admin.py                        # NEW — admin-only endpoints
│   └── router.py                       # MODIFIED — register admin router
├── models/
│   └── admin_audit_log.py              # NEW (optional) — structured admin action log
└── schemas/
    └── admin.py                        # NEW — admin request/response schemas
```

## Architectural Patterns

### 1. Dual Guard Pattern (Frontend)

```
AuthGuard (exists)          AdminGuard (new)
    │                           │
    ▼                           ▼
Check isAuthenticated       Check user.is_admin
→ redirect to /login        → redirect to /projects (or 403 page)
```

`admin/layout.tsx` nests both guards:

```tsx
// web/src/app/admin/layout.tsx
export default function AdminLayout({ children }) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  );
}
```

`AdminGuard` reads from the existing Zustand `useAuthStore` — no new store needed.

### 2. Backend Admin Scope Pattern

Existing routes already demonstrate two patterns for admin scope:

**Pattern A — Explicit guard** (used in quota.py, billing.py pricing):
```python
@router.put("/user/{user_id}")
async def set_user_quota(user_id: str, user=Depends(get_current_user), ...):
    require_admin(user)  # 403 if not admin
    ...
```

**Pattern B — Conditional scope lift** (used in billing.py timeseries, logs.py tasks):
```python
if not getattr(user, "is_admin", False):
    stmt = stmt.where(AICallLog.user_id == user.id)
# admin sees all rows
```

For the new `/api/v1/admin/*` router, use **Pattern A exclusively** — every endpoint calls `require_admin`. No mixed-scope endpoints in the admin router.

### 3. Component Reuse Strategy

| Existing Component | Reuse in Admin | Adaptation Needed |
|---|---|---|
| `KPICards` (billing) | Admin dashboard KPIs | Parameterize labels/icons; wrap with admin-global data |
| `UsageChart` (billing) | Admin monitoring charts | Already admin-aware via backend scope lift |
| `ProviderPieChart` (billing) | Admin provider stats | Already admin-aware |
| `UsageTable` (billing) | Admin usage breakdown | Already admin-aware |
| `TaskList` (tasks) | Admin task monitoring | Already accepts `isAdmin` prop |
| `StatusBadge` (tasks) | Admin user status display | Reuse directly for status badges |
| `Topbar` (layout) | Admin topbar | Reuse as-is; add admin indicator badge |
| `BillingDashboard` | Admin billing view | Embed directly — already shows global data for admins |
| `TaskMonitorPage` | Admin task monitoring | Embed directly — already shows global data for admins |

### 4. Sidebar Navigation Isolation

Regular sidebar (existing):
```
WORKSPACE
├── Projects
├── Team & Roles
├── AI Console
├── ─────────
├── Tasks
└── Billing
```

Admin sidebar (new):
```
ADMIN CONSOLE
├── Dashboard        → /admin
├── Users            → /admin/users
├── Quotas           → /admin/quotas
├── Pricing          → /admin/pricing
├── Providers        → /admin/providers
├── Monitoring       → /admin/monitoring
├── Teams            → /admin/teams
├── ─────────
└── ← Back to App   → /projects
```

Regular sidebar gains a conditional admin link:
```
(if user.is_admin)
├── Admin Console    → /admin
```

## Data Flow

### Admin Request Flow

```
1. User navigates to /admin/users
2. AdminGuard checks useAuthStore().user.is_admin
   → false: redirect to /projects
   → true: render AdminShell > page
3. Page calls adminApi.listUsers({ search, status, page })
4. Axios interceptor attaches JWT
5. FastAPI /api/v1/admin/users:
   a. get_current_user() — validates JWT, checks status != "banned"
   b. require_admin(user) — checks is_admin, else 403
   c. Query: SELECT users with pagination, no user_id filter
6. Response → React Query cache → table render
```

### State Management Approach

**No new Zustand store.** Rationale:

- Admin pages are read-heavy dashboards with server-authoritative data.
- React Query handles caching, background refresh, and pagination state.
- The only client state needed is UI-local (search filters, active tab, pagination offset) — `useState` is sufficient.
- The existing `useAuthStore` already exposes `user.is_admin` for guard logic.

Query key structure for admin:
```typescript
["admin", "users", { page, search, status }]
["admin", "teams", { page }]
["admin", "dashboard-kpis"]
["admin", "audit-log", { page, action_type }]
```

## Integration Points

### Internal Boundaries

| Boundary | Integration Strategy |
|---|---|
| Admin routes ↔ Regular routes | Separate layouts, separate sidebars. Shared Topbar, shared auth store. No shared page state. |
| Admin API ↔ Existing API | New `/admin/*` router for new endpoints. Existing admin-guarded endpoints (quota, billing, providers) called directly — no duplication. |
| Admin components ↔ Existing components | Import and reuse billing/task components. Admin-specific components in `components/admin/`. |
| Design system | Admin pages use same Obsidian Lens tokens (`--ob-*`), same fonts (Space Grotesk + Manrope), same glassmorphism card patterns. |

### What's Reused vs New

| Layer | Reused | New |
|---|---|---|
| **Backend models** | User, Team, TeamMember, UserQuota, TeamQuota, ModelPricing, AIProviderConfig, SkillExecutionLog, AICallLog, QuotaUsageLog | AdminAuditLog (optional — structured admin action events) |
| **Backend routes** | `/quota/*`, `/billing/*`, `/logs/*`, `/ai-providers/*` | `/admin/users`, `/admin/teams`, `/admin/dashboard`, `/admin/audit-log` |
| **Backend deps** | `get_current_user`, `require_admin`, `get_db` | None new |
| **Frontend lib** | `api.ts` axios instance, JWT interceptors | `adminApi` namespace in same file |
| **Frontend stores** | `auth-store.ts` (user.is_admin) | None new |
| **Frontend components** | KPICards, UsageChart, ProviderPieChart, UsageTable, TaskList, StatusBadge, Topbar | AdminGuard, AdminShell, AdminSidebar, UserTable, QuotaEditor, TeamOverviewTable, AdminKPICards |
| **Frontend pages** | None directly | 7 new pages under `/admin/*` |

### New Backend Endpoints Needed

```
GET    /api/v1/admin/users              — paginated user list (search, filter by status/admin)
PATCH  /api/v1/admin/users/{id}/status  — enable/disable (set status active/banned)
PATCH  /api/v1/admin/users/{id}/admin   — grant/revoke is_admin
GET    /api/v1/admin/teams              — all teams with member counts
GET    /api/v1/admin/dashboard          — aggregate KPIs (user count, team count, task stats, cost)
GET    /api/v1/admin/audit-log          — admin action history (paginated)
```

Existing endpoints used as-is by admin frontend:
```
GET    /api/v1/quota/user/{id}          — view user quota (already admin-guarded)
PUT    /api/v1/quota/user/{id}          — set user quota (already admin-guarded)
GET    /api/v1/quota/team/{id}          — view team quota (already admin-guarded)
PUT    /api/v1/quota/team/{id}          — set team quota (already admin-guarded)
POST   /api/v1/billing/pricing/         — create pricing (already admin-guarded)
GET    /api/v1/billing/pricing/         — list pricing (any auth)
PATCH  /api/v1/billing/pricing/{id}     — update pricing (already admin-guarded)
DELETE /api/v1/billing/pricing/{id}     — deactivate pricing (already admin-guarded)
GET    /api/v1/billing/usage-stats/     — usage stats (admin sees global)
GET    /api/v1/billing/usage-timeseries/— timeseries (admin sees global)
GET    /api/v1/ai-providers/?owner_type=system — system providers (admin-guarded)
POST   /api/v1/ai-providers/            — create provider (admin when system)
GET    /api/v1/logs/tasks               — task list (admin sees all)
GET    /api/v1/logs/tasks/counts        — task counts (admin sees all)
```

## Anti-Patterns

### 1. Don't Duplicate Admin Logic in Frontend

The frontend should never filter data client-side to enforce admin scope. If a React Query response contains user-scoped data, the *backend* is wrong — fix the query, don't add `if (isAdmin)` branches in JSX to hide rows.

### 2. Don't Create a Separate Axios Instance for Admin

The existing `api` axios instance already handles JWT, token refresh, and 401 redirects. Creating a second instance (`adminApi = axios.create(...)`) would duplicate interceptor logic. Instead, add an `adminApi` namespace object that uses the shared instance:

```typescript
export const adminApi = {
  listUsers: (params) => api.get("/admin/users", { params }),
  ...
};
```

### 3. Don't Put Admin State in Zustand

Admin pages have no cross-page shared state that isn't already handled by React Query caching. Adding an admin Zustand store would create sync problems (stale cache vs store) and unnecessary complexity. Use React Query + `useState` for local UI state.

### 4. Don't Build a Generic "Admin Framework"

Avoid building configurable table/form generators, dynamic column renderers, or admin-specific component libraries. The admin console has ~7 pages with known schemas. Use direct, purpose-built components.

### 5. Don't Mix Admin and Regular Nav in One Sidebar

Admin navigation has different IA and different user intent. Hiding admin links behind a collapsible section in the regular sidebar creates confusion. Use a separate admin layout with its own sidebar. Connect the two with a clear "Back to App" / "Admin Console" link.

### 6. Don't Forget the "Last Admin" Safeguard

When revoking admin or disabling a user, the backend must check that at least one active admin remains. The existing team code does this for `team_admin` removal — apply the same pattern for `is_admin` revocation.

### 7. Don't Lift Log Scope Without Pagination Safety

Admin queries that remove `user_id` filters can return massive result sets. Every admin-scoped list endpoint must enforce `limit` (with a reasonable max, e.g., 100) and return `X-Total-Count` for pagination — same pattern already used in `/logs/tasks`.

## Sources

- `api/app/core/deps.py` — `require_admin`, `get_current_user`, role priority maps
- `api/app/models/user.py` — `User.is_admin`, `User.status`
- `api/app/api/v1/quota.py` — admin-guarded quota CRUD with audit logging pattern
- `api/app/api/v1/billing.py` — admin scope lift pattern (bypass user_id filter)
- `api/app/api/v1/logs.py` — mixed admin/user scope, pagination with X-Total-Count
- `api/app/api/v1/ai_providers.py` — ownership-scoped provider management (system/team/personal)
- `api/app/api/v1/router.py` — route registration pattern
- `web/src/components/auth/auth-guard.tsx` — route protection pattern
- `web/src/components/layout/app-shell.tsx` — layout composition (Sidebar + Topbar)
- `web/src/components/layout/sidebar.tsx` — nav structure, Obsidian Lens tokens
- `web/src/components/billing/billing-dashboard.tsx` — KPI + chart + table composition
- `web/src/components/tasks/task-monitor-page.tsx` — paginated list with admin awareness
- `web/src/stores/auth-store.ts` — `user.is_admin` already in client state
- `web/src/lib/api.ts` — API client pattern, namespace exports
- `web/src/components/providers.tsx` — QueryClient + AuthGuard wrapper
