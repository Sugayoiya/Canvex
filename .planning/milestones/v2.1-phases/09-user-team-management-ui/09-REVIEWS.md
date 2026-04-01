---
phase: 09
reviewers: [codex]
reviewed_at: 2026-04-01T08:22:00Z
plans_reviewed: [09-01-PLAN.md, 09-02-PLAN.md, 09-03-PLAN.md]
---

# Cross-AI Plan Review — Phase 09

## Codex Review (gpt-5.3-codex)

External reviewer CLIs were not usable in this runtime (`gemini` auth prompt, `claude` CLI execution error, `codex` panic on nested invocation), so this is a single-reviewer structured assessment from Codex.

### Plan 09-01 (Backend Extensions + Reusable Table Components)

#### 1. Summary
This plan is a solid foundation wave: it correctly front-loads backend contract changes and shared table primitives that Phase 09/10/11 can reuse. The main risk is under-specifying backend query semantics/performance and relying on compile/tests that may miss integration regressions.

#### 2. Strengths
- Correct dependency placement: backend fields + shared UI infra before page assembly.
- Good reuse strategy (`AdminDataTable`, `AdminPagination`, `FilterToolbar`) for later phases.
- Includes accessibility intent (ARIA) and full state coverage (loading/error/empty).
- Adds test touchpoints for backend schema evolution.

#### 3. Concerns
- `HIGH`: `admin_count` semantics are undefined (active only? includes banned? tenant-scoped?), which can break "last admin" logic.
- `MEDIUM`: `teams` JOIN can duplicate rows or inflate payload without explicit aggregation/distinct strategy.
- `MEDIUM`: `owner_name` correlated subquery can degrade performance on large team lists.
- `MEDIUM`: verification is too narrow (`pytest` subset + `tsc` only), missing API contract/integration validation.
- `LOW`: generic table wrapper may become over-generalized too early if API surface is not constrained.

#### 4. Suggestions
- Define API contract explicitly for `admin_count` and document edge behavior.
- Implement `teams` as deterministic aggregate (e.g., distinct + stable order) and cap/format display length.
- Add one integration test covering users list with sort/filter/pagination + new fields.
- Add query-performance guardrails (indexes + explain check for team owner/users joins).
- Keep table component props minimal and page-agnostic for Phase 10/11 reuse.

#### 5. Risk Assessment
**MEDIUM**: architecture direction is strong, but backend contract ambiguity and query performance risks can cause downstream UI logic bugs.

---

### Plan 09-02 (Interaction Components + Users Page)

#### 1. Summary
This plan is close to the phase core and covers most REQ-19 behavior, including action menus, confirmations, and React Query mutations. Biggest risk is correctness under concurrent admin changes and insufficient runtime testing for interactive/a11y-heavy components.

#### 2. Strengths
- Good decomposition: interaction primitives first, full page assembly second.
- Matches locked UX decisions (dropdown actions, badges, confirmation flow, toasts).
- Uses server-driven table state and React Query key conventions.
- Includes explicit "last admin" UX handling intent.

#### 3. Concerns
- `HIGH`: "last admin" handled in UI (`admin_count <= 1`) is race-prone; backend enforcement/error path is not stated.
- `HIGH`: no mention of self-protection rules (prevent self-disable/self-demote) if required by policy.
- `MEDIUM`: only `tsc` verification; no tests for dropdown keyboard nav, focus trap, or mutation flows.
- `MEDIUM`: query invalidation strategy is unspecified (possible stale row state/flicker after toggles).
- `MEDIUM`: debounce/filter/page coupling unspecified (page reset on new search/filter can be missed).
- `LOW`: custom dropdown/modal may duplicate complexity that grows maintenance burden.

#### 4. Suggestions
- Treat backend as source of truth for admin safety: return 409/422 for forbidden demotion and handle with targeted toast.
- Disable row actions during in-flight mutation and make mutation idempotency explicit.
- Reset page to 1 on search/filter/sort change and persist table state in URL for admin usability.
- Add RTL tests for: keyboard/escape/outside click, focus trap, pending/disabled states, and error toasts.
- Add explicit handling for 401/403/500 responses with retry + session-expiry behavior.

#### 5. Risk Assessment
**MEDIUM-HIGH**: functionally comprehensive, but concurrency/safety and test gaps make this the highest execution risk in Phase 09.

---

### Plan 09-03 (Teams Overview Page)

#### 1. Summary
This is appropriately scoped as a read-only page and leverages shared infra well. The main issue is requirement alignment: REQ-20 mentions drill-down, while the locked decision defers it; this needs explicit reconciliation to avoid acceptance ambiguity.

#### 2. Strengths
- Tight scope, low complexity, and good dependency on 09-01 data contracts.
- Aligns with D-04 (read-only, no row actions).
- Keeps consistent table UX patterns (search, pagination, loading/error/empty).

#### 3. Concerns
- `HIGH`: REQ-20 states drill-down link, but plan omits it; acceptance criteria conflict is unresolved.
- `MEDIUM`: no explicit null/unknown owner handling despite `owner_name: str | None`.
- `MEDIUM`: no testing beyond compile check; easy to miss empty/error state regressions.
- `LOW`: "1 file modified" may underestimate practical wiring/styling adjustments.

#### 4. Suggestions
- Add explicit requirement note: "drill-down deferred to REQ-F03 by D-04" and get sign-off.
- Define rendering rules for `owner_name = null` (e.g., "Unassigned").
- Ensure deterministic default ordering from backend even without client sort.
- Add at least one page-level integration test for search + pagination + empty state.

#### 5. Risk Assessment
**MEDIUM**: implementation is straightforward, but requirement mismatch (drill-down) is a release-risk if not formally resolved.

---

## Consensus Summary

### Agreed Strengths
- Wave structure is well-designed: foundation (09-01) → parallel assembly (09-02, 09-03)
- Reusable component strategy (AdminDataTable, AdminPagination, FilterToolbar) benefits Phase 10/11
- UX decisions (D-01 through D-10) are consistently reflected in plan tasks

### Agreed Concerns
1. **Backend contract ambiguity** (`admin_count` semantics) — affects last-admin UX safety (HIGH)
2. **Concurrency safety for admin role changes** — frontend disable is UX sugar, backend is security boundary, but error path handling is underspecified (HIGH)
3. **REQ-20 vs D-04 conflict** — drill-down mentioned in requirement but deferred by user decision; needs formal reconciliation (HIGH)
4. **Verification depth** — `tsc --noEmit` is compile-only; no runtime/interaction/a11y tests for complex components (MEDIUM)
5. **Self-action prevention** — plans don't mention preventing admin from banning themselves or revoking their own admin (MEDIUM)

### Divergent Views
None — single reviewer.
