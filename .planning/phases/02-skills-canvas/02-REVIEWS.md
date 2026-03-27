---
phase: 02
reviewers: [codex]
reviewed_at: 2026-03-27T21:30:00Z
plans_reviewed: [02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md, 02-04-PLAN.md, 02-05-PLAN.md, 02-06-PLAN.md]
note: "Gemini CLI unavailable due to sandbox permission issue; review conducted with Codex only"
---

# Cross-AI Plan Review — Phase 02

## Codex Review

### Plan 02-01 — LLM Provider Infrastructure + AICallLog Write Path

**Summary**
This is the right foundational move for Phase 02: central provider abstraction plus call logging enables all downstream skills. The plan is strong architecturally, but it currently under-specifies reliability and security boundaries for provider differences, logging failure isolation, and context propagation across async execution.

**Strengths**
- Clear abstraction layer (`base` + manager + provider impls) that supports multi-provider routing.
- Reuses one SDK pattern to reduce integration surface area.
- Adds AICallLog write path early, enabling billing/ops visibility.
- ContextVar intent is good for traceability and correlating calls.

**Concerns**
- **[HIGH]** Assuming OpenAI-compatible behavior across Gemini/DeepSeek can break on structured output, tool-calling, and error semantics.
- **[HIGH]** No explicit key management/redaction policy for prompts, responses, and secrets in logs.
- **[MEDIUM]** `ContextVar` propagation may fail across Celery/task boundaries unless explicitly rehydrated.
- **[MEDIUM]** Logging path may become a hard dependency; DB/log failures could break core skill execution.
- **[MEDIUM]** Retry/timeout/backoff and rate-limit handling are not explicitly defined.

**Suggestions**
- Define provider capability contracts and add contract tests per provider.
- Make AICallLog writes non-blocking/fail-open (never fail user flow because logging failed).
- Add strict redaction policy (PII, API keys, large payload truncation).
- Standardize retry/backoff/timeout and map provider-specific errors to internal error codes.
- Add explicit context handoff strategy for Celery workers.

**Risk Assessment: MEDIUM-HIGH** — Central dependency for 02-03/04/06; small design gaps here amplify across the phase.

---

### Plan 02-02 — Canvas Backend Models + CRUD API

**Summary**
This plan covers the essential baseline for REQ-04 and is appropriately scoped for first canvas persistence. Main risks are data integrity, authz/tenant boundaries, and transactional consistency across node/edge operations.

**Strengths**
- Correctly starts with domain models before API surface.
- Includes full CRUD for canvas/nodes/edges, enough for a usable base canvas.
- Node type list is aligned with phase objective and frontend scope.

**Concerns**
- **[HIGH]** Missing explicit authorization/tenant scoping opens IDOR risks on canvas resources.
- **[HIGH]** No concurrency strategy (versioning/ETag/updated_at checks) for collaborative edits.
- **[MEDIUM]** Edge integrity constraints are unspecified (same-canvas checks, orphan nodes, duplicate edges).
- **[MEDIUM]** CRUD-only shape may cause chatty frontend writes; no bulk/patch semantics mentioned.
- **[LOW]** No stated pagination/filtering for list endpoints (future scale risk).

**Suggestions**
- Add row-level ownership/tenant enforcement on every query path.
- Add integrity constraints + service-layer validation for node/edge relationships.
- Introduce optimistic concurrency control for update/delete operations.
- Add at least one transactional "graph update" endpoint for atomic node+edge edits.
- Add migration/index plan (`canvas_id`, `source_node_id`, `target_node_id`, timestamps).

**Risk Assessment: MEDIUM** — Achievable, but security and integrity details need to be explicit before implementation.

---

### Plan 02-03 — TEXT + EXTRACT Skill Migration

**Summary**
This is a direct fit for REQ-03 and logically depends on 02-01. The major risk is output quality/reliability if schemas, validation, and fallback behavior are not standardized across these upgraded handlers.

**Strengths**
- Good dependency alignment with provider infrastructure.
- Pragmatic incremental migration within existing categories.
- Explicit provider/context wiring improves observability consistency.

