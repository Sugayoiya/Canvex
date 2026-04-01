---
phase: 09-user-team-management-ui
plan: 02
subsystem: frontend/admin-users
tags: [admin, users, table, mutations, badges, modal, dropdown]
dependency_graph:
  requires: [09-01]
  provides: [admin-users-page, status-badge, admin-badge, row-dropdown-menu, confirmation-modal]
  affects: [web/src/app/admin/users/page.tsx, web/src/components/admin/]
tech_stack:
  added: []
  patterns: [TanStack Table manual pagination/sorting, React Query mutations with toast feedback, portal dropdown/modal, focus trap]
key_files:
  created:
    - web/src/components/admin/status-badge.tsx
    - web/src/components/admin/admin-badge.tsx
    - web/src/components/admin/row-dropdown-menu.tsx
    - web/src/components/admin/confirmation-modal.tsx
  modified:
    - web/src/app/admin/users/page.tsx
decisions:
  - "MODAL_COPY as const object map for all 4 action types — avoids switch statement sprawl"
  - "columnHelper.display for actions column — no accessor needed for non-data column"
  - "ModalState with union action type — single modal instance handles all 4 action flows"
metrics:
  duration: "~3 minutes"
  completed: 2026-04-01
---

# Phase 09 Plan 02: User Management Page Interaction Components & Assembly Summary

**One-liner:** 4 reusable admin interaction components (badges, dropdown, modal) + full Users page with TanStack Table, React Query mutations, Chinese toast feedback, and self-action prevention guards.

## What Was Built

### Task 1: Interaction Components (4 files)

| Component | File | Purpose |
|-----------|------|---------|
| `StatusBadge` | `web/src/components/admin/status-badge.tsx` | Active (green) / Banned (red) colored badge with ARIA label |
| `AdminBadge` | `web/src/components/admin/admin-badge.tsx` | Purple "Admin" badge, returns null for non-admins |
| `RowDropdownMenu` | `web/src/components/admin/row-dropdown-menu.tsx` | Portal-rendered actions dropdown with Escape close, outside-click dismiss, disabled item tooltips |
| `ConfirmationModal` | `web/src/components/admin/confirmation-modal.tsx` | Portal dialog with `scale(0.96)` enter animation, focus trap (Tab/Shift+Tab), warning section |

All components use `"use client"`, inline styles with `--cv4-*` / `--ob-*` CSS custom properties, lucide-react icons, and full ARIA support (`role="menu"`, `role="menuitem"`, `role="dialog"`, `aria-modal="true"`, `aria-haspopup="menu"`).

### Task 2: Users Page Assembly

Replaced Phase 08 placeholder with full user management implementation:

- **8-column TanStack Table:** Name (bold), Email (sortable), Status (badge), Admin (badge), Teams (count/list), Last Login (relative time, sortable), Created (YYYY-MM-DD, sortable), Actions (dropdown)
- **Server-side data:** React Query `useQuery` with `["admin", "users", queryParams]` key, `adminApi.listUsers`
- **300ms debounced search** via `useEffect` + `setTimeout`
- **Status + Admin filters** with pagination reset on any filter/search change
- **Toggle mutations:** `toggleStatus` and `toggleAdmin` via `useMutation`, both with cache invalidation on success and error
- **Chinese toast messages:** `已封禁 {email}`, `已启用 {email}`, `已授予 {email} 管理员权限`, `已撤销 {email} 管理员权限`
- **Self-action prevention:** "Ban User" disabled on own row ("Cannot ban yourself"), "Revoke Admin" disabled on own row ("Cannot revoke your own admin role")
- **Last-admin guard:** "Revoke Admin" disabled when `admin_count <= 1` ("Cannot revoke — last admin")
- **Backend error handling:** `onError` catches 400/422 from backend guards, shows `操作失败:` toast, and refetches table to sync UI state
- **Modal copy:** Exact copy per UI-SPEC for all 4 actions (ban/enable/grant/revoke) including the "revoke" warning
- **States:** Loading skeletons, error state with retry, contextual empty states (filtered vs no data)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `2e49d63` | StatusBadge, AdminBadge, RowDropdownMenu, ConfirmationModal components |
| 2 | `860d8bb` | Users page with TanStack Table, React Query, mutations |

## Verification

- `npx tsc --noEmit` — exit 0 (zero TypeScript errors)
- All acceptance criteria verified via grep: 28 pattern matches for required features
- No placeholder text remaining ("Coming in Phase 9" removed)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are wired to `adminApi.listUsers` / `toggleUserStatus` / `toggleUserAdmin`.

## Self-Check: PASSED
