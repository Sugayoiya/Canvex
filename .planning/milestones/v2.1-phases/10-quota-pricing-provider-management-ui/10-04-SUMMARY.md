---
phase: 10-quota-pricing-provider-management-ui
plan: 04
subsystem: ui
tags: [react, admin, provider-management, api-keys, obsidian-lens]

requires:
  - phase: 10-01
    provides: Backend API endpoints for provider CRUD and key management
  - phase: 08
    provides: Admin shell layout, ConfirmationModal, design tokens

provides:
  - ProviderCard component with expandable key management
  - ProviderFormModal component for create/edit provider
  - Full Providers admin page with CRUD and key lifecycle

affects: [11-monitoring-ui]

tech-stack:
  added: []
  patterns:
    - "Expandable card pattern with single-expand accordion for admin pages"
    - "Inline key management with masked display and add/revoke lifecycle"
    - "anyPending guard disabling all mutation buttons during operations"

key-files:
  created:
    - web/src/components/admin/provider-card.tsx
    - web/src/components/admin/provider-form-modal.tsx
  modified:
    - web/src/app/admin/providers/page.tsx

key-decisions:
  - "Toggle group pattern for Enabled/Disabled using role=radiogroup for accessibility"
  - "Single anyPending boolean gates all interactive elements during mutations"
  - "Key hint fallback sk-••••???? for legacy keys without key_hint column"

patterns-established:
  - "ProviderCard accordion: single-expand via parent expandedId state"
  - "Form modal with portal + overlay + scale animation matching ConfirmationModal"

requirements-completed: [REQ-23]

duration: 3min
completed: 2026-04-01
---

# Phase 10 Plan 04: System AI Provider Management UI Summary

**ProviderCard with expandable key table (masked sk-••••XXXX display), add/revoke key lifecycle, and ProviderFormModal for system-scope provider CRUD with Obsidian Lens styling**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T11:04:33Z
- **Completed:** 2026-04-01T11:07:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- ProviderCard component with collapsed header (Bot icon, name, Active/Inactive • N keys status) and expandable area containing key management table, encryption notice, and add-key form
- ProviderFormModal component with create/edit modes, toggle group for Enabled/Disabled, Priority input, and owner_type=system baked in
- Full Providers admin page replacing placeholder — card list with expand/collapse, 5 React Query mutations (create/update/delete provider + add/revoke key), Chinese toast feedback, loading skeletons, error retry, empty state CTA

## Task Commits

Each task was committed atomically:

1. **Task 1: ProviderCard + ProviderFormModal components** - `bc6548a` (feat)
2. **Task 2: Providers page — card list, mutations, confirmation modals** - `1405f43` (feat)

## Files Created/Modified
- `web/src/components/admin/provider-card.tsx` - ProviderCard with expandable key management, masked key display, add-key form
- `web/src/components/admin/provider-form-modal.tsx` - Create/Edit provider modal with toggle group and portal overlay
- `web/src/app/admin/providers/page.tsx` - Full Providers admin page with CRUD, key lifecycle, confirmations, and state management

## Decisions Made
- Toggle group for Enabled/Disabled status uses `role="radiogroup"` + `role="radio"` + `aria-checked` for accessibility
- Single `anyPending` boolean computed from all 5 mutations gates the Add Provider button, edit/delete buttons, expand/collapse toggle, and Authorize Key button
- Key hint display uses `key_hint || "????"` fallback with tooltip for legacy keys
- API key plaintext never stored in React state beyond form input, never included in toast messages or console logs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `quotas/page.tsx` (null vs undefined in quota API types) — out of scope, not from this plan's changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- REQ-23 complete — system-level provider management with full key lifecycle
- All Phase 10 plans (01-04) complete — ready for Phase 10 verification
- Monitoring UI (Phase 11) can proceed independently

## Self-Check: PASSED

---
*Phase: 10-quota-pricing-provider-management-ui*
*Completed: 2026-04-01*
