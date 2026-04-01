# Phase 08: Admin Frontend Shell - Research

**Researched:** 2026-04-01
**Domain:** Next.js 16 App Router layout architecture, admin UI scaffolding, API client extension
**Confidence:** HIGH

## Summary

Phase 08 establishes the admin frontend foundation: route guard, independent layout, sidebar navigation, API client namespaces, and new dependencies. The research confirms all requirements are achievable with established project patterns — **no new architectural patterns** are needed. The existing `AdminGuard` component already handles `is_admin` verification via `/auth/me` refresh and can be reused directly in `app/admin/layout.tsx`. Next.js 16 App Router provides automatic per-route code splitting, so placing all admin pages under `app/admin/` naturally isolates them from the regular bundle without `next/dynamic`.

The admin shell uses `--cv4-*` CSS custom property tokens (identical values to Obsidian Lens `--ob-*` for the admin palette) with inline styles — the established Phase 04–06 pattern. Two new dependencies (`@tanstack/react-table@^8.21` and `sonner@^2.0`) are required but only installed in this phase; actual table usage begins in Phase 09+.

**Primary recommendation:** Use direct `app/admin/` directory (not route group), compose `AdminGuard` + `AdminShell` in `app/admin/layout.tsx`, add one new CSS token `--cv4-btn-secondary-border`, and define all admin/quota API methods upfront.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** AdminShell fully independent from AppShell — new `AdminShell` + `AdminSidebar` components, no shared layout code. Visual style consistent (uses `--ob-*` / `--cv4-*` tokens), but layout components separated.
- **D-02:** AdminSidebar fixed expanded (always show icon + text), no collapse support. Only 7-8 nav items.
- **D-03:** "Back to App" in AdminShell Topbar top-left (back arrow + text), not in sidebar. AdminSidebar only has nav items.
- **D-04:** Claude's Discretion — route file structure (`app/admin/` direct vs `app/(admin)/admin/` route group) decided by Claude based on Next.js 16 best practices.
- **D-05:** All nav targets get placeholder pages (Dashboard / Users / Teams / Quotas / Pricing / Providers / Monitoring) with title + empty state.
- **D-06:** Code splitting via Next.js App Router automatic per-route splitting — no extra `next/dynamic` lazy loading.
- **D-07:** New `adminApi` + `quotaApi` dual namespaces; reuse existing `billingApi` (pricing CRUD) and `aiProvidersApi` (system provider).
- **D-08:** `adminApi` covers `/admin/*` endpoints: `listUsers()`, `toggleUserStatus()`, `toggleUserAdmin()`, `listTeams()`, `getDashboard()`.
- **D-09:** `quotaApi` covers `/quota/*` admin endpoints: `getUserQuota()`, `updateUserQuota()`, `getTeamQuota()`, `updateTeamQuota()`.
- **D-10:** Phase 08 defines all method signatures upfront; Phases 09–11 consume without editing `api.ts` again.
- **D-11:** "Admin Console" entry at Sidebar bottom, below Billing, with thin divider separating from BOTTOM_ITEMS. Only when `user.is_admin`.
- **D-12:** Entry visual matches other nav items (icon + text, lucide-react), divider provides sufficient distinction.

### Claude's Discretion
- AdminShell Topbar layout details (back button position, title display)
- AdminSidebar icon selection (lucide-react)
- Placeholder page empty state copy and visuals
- sonner Toaster Obsidian Lens theme configuration details
- Route file structure choice (`app/admin/` or route group)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-17 | Admin route guard and layout — `AdminGuard` checking `user.is_admin`, separate `AdminShell` layout with `AdminSidebar`, admin pages code-split, re-validate `/auth/me` on mount | Existing `AdminGuard` reusable directly; `app/admin/layout.tsx` provides code splitting and layout nesting; pattern verified with Next.js 16 docs |
| REQ-18 | Admin API client and dependencies — `adminApi` + `quotaApi` namespaces in `api.ts`, install `@tanstack/react-table` (^8.21) and `sonner` (^2.0), Toaster with Obsidian Lens theming | Backend API contracts verified from source; package versions confirmed current (8.21.3 / 2.0.7); sonner theming approach documented |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js (App Router) | 16.2.1 | Route-based code splitting, layout nesting | Already installed; layout.tsx at `app/admin/` automatically isolates admin bundle |
| React | 19.2.4 | UI rendering | Already installed |
| lucide-react | ^1.7.0 | Admin sidebar/topbar icons | Already installed; icons specified in UI-SPEC (shield, layout-dashboard, users, etc.) |
| zustand | ^5.0.12 | Client auth state (`useAuthStore`, `is_admin` check) | Already installed; established auth hydration pattern |
| @tanstack/react-query | ^5.95.2 | Server state (admin data fetching in Phase 09+) | Already installed |
| axios | ^1.13.6 | HTTP client (admin/quota API namespaces) | Already installed; established interceptor pattern |

