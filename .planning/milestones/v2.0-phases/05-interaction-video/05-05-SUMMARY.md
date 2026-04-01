---
phase: 05-interaction-video
plan: 05
subsystem: ui
tags: [recharts, billing, dashboard, react-query, linechart, piechart]

requires:
  - phase: 05-01
    provides: billing API endpoints (usage-stats, usage-timeseries)
provides:
  - Billing dashboard page at /billing with KPI cards, time-series chart, provider pie chart, usage table
  - billingApi client methods (usageStats, usageTimeseries, pricing)
  - ProjectUsageView for per-project billing dimension
affects: [06-collaboration, billing-export]

tech-stack:
  added: []
  patterns: [UTC date normalization for API date params, deterministic fallback color palette for unknown providers]

key-files:
  created:
    - web/src/app/billing/page.tsx
    - web/src/components/billing/billing-dashboard.tsx
    - web/src/components/billing/kpi-cards.tsx
    - web/src/components/billing/usage-chart.tsx
    - web/src/components/billing/provider-pie-chart.tsx
    - web/src/components/billing/usage-table.tsx
    - web/src/components/billing/project-usage-view.tsx
  modified:
    - web/src/lib/api.ts

key-decisions:
  - "UTC date normalization via toUTCDateString() for all billing API params — prevents timezone boundary aggregation bugs"
  - "Deterministic index-based fallback color palette for unknown providers — no code changes needed when new providers added"
  - "ProjectUsageView as separate component with independent queries rather than shared state — cleaner separation of global vs project views"

patterns-established:
  - "UTC date normalization: all date params sent as ISO strings with T00:00:00Z suffix"
  - "Provider color strategy: known map + FALLBACK_PALETTE[index % length] for unknown providers"
  - "Billing dashboard card styling: --cv4-surface-primary bg, 12px radius, 20px/24px padding"

requirements-completed: [REQ-10]

duration: 6min
completed: 2026-03-30
---

# Phase 05 Plan 05: Billing Dashboard Summary

**Recharts billing dashboard with KPI cards, time-series line chart, provider pie chart with fallback colors, sortable usage table, and global/project view toggle — all dates UTC-normalized**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-30T07:01:48Z
- **Completed:** 2026-03-30T07:07:52Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Full billing dashboard at /billing with 3 KPI cards (cost, calls, tokens) showing formatted values
- Recharts LineChart for cost/calls time-series with hour/day/week granularity selector
- PieChart with branded provider colors (Gemini/OpenAI/DeepSeek/ComfyUI) and deterministic fallback palette for unknown providers
- Sortable usage detail table with provider/model/calls/tokens/cost/avg-per-call columns
- Global/project view toggle with per-project billing dimension
- Date range presets (7d/30d/month/custom) with UTC-normalized date params
- Loading skeleton, empty state ("暂无使用数据"), and error state with retry button

## Task Commits

Each task was committed atomically:

1. **Task 1: billingApi client + billing page + BillingDashboard + KPICards** - `63d24cb` (feat)
2. **Task 2: UsageChart + ProviderPieChart + UsageTable + ProjectUsageView** - `c9eaf4e` (feat)

## Files Created/Modified
- `web/src/lib/api.ts` - Added billingApi with usageStats/usageTimeseries/pricing methods
- `web/src/app/billing/page.tsx` - Billing page route ("use client")
- `web/src/components/billing/billing-dashboard.tsx` - Main dashboard container with view toggle, date range, KPI aggregation, loading/empty/error states
- `web/src/components/billing/kpi-cards.tsx` - 3 KPI cards with cost/calls/tokens formatting (¥, comma, K/M suffix)
- `web/src/components/billing/usage-chart.tsx` - Recharts LineChart with cost+calls dual series and granularity selector
- `web/src/components/billing/provider-pie-chart.tsx` - Recharts PieChart with branded colors + FALLBACK_PALETTE for unknown providers
- `web/src/components/billing/usage-table.tsx` - Sortable table with 6 columns and row hover
- `web/src/components/billing/project-usage-view.tsx` - Per-project billing view with project_id filter

## Decisions Made
- UTC date normalization via `toUTCDateString()` — all date params sent as ISO strings with `T00:00:00Z` suffix to prevent timezone boundary aggregation bugs
- Deterministic index-based fallback color palette for unknown providers — `FALLBACK_PALETTE[index % length]` ensures new providers always get distinct colors without code changes
- ProjectUsageView as separate component with independent React Query keys — cleaner separation vs sharing queries with effectiveProjectId

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Recharts Tooltip formatter TypeScript type**
- **Found during:** Task 2 (ProviderPieChart)
- **Issue:** `formatter={(value: number) => ...}` incompatible with Recharts `ValueType | undefined` signature
- **Fix:** Changed to `formatter={(value) => formatCost(Number(value))}` to handle the broader type
- **Files modified:** web/src/components/billing/provider-pie-chart.tsx
- **Committed in:** c9eaf4e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type fix for Recharts API compatibility. No scope creep.

## Issues Encountered
None

## Known Stubs
None — all components are fully wired to billingApi with real data queries.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Billing dashboard complete, ready for billing export or advanced analytics in future phases
- All --cv5-chart-* design tokens already in globals.css from Plan 01

---
*Phase: 05-interaction-video*
*Completed: 2026-03-30*
