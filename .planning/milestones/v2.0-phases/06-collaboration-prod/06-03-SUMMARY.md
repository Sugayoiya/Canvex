---
phase: 06-collaboration-prod
plan: 03
subsystem: frontend-infrastructure
tags: [design-system, auth, api-client, fonts]
dependency_graph:
  requires: []
  provides: [obsidian-lens-tokens, auth-guard, space-switching, team-api-client]
  affects: [globals.css, layout.tsx, auth-store, api-client, providers]
tech_stack:
  added: [Space_Grotesk, Manrope]
  patterns: [css-custom-properties, zustand-persist, auth-guard-pattern]
key_files:
  created:
    - web/src/components/auth/auth-guard.tsx
  modified:
    - web/src/app/globals.css
    - web/src/app/layout.tsx
    - web/src/components/providers.tsx
    - web/src/stores/auth-store.ts
    - web/src/lib/api.ts
decisions:
  - "Obsidian Lens tokens in --ob-* namespace coexisting with --cv4-* Phase 04 tokens"
  - "Space Grotesk for headlines + Manrope for body replaces Geist font family"
  - "AuthGuard wraps inside QueryClientProvider for React Query access in protected routes"
  - "SpaceContext discriminated union type for personal vs team space switching"
  - "Exported Team/SpaceContext types from auth-store for consumer components"
metrics:
  duration: ~2min
  completed: "2026-03-30T14:48:17Z"
  tasks: 2
  files: 6
---

# Phase 06 Plan 03: Frontend Infrastructure Summary

Obsidian Lens design tokens (--ob-*), AuthGuard route protection, Space Grotesk/Manrope fonts, team/space auth store, and comprehensive API client for all Phase 06 backend endpoints.

## What Was Built

### Task 1: Design Tokens + AuthGuard + Fonts + Providers
- **globals.css**: Added 30+ Obsidian Lens CSS custom properties under `--ob-*` namespace (surfaces, colors, glass effects, glows, gradients, dot-grid) before existing Phase 04 `--cv4-*` tokens
- **layout.tsx**: Replaced Geist/Geist_Mono with Space Grotesk (--font-headline, weights 500/700) and Manrope (--font-body, weights 400/500/600); body uses `var(--ob-surface-base)` and `var(--ob-text-primary)` inline styles; added `dark` class to html
- **auth-guard.tsx**: Created AuthGuard component with SSR-safe mount guard, PUBLIC_PATHS whitelist (/login, /register, /invite), and router.replace redirect for unauthenticated users
- **providers.tsx**: Wrapped children with AuthGuard inside QueryClientProvider

### Task 2: Auth Store Extension + API Client
- **auth-store.ts**: Added `Team` interface, `SpaceContext` discriminated union type, `teams: Team[]`, `currentSpace: SpaceContext`, `setTeams()`, `switchSpace()` actions; logout resets team state; exported types for consumers
- **api.ts**: Added `teamsApi` (16 methods: CRUD, members, invitations, groups), `projectsApi` (6 methods: CRUD + clone), `usersApi` (3 methods: search, profile, updateProfile), `aiProvidersApi` (8 methods: CRUD, keys, models); added `googleLogin`/`githubLogin` OAuth to authApi

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | b53f9ea | feat(06-03): add Obsidian Lens design tokens, AuthGuard, fonts, Providers wrap |
| 2 | d82e1dc | feat(06-03): extend auth store with team/space state and API client namespaces |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all code is functional, no placeholder data or TODOs.

## Self-Check: PASSED

- [x] web/src/app/globals.css contains `--ob-primary: #00D1FF`
- [x] web/src/app/globals.css contains `--ob-glass-bg`
- [x] web/src/app/globals.css contains `--ob-dot-grid`
- [x] web/src/app/layout.tsx contains `Space_Grotesk`
- [x] web/src/app/layout.tsx contains `Manrope`
- [x] web/src/components/auth/auth-guard.tsx contains `export function AuthGuard`
- [x] web/src/components/providers.tsx contains `AuthGuard`
- [x] web/src/stores/auth-store.ts contains `interface Team`
- [x] web/src/stores/auth-store.ts contains `type SpaceContext`
- [x] web/src/stores/auth-store.ts contains `currentSpace`
- [x] web/src/stores/auth-store.ts contains `switchSpace`
- [x] web/src/lib/api.ts contains `export const teamsApi`
- [x] web/src/lib/api.ts contains `export const projectsApi`
- [x] web/src/lib/api.ts contains `export const usersApi`
- [x] web/src/lib/api.ts contains `export const aiProvidersApi`
- [x] web/src/lib/api.ts contains `googleLogin`
- [x] TypeScript compilation: no new errors (pre-existing recharts/wavesurfer only)
- [x] Commits b53f9ea, d82e1dc exist