### New Dependencies (Phase 08)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-table | ^8.21 | Headless table for admin user/team/pricing tables (Phase 09+) | Install now, consume later |
| sonner | ^2.0 | Toast notifications with custom theming | Mount Toaster in AdminShell layout; use for admin action feedback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sonner | react-hot-toast | sonner has built-in theme customization via CSS vars; react-hot-toast requires more wrapper code |
| @tanstack/react-table | ag-grid / react-table v7 | TanStack Table v8 is headless (zero bundle for unused features), pairs with inline styles pattern |
| Route group `(admin)` | Direct `app/admin/` | Route group adds no value here — admin routes SHOULD appear at `/admin/*` URL. Direct directory is simpler and correct. |

**Installation:**
```bash
cd web && npm install @tanstack/react-table@^8.21 sonner@^2.0
```

**Version verification:** `@tanstack/react-table@8.21.3` (confirmed via npm registry 2026-04-01), `sonner@2.0.7` (confirmed via npm registry 2026-04-01).

## Architecture Patterns

### Recommended Route Structure
```
web/src/app/admin/
├── layout.tsx          ← "use client"; AdminGuard + AdminShell + Toaster
├── page.tsx            ← Dashboard placeholder (KPI cards with "—" values)
├── users/page.tsx      ← Placeholder
├── teams/page.tsx      ← Placeholder
├── quotas/page.tsx     ← Placeholder
├── pricing/page.tsx    ← Placeholder
├── providers/page.tsx  ← Placeholder
└── monitoring/page.tsx ← Placeholder

web/src/components/admin/
├── admin-shell.tsx     ← Flex container (sidebar + right column)
├── admin-sidebar.tsx   ← Fixed 240px, nav items with active state
└── admin-topbar.tsx    ← Sticky 48px, back link + title + user info
```

**Rationale for `app/admin/` (direct, not route group):**
- Admin routes MUST appear at `/admin/*` URL — route group `(admin)` would be used to OMIT from URL path, which is opposite of what we want
- Direct `app/admin/layout.tsx` is a nested layout under root `app/layout.tsx` — it inherits font variables, QueryClient, and AuthGuard, then adds AdminGuard + AdminShell
- Next.js 16 automatically code-splits per route segment: `app/admin/**` pages only load when user visits `/admin/*`
- No `next/dynamic` needed — App Router layout nesting handles isolation

### Pattern 1: AdminGuard in Layout (REQ-17)
**What:** Wrap `AdminGuard` at the `app/admin/layout.tsx` level so ALL admin routes are protected.
**When to use:** Always — single point of admin access control.
**Example:**
```typescript
// Source: Existing AdminGuard pattern at web/src/components/auth/admin-guard.tsx
// app/admin/layout.tsx
"use client";

import { AdminGuard } from "@/components/auth/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { Toaster } from "sonner";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--cv4-surface-primary)",
            color: "var(--cv4-text-primary)",
            border: "1px solid var(--cv4-border-default)",
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            borderRadius: 8,
          },
        }}
      />
    </AdminGuard>
  );
}
```

### Pattern 2: AdminShell Layout (D-01)
**What:** Independent layout container with sidebar + topbar + main content area.
**When to use:** Wraps all admin route children.
**Example:**
```typescript
// web/src/components/admin/admin-shell.tsx
"use client";

import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
      <AdminSidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <AdminTopbar />
        <main style={{ flex: 1, padding: 32, overflowY: "auto", background: "var(--cv4-canvas-bg)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
```

### Pattern 3: Sidebar Nav with Active State (D-02)
**What:** Fixed-width sidebar with usePathname-driven active state highlighting.
**When to use:** AdminSidebar component.
**Example:**
```typescript
// Follows existing Sidebar pattern at web/src/components/layout/sidebar.tsx
const pathname = usePathname();
const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
// Active: bg cv4-active-highlight, text cv4-text-primary, weight 700
// Default: bg transparent, text cv4-text-muted, weight 400
// Hover: bg cv4-hover-highlight, text cv4-text-secondary
```

