---
phase: 12-ai-call-convergence
plan: 04
subsystem: admin-api, admin-ui
tags: [health-monitoring, key-management, sparkline, batch-api, accessibility]

requires: [12-01]
provides:
  - "Batch health endpoint GET /ai-providers/{id}/health — single call for all keys"
  - "Per-key health endpoint GET /ai-providers/{id}/keys/{key_id}/health"
  - "Key PATCH endpoint for toggle enable/disable and reset errors with cache invalidation"
  - "Frontend per-key health badges, toggle switch, error history, 24h usage sparkline"
affects: []

tech-stack:
  added: []
  patterns: [batch-health-endpoint, health-badge-ui, inline-svg-sparkline, toggle-switch, expandable-detail-panel]

key-files:
  created:
    - web/src/components/admin/usage-sparkline.tsx
    - api/tests/test_admin_providers.py
  modified:
    - api/app/api/v1/ai_providers.py
    - api/app/schemas/ai_provider.py
    - web/src/lib/api.ts
    - web/src/components/admin/provider-card.tsx
    - web/src/app/admin/providers/page.tsx

key-decisions:
  - "Batch health endpoint returns all keys in a single call to avoid N+1 API load"
  - "60s polling interval (not 30s from UI-SPEC) per review feedback to reduce overhead"
  - "Health badge thresholds: 0=healthy, 1-2=degraded, >=3=unhealthy per RESEARCH.md"
  - "Error messages already redacted at storage time by KeyHealthManager — no re-redaction needed"

patterns-established:
  - "Inline SVG sparkline pattern for 24h usage trends"
  - "Expandable table row detail panel with two-column layout"
  - "Health badge component following StatusBadge pattern"

requirements-completed: [CONV-10, CONV-11]

duration: 5min
completed: 2026-04-02
---

# Phase 12 Plan 04: Admin Provider Health UI Summary

**Batch health API + per-key health badges, toggle switch, error history, and 24h usage sparkline in admin provider cards with full accessibility**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-02T10:20:24Z
- **Completed:** 2026-04-02T10:25:28Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files created:** 2
- **Files modified:** 5

## Accomplishments

- Added `KeyHealthResponse`, `KeyUpdateRequest`, `ProviderHealthResponse` Pydantic schemas
- Added `GET /{provider_id}/health` batch endpoint — single request returns health for all keys (avoids N+1)
- Added `GET /{provider_id}/keys/{key_id}/health` per-key endpoint
- Added `PATCH /{provider_id}/keys/{key_id}` for toggling `is_active` and resetting error count
- Key PATCH triggers `CredentialCache.invalidate()` for immediate effect (D-05) + admin audit logging
- Created `UsageSparkline` component — inline SVG bar chart, 24 bars, accessible `role="img"`
- Extended `ProviderCard` with `HealthBadge` (green/yellow/red), `ToggleSwitch` (`role="switch"`), `ErrorHistoryList` (`role="list"`), expandable detail panel
- Extended providers page with `toggleKeyMutation` and `resetErrorsMutation` with Chinese toast messages
- Batch health polled every 60s while expanded, health data fetched lazily via React Query `enabled: isExpanded`
- All 5 backend tests pass: toggle, reset, batch health, per-key health, cache invalidation

## Task Commits

1. **Task 1: Backend API** — `5a47293` (feat)
2. **Task 2: Frontend UI** — `d54ecfe` (feat)
3. **Task 3: Visual verification** — checkpoint, awaiting human verification

## Files Created/Modified

- `api/app/schemas/ai_provider.py` — Added KeyHealthResponse, KeyUpdateRequest, ProviderHealthResponse schemas
- `api/app/api/v1/ai_providers.py` — Added batch health, per-key health, key PATCH endpoints with cache invalidation and audit logging
- `api/tests/test_admin_providers.py` — 5 tests covering all new endpoints with mocked Redis services
- `web/src/lib/api.ts` — Extended aiProvidersApi with getProviderHealth, getKeyHealth, updateKey
- `web/src/components/admin/usage-sparkline.tsx` — New SVG sparkline component with empty state
- `web/src/components/admin/provider-card.tsx` — Rewrote with health badges, toggle, reset, expandable detail, error history, sparkline
- `web/src/app/admin/providers/page.tsx` — Added toggleKeyMutation, resetErrorsMutation, new props to ProviderCard

## Decisions Made

- Batch health endpoint returns all keys in a single call to avoid N+1 API load
- 60s polling interval (not 30s from UI-SPEC) per review feedback to reduce overhead while keeping data reasonably fresh
- Health badge thresholds: 0=healthy, 1-2=degraded, >=3=unhealthy per RESEARCH.md recommendations
- Error messages already redacted at storage time by KeyHealthManager (Plan 12-01) — no additional redaction needed at API layer

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data sources are wired to real API endpoints.

## Checkpoint: Awaiting Human Verification

Task 3 is a `checkpoint:human-verify` for visual verification of the admin provider health UI. The following items should be verified:

- Health badges render correctly (green Healthy / yellow Degraded / red Unhealthy)
- Toggle switch animates and persists state
- Reset Errors button resets error count
- Expandable key detail shows error history list + usage sparkline
- Accessibility attributes present (role=switch, role=img, aria-label, aria-expanded)
- No visual regressions on existing add/revoke/edit/delete flows

## Self-Check: PASSED

All 7 files verified on disk. Both task commits verified in git log. Backend tests pass (5/5). Frontend build succeeds.

---
*Phase: 12-ai-call-convergence*
*Completed: 2026-04-02*
