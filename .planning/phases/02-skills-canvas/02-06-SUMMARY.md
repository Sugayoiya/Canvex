---
phase: 02-skills-canvas
plan: 06
subsystem: billing
tags: [decimal, pricing, cost-calculation, usage-stats, admin-crud, auditability]

requires:
  - phase: 02-01
    provides: AICallLog model and fail-open ai_call_logger writer
provides:
  - ModelPricing table with Numeric(12,8) precision for per-model pricing
  - Admin-only CRUD API for pricing management
  - Auto cost calculation in AICallLog write path with price snapshot auditability
  - Usage stats API with admin/user scope differentiation
affects: [02-skills-canvas, billing-dashboard, quota-controls]

tech-stack:
  added: []
  patterns: [fail-open-pricing-lookup, price-snapshot-at-write-time, decimal-only-arithmetic]

key-files:
  created:
    - api/app/models/model_pricing.py
    - api/app/schemas/billing.py
    - api/app/services/billing/__init__.py
    - api/app/services/billing/pricing_service.py
    - api/app/api/v1/billing.py
  modified:
    - api/app/models/ai_call_log.py
    - api/app/services/ai/ai_call_logger.py
    - api/app/api/v1/router.py
    - api/app/core/database.py

key-decisions:
  - "Price snapshot captured at write time (input_unit_price, output_unit_price, pricing_snapshot_id) for cost audit trail"
  - "Pricing lookup failure is fail-open — cost is None but AICallLog write still succeeds"
  - "Usage stats scoped: admin sees all, non-admin sees own user_id calls only"

patterns-established:
  - "Fail-open pricing: cost calculation errors never block AICallLog writes"
  - "Price snapshot at write time: freeze pricing state for reproducibility after price changes"
  - "Decimal-only arithmetic: all cost computations use Decimal(str(n)), never float"

requirements-completed: [REQ-03, REQ-04]

duration: 3min
completed: 2026-03-27
---

# Phase 02 Plan 06: Billing Baseline Summary

**ModelPricing table with admin CRUD, auto cost calculation in AICallLog write path, and usage stats API with Decimal-only arithmetic**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T17:11:28Z
- **Completed:** 2026-03-27T17:14:23Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- ModelPricing model with Numeric(12,8) fields supporting per_token, per_image, per_request pricing models
- Admin-only CRUD endpoints (POST/GET/PATCH/DELETE) on `/billing/pricing/` with `require_admin` enforcement
- Cost auto-calculation wired into AICallLog write path with price snapshot auditability (input_unit_price, output_unit_price, pricing_snapshot_id)
- Usage stats API with admin/user scope differentiation and aggregation by provider+model

## Task Commits

Each task was committed atomically:

1. **Task 1: ModelPricing model + pricing service + admin CRUD API** - `dc28aa7` (feat)
2. **Task 2: Wire cost calculation into AICallLog write path** - `c76b757` (feat)

## Files Created/Modified

- `api/app/models/model_pricing.py` - ModelPricing SQLAlchemy model with Numeric(12,8) price fields
- `api/app/schemas/billing.py` - PricingCreate/Update/Response + UsageStatsResponse schemas
- `api/app/services/billing/__init__.py` - Billing service package
- `api/app/services/billing/pricing_service.py` - calculate_cost and calculate_cost_with_snapshot with Decimal arithmetic
- `api/app/api/v1/billing.py` - Billing API endpoints (admin CRUD + usage stats)
- `api/app/models/ai_call_log.py` - Added input_unit_price, output_unit_price, pricing_snapshot_id columns
- `api/app/services/ai/ai_call_logger.py` - Wired auto cost calculation with fail-open pricing lookup
- `api/app/api/v1/router.py` - Registered billing_router
- `api/app/core/database.py` - Registered ModelPricing in init_db

## Decisions Made

- Price snapshot captured at write time for cost audit trail — even if pricing changes later, historical costs remain reproducible
- Pricing lookup failure is fail-open: cost field stays None but AICallLog write succeeds
- Usage stats scoped by user role: admin sees all, non-admin sees own user_id calls only
- All Decimal arithmetic uses `Decimal(str(n))` — no float conversion anywhere

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all endpoints are fully wired with data sources.

## Next Phase Readiness

- Billing baseline operational: every LLM call through provider infrastructure auto-logs cost
- Pricing management is admin-only via CRUD API
- Usage stats queryable by any authenticated user (scoped to their own data for non-admins)
- Ready for billing dashboard UI and quota control features in later phases

## Self-Check: PASSED

- All 5 created files confirmed on disk
- Commit `dc28aa7` confirmed in git log (Task 1)
- Commit `c76b757` confirmed in git log (Task 2)

---
*Phase: 02-skills-canvas*
*Completed: 2026-03-27*
