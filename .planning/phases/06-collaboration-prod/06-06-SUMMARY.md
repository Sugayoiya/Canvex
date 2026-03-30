---
phase: 06-collaboration-prod
plan: 06
subsystem: ui
tags: [login, oauth, sidebar, layout, obsidian-lens, glassmorphism, space-switcher]
dependency_graph:
  requires:
    - phase: 06-03
      provides: Obsidian Lens design tokens, auth store with team/space state, API client
  provides:
    - Obsidian Lens login page with OAuth callback handling
    - AppShell layout (Sidebar + Topbar) for all management pages
    - Space switcher (personal/team) in sidebar
  affects: [projects-page, teams-page, settings-page, all-management-pages]
tech_stack:
  added: []
  patterns: [glassmorphism-cards, space-switcher-dropdown, oauth-url-param-callback, inline-style-with-css-vars]
key_files:
  created:
    - web/src/components/layout/app-shell.tsx
    - web/src/components/layout/topbar.tsx
  modified:
    - web/src/app/(auth)/login/page.tsx
    - web/src/app/(auth)/layout.tsx
    - web/src/components/layout/sidebar.tsx
key_decisions:
  - "Suspense boundary wrapping LoginContent for useSearchParams SSR safety"
  - "Inline styles with CSS custom properties (not Tailwind classes) matching Obsidian Lens spec"
  - "OAuth callback via URL params (access_token/refresh_token) with history.replaceState cleanup"
patterns-established:
  - "Glass card pattern: ob-glass-bg + backdrop-filter blur(12px) + ob-glass-border"
  - "Label style: font-headline, 10px, 700, uppercase, 0.2em letter-spacing"
  - "Space switcher dropdown: absolute positioned over sidebar with ob-surface-highest bg"
requirements-completed: [REQ-11]
metrics:
  duration: ~3min
  completed: "2026-03-30T14:55:52Z"
  tasks: 2
  files: 5
---

# Phase 06 Plan 06: Login & AppShell Summary

**Obsidian Lens login page with Google/GitHub OAuth + glassmorphism AppShell with sidebar space-switcher and breadcrumb topbar**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-30T14:53:01Z
- **Completed:** 2026-03-30T14:55:52Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Redesigned login page with Obsidian Lens aesthetic: glass card, dot-grid background, brand identity, Google/GitHub OAuth buttons
- OAuth callback handling via URL params with auto-redirect for authenticated users
- AppShell layout composing Sidebar + Topbar + dot-grid content area for all management pages
- Sidebar with personal/team space switcher dropdown using auth store switchSpace

## Task Commits

Each task was committed atomically:

1. **Task 1: Login page with Obsidian Lens design + OAuth** - `d880c61` (feat)
2. **Task 2: AppShell + Sidebar with space switcher + Topbar** - `f8b16dd` (feat)

## Files Created/Modified

- `web/src/app/(auth)/layout.tsx` - Full-screen centered layout with ob-surface-base + dot-grid
- `web/src/app/(auth)/login/page.tsx` - Obsidian Lens login with OAuth buttons, glass card, email form, callback handling
- `web/src/components/layout/topbar.tsx` - Topbar with breadcrumbs, search, bell icon, user avatar
- `web/src/components/layout/sidebar.tsx` - Sidebar with space switcher, nav items, Obsidian Lens tokens
- `web/src/components/layout/app-shell.tsx` - AppShell composing Sidebar + Topbar + content area

## Decisions Made

- Used `Suspense` boundary to wrap `LoginContent` for `useSearchParams` SSR compatibility in Next.js 16
- Inline styles with CSS custom properties (--ob-*) matching the Obsidian Lens spec rather than Tailwind classes for design fidelity
- OAuth callback reads tokens from URL search params and cleans URL via `history.replaceState`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all code is functional, no placeholder data or TODOs.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- AppShell ready for all management pages (projects, teams, settings, AI console) to compose
- Login page handles OAuth flow end-to-end with callback token extraction
- Space switcher wired to auth store for personal/team context across the app

---
*Phase: 06-collaboration-prod*
*Completed: 2026-03-30*