### Pattern 4: API Client Namespace Extension (D-07 through D-10)
**What:** Add `adminApi` and `quotaApi` objects to `api.ts` following existing namespace pattern.
**When to use:** All admin data operations.
**Example:**
```typescript
// Follows existing pattern in web/src/lib/api.ts
export const adminApi = {
  listUsers: (params?: { q?: string; status?: string; is_admin?: boolean; sort_by?: string; sort_order?: string; limit?: number; offset?: number }) =>
    api.get("/admin/users", { params }),
  toggleUserStatus: (userId: string, data: { status: "active" | "banned" }) =>
    api.patch(`/admin/users/${userId}/status`, data),
  toggleUserAdmin: (userId: string, data: { is_admin: boolean }) =>
    api.patch(`/admin/users/${userId}/admin`, data),
  listTeams: (params?: { q?: string; limit?: number; offset?: number }) =>
    api.get("/admin/teams", { params }),
  getDashboard: () => api.get("/admin/dashboard"),
};

export const quotaApi = {
  getUserQuota: (userId: string) => api.get(`/quota/user/${userId}`),
  updateUserQuota: (userId: string, data: { monthly_credit_limit?: number; daily_call_limit?: number }) =>
    api.put(`/quota/user/${userId}`, data),
  getTeamQuota: (teamId: string) => api.get(`/quota/team/${teamId}`),
  updateTeamQuota: (teamId: string, data: { monthly_credit_limit?: number; daily_call_limit?: number }) =>
    api.put(`/quota/team/${teamId}`, data),
};
```

### Pattern 5: Conditional Sidebar Admin Entry (D-11, D-12)
**What:** Add "Admin Console" link in existing Sidebar below BOTTOM_ITEMS when `user.is_admin`.
**When to use:** Modification to `web/src/components/layout/sidebar.tsx`.
**Example:**
```typescript
// After BOTTOM_ITEMS.map(renderNavLink), add:
{user?.is_admin && (
  <>
    <div style={{ height: 1, background: "var(--ob-glass-border)", margin: "8px 12px" }} />
    <Link href="/admin" style={/* same as renderNavLink style */}>
      <Shield size={16} />
      Admin Console
    </Link>
  </>
)}
```

### Anti-Patterns to Avoid
- **Sharing layout components between App and Admin:** D-01 explicitly requires independent AdminShell. Do NOT import AppShell's Sidebar/Topbar.
- **Using `next/dynamic` for code splitting:** D-06 confirms App Router automatic splitting is sufficient. Adding `next/dynamic` would be unnecessary complexity.
- **Putting AdminGuard in each page:** Guard belongs in `layout.tsx` — single point of control.
- **Creating a separate root layout for admin:** This would cause full page reload when navigating between admin and app. Instead, nest under existing root layout.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast with portal/animation | `sonner` | Handles stacking, duration, themes, dismiss, accessibility |
| Data tables | Custom `<table>` with sort/filter | `@tanstack/react-table` | Headless API handles pagination, sorting, filtering, column visibility |
| Route-level code splitting | Manual `React.lazy()` / `next/dynamic` | Next.js App Router `app/admin/` | Automatic per-segment splitting is built-in |
| Admin route guard | Custom auth middleware | Existing `AdminGuard` component | Already implements hydration gate + `/auth/me` re-validation |

**Key insight:** This phase is primarily composition of existing patterns. The only genuinely new code is AdminShell/AdminSidebar/AdminTopbar components (following established inline-style patterns) and API namespace definitions (following established `api.ts` patterns).

## Common Pitfalls

### Pitfall 1: Layout Nesting vs Root Layout Confusion
**What goes wrong:** Creating `app/admin/layout.tsx` as a root layout (with `<html>` and `<body>` tags) instead of a nested layout.
**Why it happens:** Misunderstanding Next.js layout hierarchy.
**How to avoid:** `app/admin/layout.tsx` is a nested layout under `app/layout.tsx`. It should NOT contain `<html>` or `<body>`. The root layout already provides these + font variables + QueryClientProvider + AuthGuard.
**Warning signs:** Duplicate `<html>` tags in DevTools, fonts not loading in admin pages, QueryClient not available.

### Pitfall 2: AdminGuard Double-Mounting
**What goes wrong:** AdminGuard's `useEffect` fires the `/auth/me` call on every admin page navigation.
**Why it happens:** Next.js layouts persist across child route changes, but `useEffect` deps may trigger re-runs.
**How to avoid:** The existing AdminGuard uses `[hydrated, isAuthenticated, router, setAuth]` deps — `hydrated` and `isAuthenticated` don't change on navigation, so the effect only runs once per mount. Verify this behavior doesn't change.
**Warning signs:** Multiple `/auth/me` calls in Network tab when switching between admin sub-pages.