**Concerns**
- **[HIGH]** No explicit structured output contracts per skill; brittle parsing risk.
- **[MEDIUM]** Missing malformed-output fallback behavior and partial-failure handling.
- **[MEDIUM]** Potential prompt drift and regression without golden tests.
- **[MEDIUM]** Manual `set_ai_call_context()` usage can be inconsistently applied.

**Suggestions**
- Define strict request/response schemas (Pydantic) for each skill.
- Add shared LLM execution wrapper enforcing validation + retries + canonical errors.
- Add deterministic fixture-based tests for representative inputs per skill.
- Consider auto-context middleware/decorator to avoid per-handler manual wiring.

**Risk Assessment: MEDIUM-HIGH** — Functionally aligned, but reliability depends on guardrails not yet described.

---

### Plan 02-04 — SCRIPT + STORYBOARD + VISUAL Skill Migration

**Summary**
This plan strongly advances REQ-03 breadth but has high execution risk due to scope density (three domains plus image generation) and operational complexity (cost, latency, moderation, async orchestration).

**Strengths**
- Covers key content pipeline domains end-to-end.
- Includes registry updates to make capabilities discoverable.
- Introduces image generation, which is critical for product value.

**Concerns**
- **[HIGH]** Scope is very wide for one plan unit; high blast radius and review difficulty.
- **[HIGH]** `visual.generate_image` needs safety/moderation and abuse controls not specified.
- **[HIGH]** Cost/latency for image generation can destabilize worker throughput without quotas/queue controls.
- **[MEDIUM]** Sync prompt skills + async image path may create inconsistent execution semantics.
- **[MEDIUM]** Registry growth without naming/versioning policy risks future conflicts.

**Suggestions**
- Split visual/image generation into a separate plan or sub-wave.
- Add moderation gate + prompt sanitation + denylist/allowlist policies.
- Add quota/rate limits and per-skill queue/timeouts for image jobs.
- Define skill naming/versioning conventions now (`category.action.v1` pattern).
- Add end-to-end tests from script → storyboard → visual prompt/output handoff.

**Risk Assessment: HIGH** — Valuable scope, but too much coupled complexity for one execution slice.

---

### Plan 02-05 — Canvas Frontend with @xyflow/react

**Summary**
This plan is directionally correct for REQ-04 and maps well to backend canvas CRUD. The main risk is packaging too much frontend architecture and execution behavior into one unit without explicit incremental checkpoints.

**Strengths**
- Clear component breakdown (page/workspace/toolbar/store/client).
- Node registry + connection rules aligns with extensible node-based UX.
- Execution hook (`invoke + poll`) provides practical baseline before realtime transport.

**Concerns**
- **[HIGH]** 15 files in one execution unit is likely too large; harder to review, test, and rollback safely.
- **[HIGH]** Polling execution can create load/staleness issues without backoff/cancelation rules.
- **[MEDIUM]** Potential state duplication/conflicts between Zustand state and XYFlow internal state.
- **[MEDIUM]** Client-side connection rules alone are bypassable; server validation dependency is implicit.
- **[MEDIUM]** Missing explicit error UX/retry states for node execution failures/timeouts.

**Suggestions**
- Split into 2-3 PR units:
  1. Canvas shell + read/write graph CRUD
  2. Node components + registry/rules
  3. Execution hook + edge UX
- Define polling contract: interval backoff, max attempts, abort on unmount.
- Keep a single source of truth for graph state (clear ownership between Zustand and XYFlow).
- Ensure backend validates node-type and edge constraints regardless of frontend checks.
- Add minimal e2e tests for create/connect/execute/fail states.

**Risk Assessment: MEDIUM-HIGH** — Good direction, but packaging size and execution UX reliability are key risks.

---

### Plan 02-06 — Billing Baseline

**Summary**
This is a necessary baseline and is correctly tied to LLM logging infrastructure. Risk centers on metering correctness, authz rigor for admin mutations, and long-term pricing model flexibility.

**Strengths**
- Uses Decimal precision (correct for money fields).
- Includes both pricing management and usage stats API, not just schema.
- Admin-only write intent is appropriate.

