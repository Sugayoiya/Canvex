---
phase: 05
reviewers: [codex]
reviewed_at: 2026-03-30T23:30:00+08:00
plans_reviewed: [05-01-PLAN.md, 05-02-PLAN.md, 05-03-PLAN.md, 05-04-PLAN.md, 05-05-PLAN.md, 05-06-PLAN.md]
---

# Cross-AI Plan Review — Phase 05

## Codex Review

### Plan 05-01 (Wave 1): Backend APIs

#### Summary
The plan covers the right backend surfaces for REQ-09/REQ-10 enablement, but its current execution-state design (`_batch_store` in memory) is the biggest reliability risk and could break usability under restarts or multi-worker deployment.

#### Strengths
- Clear API split for batch execute, batch status, and node status updates.
- Kahn topological-sort direction is appropriate for DAG execution.
- Billing time-series endpoint explicitly considers SQLite/PostgreSQL differences.
- Task monitoring endpoints align with operational visibility criterion.

#### Concerns
- **HIGH**: In-memory batch store is non-durable, non-shared across workers, and restart-unsafe.
- **HIGH**: Potential authorization gaps on batch/node updates and node-history reads if project/user scoping is not enforced consistently.
- **MEDIUM**: Topological sort edge cases (cycles, orphan nodes, missing dependencies, deterministic ordering) may produce confusing failures.
- **MEDIUM**: Dual SQL date-grouping paths can drift semantically (timezone boundaries, month truncation behavior).
- **LOW**: Task listing/count endpoints can become expensive without indexes/pagination defaults.

#### Suggestions
- Persist batch state in DB/Redis with explicit status state machine and idempotent `batch_id`.
- Add strict ownership checks (`project_id`, tenant/admin scope) on every logs/canvas read/write path.
- Return structured cycle errors with offending node IDs and a user-facing remediation message.
- Normalize time grouping to UTC at query boundary and add cross-DB parity tests for monthly bins.
- Add paging/limits and DB indexes for task/log query hot paths.

#### Risk Assessment
**HIGH** — Core workflow correctness is good in concept, but durability and authorization gaps could cause production breakage.

---

### Plan 05-02 (Wave 1): Frontend Infra

#### Summary
This is a solid infrastructure plan that cleanly prepares V5 visual language and panel routing, with manageable UI risks mainly around node-label positioning and interaction ergonomics.

#### Strengths
- Good sequencing: infra first, functional toolbars later.
- CSS custom properties for V5 improve theme consistency.
- `useNodeFocus` type-specific panel mapping is the right abstraction.
- Placeholder toolbars reduce dependency coupling across waves.

#### Concerns
- **MEDIUM**: External absolute label (`top: -24px`) can clip under zoom/overflow constraints.
- **MEDIUM**: Removing header row may reduce obvious drag affordance and discoverability.
- **LOW**: `pointer-events-none` on labels can block future inline actions (rename, context actions).
- **LOW**: Mixed `--cv4-*`/`--cv5-*` token usage could create style drift during transition.

#### Suggestions
- Ensure node container supports visible overflow and test at multiple zoom levels.
- Preserve a clear drag handle region or cursor affordance in V5 shell.
- Define token migration rules (`cv4` fallback or deprecation map) to avoid color regressions.
- Add snapshot/visual regression checks for label placement and selected-state styling.

#### Risk Assessment
**MEDIUM-LOW** — Mostly presentation-layer risk; architecture choices are sound.

---

### Plan 05-03 (Wave 2): V5 Node Toolbars + Audio Rewrite

#### Summary
The plan improves UX materially, but WaveSurfer integration and disabled-action UX need stronger guardrails to avoid performance and trust issues.

#### Strengths
- Replacing placeholders with concrete toolbars closes a key UX gap.
- Clear per-media toolbar specialization.
- Audio waveform support aligns with node-style redesign decisions.
- Center-alignment strategy keeps UI visually consistent.

#### Concerns
- **MEDIUM**: All template skills disabled may feel like broken product if not clearly communicated.
- **MEDIUM**: WaveSurfer can be heavy with many nodes unless lifecycle cleanup/lazy mounting is strict.
- **MEDIUM**: App Router SSR/hydration mismatch risk if waveform components render server-side.
- **LOW**: Centered floating toolbars can overlap/clash on narrow nodes or dense canvases.

#### Suggestions
- Use explicit disabled reasons/tooltips and optionally hide unavailable actions behind feature flags.
- Lazy-initialize WaveSurfer only for active/visible audio nodes; always destroy on unmount.
- Use client-only/dynamic import for waveform component to avoid hydration issues.
- Add collision/viewport clamping for toolbar positioning.

#### Risk Assessment
**MEDIUM** — Achieves UX goals, but performance and clarity risks are non-trivial.

---

### Plan 05-04 (Wave 2): Batch Execution Frontend

#### Summary
This plan is functionally aligned with REQ-09, but real-time state handling (selection, polling, status sync) is the primary risk area.

#### Strengths
- `useBatchExecution` hook centralizes complex behavior cleanly.
- Batch action bar gives clear affordance for multi-node execution.
- Polling-based status is pragmatic for first release.
- Selection styling increases user feedback during graph operations.