### Pitfall 3: Sonner Theme Not Matching Admin Palette
**What goes wrong:** Toasts appear with default sonner styling (white bg, dark text) instead of Obsidian Lens/CV4 styling.
**Why it happens:** Forgetting to pass `toastOptions.style` with CSS custom properties.
**How to avoid:** Configure Toaster in `app/admin/layout.tsx` with explicit `toastOptions.style` using `--cv4-*` variables as documented in UI-SPEC.
**Warning signs:** Toast background/text color doesn't match admin shell palette.

### Pitfall 4: Sidebar Active State for `/admin` (Index) Route
**What goes wrong:** Dashboard nav item shows active when on ANY `/admin/*` route because `pathname?.startsWith("/admin")` is always true.
**Why it happens:** The Dashboard route is `/admin` (index), and all admin routes start with `/admin`.
**How to avoid:** For the Dashboard item, use exact match: `pathname === "/admin"`. For all other items, use prefix match: `pathname?.startsWith(item.href + "/") || pathname === item.href`.
**Warning signs:** Dashboard nav item highlighted when viewing `/admin/users`.

### Pitfall 5: Missing `--cv4-btn-secondary-border` Token
**What goes wrong:** Secondary buttons have no border in admin shell.
**Why it happens:** This is a NEW token not yet in `globals.css`.
**How to avoid:** Add `--cv4-btn-secondary-border` to both `:root, .theme-dark` and `.theme-light` blocks in `globals.css` before implementing buttons.
**Warning signs:** `getComputedStyle` returns empty string for `--cv4-btn-secondary-border`.

### Pitfall 6: Manrope Font Weight 400 Not Loaded
**What goes wrong:** Body text in admin pages renders in fallback font or wrong weight.
**Why it happens:** Root layout loads Manrope with weights `['400', '500', '600']` — UI-SPEC needs 400 and 700. Weight 700 is NOT currently loaded.
**How to avoid:** Update `Manrope()` call in `app/layout.tsx` to include weight `'700'` in the array. This is a prerequisite for `navItemActive` (12px/700/Manrope) and `buttonPrimary` (12px/700/Manrope).
**Warning signs:** Bold nav items or buttons don't appear bold in admin pages.

## Code Examples

### Backend API Contract Reference

All endpoints verified from source code. Response schemas from `app/schemas/admin.py` and `app/schemas/quota.py`.

#### GET /admin/users
```typescript
// Query params
{ q?: string; status?: string; is_admin?: boolean; sort_by?: "created_at" | "last_login_at" | "email"; sort_order?: "asc" | "desc"; limit?: number; offset?: number }
// Response: AdminUserListResponse
{ items: AdminUserListItem[]; total: number; limit: number; offset: number }
// AdminUserListItem: { id, email, nickname, avatar?, status, is_admin, last_login_at?, created_at }
```

#### PATCH /admin/users/{id}/status
```typescript
// Body: { status: "active" | "banned" }
// Response: AdminUserListItem
```

#### PATCH /admin/users/{id}/admin
```typescript
// Body: { is_admin: boolean }
// Response: AdminUserListItem
// Error 400: "Cannot demote yourself" | "Cannot remove the last active admin"
```

#### GET /admin/teams
```typescript
// Query params: { q?: string; limit?: number; offset?: number }
// Response: { items: AdminTeamListItem[]; total: number; limit: number; offset: number }
// AdminTeamListItem: { id, name, description?, created_at, member_count }
```

#### GET /admin/dashboard
```typescript
// Response: AdminDashboardResponse
{
  total_users: number;
  total_teams: number;
  active_tasks: number;
  total_cost: number;
  provider_status: { enabled_count: number; disabled_count: number };
  windows: { h24: WindowStats; d7: WindowStats; d30: WindowStats };
}
// WindowStats: { tasks_total, tasks_failed, cost_total }
```

#### GET/PUT /quota/user/{id} and /quota/team/{id}
```typescript
// GET Response: QuotaResponse
{ user_id?: string; team_id?: string; monthly_credit_limit?: number; daily_call_limit?: number; current_month_usage: number; current_day_calls: number }
// PUT Body: QuotaUpdate
{ monthly_credit_limit?: number; daily_call_limit?: number }
```