**Concerns**
- **[HIGH]** Admin-only writes need concrete authz/audit enforcement details (not just intent).
- **[HIGH]** Usage stats accuracy depends on complete/consistent AICallLog ingestion and token normalization.
- **[MEDIUM]** SQLite/Postgres Decimal behavior differences can cause rounding inconsistencies.
- **[MEDIUM]** Seed pricing updates may become non-idempotent without migration/version strategy.
- **[LOW]** No time-versioned pricing model (effective dates) for future price changes.

**Suggestions**
- Add immutable pricing version rows with `effective_from`/`effective_to`.
- Add audit trail for pricing changes (who/when/what).
- Define a canonical metering pipeline from AICallLog fields to billable units.
- Add rounding policy tests across DB backends and API serialization.
- Prefer soft-deactivate over hard-delete for pricing records.

**Risk Assessment: MEDIUM** — Solid baseline if metering/authz details are tightened.

---

### Wave Structure Review

**Summary**
The 2-wave structure is mostly correct and dependency-aware. Wave 1 creates foundational infra (provider/logging and canvas backend), and Wave 2 layers domain migrations + UI + billing. The main issue is not ordering, but concentration of risk in 02-04 and execution-unit size in 02-05.

**Strengths**
- Dependencies are generally sensible (02-03/04/06 on 02-01, 02-05 on 02-02).
- Parallelization is reasonable and should reduce cycle time.
- Phase goals are covered across the six plans.

**Concerns**
- **[HIGH]** No explicit cross-plan integration milestone/test gate before considering phase done.
- **[MEDIUM]** 02-05 may also need dependency on stable execution APIs from skill migrations, not only canvas CRUD.
- **[MEDIUM]** Observability/security concerns are spread across plans but not captured as explicit acceptance criteria.

**Overall Phase Risk: MEDIUM-HIGH** — The plan set is directionally strong and aligned to REQ-03/REQ-04, but reliability/security guardrails and plan granularity need tightening to reduce execution and regression risk.

---

## Consensus Summary

> Note: Only one external reviewer (Codex) was available — Gemini CLI failed due to sandbox permission restrictions. Consensus is derived from the single reviewer's cross-plan analysis.

### Top Concerns (Priority Order)

1. **Security / Authorization gaps** — Canvas CRUD (02-02) and Billing (02-06) lack explicit tenant-scoped authz, creating IDOR risk. Pricing admin writes need concrete enforcement, not just intent.

2. **Plan granularity** — 02-04 (3 domains + image gen) and 02-05 (15 frontend files) are overloaded for single execution units. High blast radius on failure.

3. **Reliability guardrails missing** — No retry/timeout/backoff across providers (02-01), no structured output contracts for LLM parsing (02-03/04), no polling backoff/cancellation (02-05).

4. **ContextVar propagation across Celery** — The ContextVar-based tracing in 02-01 may not survive Celery task boundaries without explicit rehydration.

5. **Cross-plan integration gate absent** — No final acceptance test verifying "5 node types execute end-to-end via SkillRegistry with logs + billing metering."

### Agreed Strengths

- Wave structure and dependency ordering are sound
- Provider abstraction (single SDK pattern) is pragmatic
- Skill migration pattern (descriptor + handler + registration) is well-established
- AICallLog + billing baseline placed early enables observability from day one
- Decimal precision for cost calculations is correct

### Recommended Actions Before Execution

| # | Action | Affects Plans |
|---|--------|---------------|
| 1 | Add tenant/ownership checks to Canvas CRUD endpoints | 02-02 |
| 2 | Make AICallLog writes fail-open (try/except, never break provider call) | 02-01 |
| 3 | Split 02-04: isolate `visual.generate_image` into own plan or sub-task | 02-04 |
| 4 | Split 02-05 into 2-3 incremental delivery units | 02-05 |
| 5 | Add explicit ContextVar rehydration in Celery skill_task.py | 02-01, 02-03, 02-04 |
| 6 | Add cross-plan integration acceptance test as phase gate | All |
| 7 | Define polling backoff + max attempts + unmount cleanup | 02-05 |