#### Concerns
- **HIGH**: `useOnSelectionChange` loop/regression risk if callback/state wiring is not stabilized.
- **MEDIUM**: 3s polling without pause/backoff can over-query and waste resources.
- **MEDIUM**: Client-driven `updateBatchNodeStatus` can create integrity issues if not strictly validated server-side.
- **LOW**: `selectionOnDrag={true}` may increase accidental selections for users manipulating nodes.

#### Suggestions
- Guard selection updates with shallow-equality checks and stable refs to prevent render loops.
- Pause polling when tab hidden; stop when terminal states reached; add error backoff.
- Treat backend as source of truth for node status transitions; reject invalid client transitions.
- Add partial-failure UI states and retry path per node/batch.

#### Risk Assessment
**MEDIUM-HIGH** — High UX value, but easy to introduce unstable behavior without strict state controls.

---

### Plan 05-05 (Wave 2): Billing Dashboard

#### Summary
The plan is well-scoped and dependency-aware, with good incremental delivery; key risks are mostly data semantics and visualization robustness.

#### Strengths
- Task split fix (placeholders first, components second) avoids broken imports.
- Route/container/chart decomposition is maintainable.
- Recharts choice is appropriate for KPI + trend + composition views.
- Supports project dimension and time-series needs from locked decisions.

#### Concerns
- **MEDIUM**: Date range semantics/timezone boundaries can produce incorrect monthly totals.
- **MEDIUM**: Hardcoded provider colors may fail for new providers and accessibility contrast.
- **LOW**: SSR/client boundary mistakes with chart libs can cause hydration issues.
- **LOW**: Missing explicit empty/loading/error states may reduce dashboard trust.

#### Suggestions
- Normalize all usage dates to UTC in API contract and display local-time labels separately.
- Move provider colors to tokenized map with deterministic fallback for unknown providers.
- Ensure all chart components are client-only and tested for no-data/error/loading states.
- Add CSV/export or clear "monthly usage output" affordance if required by interpretation of REQ-10.

#### Risk Assessment
**MEDIUM** — Good plan, with moderate risk around data correctness and visual consistency.

---

### Plan 05-06 (Wave 2): Task Monitoring + Node History

#### Summary
This plan addresses operational visibility directly, but pagination/header handling and integration details for node-history trigger need clarification to avoid partial delivery.

#### Strengths
- `/tasks` page plus status filters and pagination matches monitoring-readiness goal.
- Auto-refresh is pragmatic for first operational version.
- Node execution history UX is a strong bridge between ops data and canvas workflow.
- Sidebar navigation inclusion improves discoverability.

#### Concerns
- **MEDIUM**: Polling every 5s can be noisy at scale; no pause strategy noted.
- **MEDIUM**: `X-Total-Count` pagination relies on proper CORS `Access-Control-Expose-Headers`.
- **MEDIUM**: Node-history popover trigger path is underspecified, risking orphaned component.
- **LOW**: Parallel Wave 2 sidebar edits (with billing) may cause merge churn.

#### Suggestions
- Add visibility-aware polling (pause in background) and manual refresh control.
- Ensure backend exposes `X-Total-Count` and frontend handles missing header fallback.
- Define exact trigger location for node-history (node menu/status icon/right panel action).
- Add API-level project/admin scoping checks for all task/history endpoints.

#### Risk Assessment
**MEDIUM** — Strong coverage of ops goals, but integration clarity and API contract details need tightening.

---

## Consensus Summary

*Single reviewer (Codex) — consensus summary derived from cross-plan analysis.*

### Key Strengths (across all plans)
- Plans are well-sequenced with clear wave dependencies and no circular imports
- Good use of existing patterns (PanelHost, useNodeExecution, React Query, billingApi)
- Incremental delivery with placeholder → real component approach reduces integration risk
- All 18 user decisions (D-01 through D-18) are addressed by at least one plan
- SQLite/PostgreSQL dual-path handled explicitly in backend

### Top Concerns (by severity)
1. **HIGH — Batch state durability**: In-memory `_batch_store` in Plan 05-01 is non-persistent, non-shared across workers, and restart-unsafe. This is the single biggest risk to production reliability.
2. **HIGH — Selection state loop**: Plan 05-04's `useOnSelectionChange` can create infinite render loops if not carefully stabilized with memoization and shallow-equality guards.
3. **MEDIUM — Authorization gaps**: Multiple endpoints (batch-execute PATCH, node-history GET, task list GET) need consistent project/tenant/admin scoping validation.
4. **MEDIUM — Timezone/date semantics**: Both billing time-series (05-01/05-05) and task list filtering rely on date boundaries that can drift between SQLite strftime and PostgreSQL DATE_TRUNC.
5. **MEDIUM — WaveSurfer performance**: Plan 05-03's audio waveform can be heavy in multi-node canvases if not lazily initialized and properly cleaned up on unmount.
6. **MEDIUM — Polling strategy**: Plans 05-04 and 05-06 use fixed-interval polling (3s and 5s) without visibility-aware pausing or exponential backoff.

### Recommended Actions Before Execution
1. **Plan 05-01**: Replace `_batch_store` dict with Redis or DB-backed state storage
2. **Plan 05-04**: Add shallow-equality guard + `document.hidden` check for selection/polling
3. **Plan 05-01/05-06**: Audit all new endpoints for consistent auth/scope enforcement
4. **Plan 05-05/05-06**: Ensure `X-Total-Count` header is exposed via CORS configuration
5. **Plan 05-03**: Add `dynamic(() => import(...), { ssr: false })` for WaveSurfer component