### Existing Reusable APIs (No New Methods Needed)
```typescript
// billingApi — already has pricing CRUD
billingApi.pricing()  // GET /billing/pricing/ — list pricing

// aiProvidersApi — already has system provider CRUD
aiProvidersApi.list({ owner_type: "system" })  // GET /ai-providers/ — system providers
aiProvidersApi.create(data)  // POST /ai-providers/
aiProvidersApi.update(id, data)  // PATCH /ai-providers/{id}
aiProvidersApi.delete(id)  // DELETE /ai-providers/{id}
aiProvidersApi.addKey(id, data)  // POST /ai-providers/{id}/keys
aiProvidersApi.deleteKey(id, keyId)  // DELETE /ai-providers/{id}/keys/{keyId}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next/dynamic` for code splitting | App Router automatic per-route splitting | Next.js 13+ | No manual lazy loading needed for route-level components |
| Separate auth context for admin | Zustand `is_admin` field + AdminGuard | Phase 06 | Single source of truth for admin status |
| Custom CSS classes for theming | Inline styles with CSS custom properties | Phase 04–06 | Consistent theming without CSS class management |

**Note on Next.js 16:**
- `params` prop in layouts is now a `Promise` (since v15.0.0-RC) — not relevant for admin layout since there are no dynamic route segments
- `LayoutProps` helper available for typed layouts — not needed for admin (no dynamic params or parallel routes)
- Root layout can be omitted in favor of sub-directory layouts — NOT recommended here; keep root `app/layout.tsx` for fonts/providers

## Open Questions

1. **Manrope weight 700 loading**
   - What we know: Root layout currently loads Manrope with weights `['400', '500', '600']`
   - What's unclear: Whether adding `'700'` will affect bundle size significantly
   - Recommendation: Add it — the UI-SPEC requires weight 700 for active nav items and primary buttons. Google Fonts variable font subsetting keeps impact minimal (~2-5KB).

2. **Existing `/settings/ai` page refactoring**
   - What we know: `/settings/ai/page.tsx` currently uses `AdminGuard` + `AppShell` wrapper inline
   - What's unclear: Whether this page should be migrated to `/admin/providers` in this phase
   - Recommendation: Do NOT migrate in Phase 08. This page remains at `/settings/ai` for team-scoped provider management. Phase 10 builds the separate `/admin/providers` page for system-scope only.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no vitest/jest config, no test files in `web/` |
| Config file | none — needs creation in Wave 0 if tests required |
| Quick run command | `npm run test` (script exists in package.json but no test runner installed) |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-17 | AdminGuard blocks non-admin | manual | Navigate to `/admin` as non-admin user | N/A |
| REQ-17 | AdminShell layout renders | manual | Visual inspection of admin pages | N/A |
| REQ-17 | Code splitting isolates admin | manual | Check Network tab — admin JS not loaded on `/projects` | N/A |
| REQ-17 | `/auth/me` re-validation on mount | manual | Check Network tab — `/auth/me` called on admin entry | N/A |
| REQ-18 | `adminApi` + `quotaApi` defined | manual-only | TypeScript compilation confirms no type errors | ❌ |
| REQ-18 | `@tanstack/react-table` installed | smoke | `npm ls @tanstack/react-table` | ❌ |
| REQ-18 | `sonner` Toaster renders | manual | Navigate to admin, verify toast container in DOM | N/A |
| REQ-18 | Sidebar shows Admin Console for admin | manual | Login as admin, check sidebar | N/A |

### Sampling Rate
- **Per task commit:** TypeScript compilation (`npm run build`)
- **Per wave merge:** Visual verification of admin shell rendering
- **Phase gate:** Manual UAT against all 7 success criteria

### Wave 0 Gaps
- No frontend test infrastructure exists (no vitest, no jest, no test files)
- All Phase 08 validation is manual/visual + TypeScript compilation
- Test infrastructure setup is deferred — this phase is pure scaffolding with no business logic to unit-test

## Sources

### Primary (HIGH confidence)
- Next.js 16.2.1 built-in docs (`node_modules/next/dist/docs/`) — layout.md, route-groups.md verified
- Codebase source code — all existing components, API endpoints, schemas read directly

### Secondary (MEDIUM confidence)
- npm registry — `@tanstack/react-table@8.21.3`, `sonner@2.0.7` versions verified via `npm view`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project or verified against npm registry
- Architecture: HIGH — patterns directly match existing codebase (AppShell, Sidebar, api.ts namespaces)
- Pitfalls: HIGH — identified from reading actual source code (font weights, token gaps, active state logic)

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable — foundational UI scaffolding, no fast-moving dependencies)
