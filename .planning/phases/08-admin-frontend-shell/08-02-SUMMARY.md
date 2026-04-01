---
phase: 08-admin-frontend-shell
plan: 02
subsystem: frontend/admin
tags: [admin-shell, layout, routing, placeholder, sidebar]
dependency_graph:
  requires: [08-01]
  provides: [admin-shell-layout, admin-routes, admin-sidebar-entry]
  affects: [web/src/components/layout/sidebar.tsx]
tech_stack:
  added: [sonner-toaster-admin]
  patterns: [independent-admin-shell, cv4-token-theming, admin-guard-layout, conditional-sidebar-entry]
key_files:
  created:
    - web/src/components/admin/admin-shell.tsx
    - web/src/components/admin/admin-sidebar.tsx
    - web/src/components/admin/admin-topbar.tsx
    - web/src/app/admin/layout.tsx
    - web/src/app/admin/page.tsx
    - web/src/app/admin/users/page.tsx
    - web/src/app/admin/teams/page.tsx
    - web/src/app/admin/quotas/page.tsx
    - web/src/app/admin/pricing/page.tsx
    - web/src/app/admin/providers/page.tsx
    - web/src/app/admin/monitoring/page.tsx
  modified:
    - web/src/components/layout/sidebar.tsx
decisions:
  - Independent AdminShell (not extending AppShell) for complete admin visual isolation per D-01
  - Dashboard exact-match route to avoid always-active nav highlight per Pitfall 4
  - Sonner Toaster with --cv4-* themed styles mounted at admin layout level
metrics:
  duration: 2m 39s
  completed: "2026-04-01T07:09:56Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 11
  files_modified: 1
---

# Phase 08 Plan 02: Admin Shell Layout & Route Structure Summary

Independent admin frontend shell with AdminGuard-protected routes, 7-nav sidebar, sticky topbar, Dashboard with KPI placeholders, 6 section placeholder pages, and conditional Admin Console entry in main sidebar.

## What Was Built

### AdminShell Component Suite (Task 1)

**AdminSidebar** (`admin-sidebar.tsx`): Fixed 240px sidebar with Shield logo, "Admin / Production Suite" branding, and 7 navigation items (Dashboard, Users, Teams, Quotas, Pricing, Providers, Monitoring). Uses `exact: true` for Dashboard to prevent always-active state. Full accessibility with `aria-label="Admin navigation"` and `aria-current="page"` on active item. Active/hover/default states use `--cv4-active-highlight`, `--cv4-hover-highlight`, and `--cv4-text-muted` tokens respectively.

**AdminTopbar** (`admin-topbar.tsx`): 48px sticky header with backdrop blur. Left side: "Back to App" button navigating to `/projects` + "Admin Console" title. Right side: Bell notification icon with `aria-label="Notifications"`, vertical divider, user email, and avatar circle with initial.

**AdminShell** (`admin-shell.tsx`): Composition container using `100vw × 100vh` flex layout. Imports AdminSidebar + AdminTopbar, does NOT import from app-shell.tsx/sidebar.tsx/topbar.tsx (D-01 compliance).

### Admin Routes & Pages (Task 2)

**Admin Layout** (`admin/layout.tsx`): Nested layout (no `<html>`/`<body>` tags) wrapping `AdminGuard` → `AdminShell` → `{children}` + Sonner `Toaster` with `theme="dark"`, `position="bottom-right"`, and `--cv4-*` themed toast styles.

**Dashboard** (`admin/page.tsx`): Page header with "Dashboard" title + subtitle + Export Data/Generate Report buttons. 2×2 KPI grid with 4 cards (TOTAL USERS, ACTIVE TEAMS, TASKS (24H), TOTAL COST) showing em-dash placeholder values at 50% opacity. Footer badge indicating "Phase 11: Production Integration".

**6 Section Placeholders**: Each renders page header + centered empty state card with icon (48px, 50% opacity), "Coming in Phase N" message, and description text:
- Users (Phase 9), Teams (Phase 9)
- Quotas (Phase 10), Pricing (Phase 10), Providers (Phase 10)
- Monitoring (Phase 11)

**Main Sidebar Entry**: Conditional `Admin Console` link with Shield icon added below BOTTOM_ITEMS, guarded by `user?.is_admin`. Uses `--ob-*` tokens to match existing sidebar styling. Active state detection via `pathname?.startsWith("/admin")`.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | aced8da | feat(08-02): create AdminShell, AdminSidebar, AdminTopbar components |
| 2 | 5d21286 | feat(08-02): create admin routes, placeholder pages, and sidebar entry |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all placeholder pages are intentionally empty-state by design (downstream Phases 09–11 populate them). KPI cards show em-dash values as specified; no data wiring expected in this plan.

## Verification

- `npx tsc --noEmit` — zero errors after both tasks
- AdminShell does NOT import from app-shell.tsx, sidebar.tsx, or topbar.tsx (D-01 verified)
- Admin layout is nested (no `<html>`/`<body>` tags — Pitfall 1 avoided)
- All 8 admin pages created with correct titles and phase numbers
- Main sidebar conditionally shows Admin Console link for admin users only
