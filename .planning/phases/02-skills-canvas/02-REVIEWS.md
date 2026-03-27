---
phase: 02
reviewers: [codex]
reviewed_at: 2026-03-27T20:00:00+08:00
plans_reviewed: [02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md, 02-04-PLAN.md, 02-05-PLAN.md, 02-06-PLAN.md, 02-07-PLAN.md, 02-08-PLAN.md, 02-09-PLAN.md]
model: gpt-5.3-codex
---

# Cross-AI Plan Review — Phase 02

## Codex Review

### Plan 02-01 — LLM Provider Infrastructure + fail-open AICallLog + ContextVar
**Summary**
This is the right foundational plan for Phase 02 and aligns with the provider decisions (3 providers, timeout/retry, fail-open logging). The architecture intent is solid, but the implementation details (wrapping via `__init_subclass__`, ContextVar propagation through Celery) are high-risk points that need explicit safeguards and tests.

**Strengths**
- Establishes shared provider abstraction early.
- Explicitly includes fail-open logging behavior.
- Includes Celery context rehydration, which is critical for trace continuity.
- Keeps credentials env-based, aligned with decisions.

**Concerns**
- **HIGH**: `__init_subclass__` wrapping can cause double-wrapping/inheritance edge bugs and hidden behavior changes.
- **HIGH**: ContextVar propagation across async + Celery boundaries can silently fail, breaking trace/cost attribution.
- **MEDIUM**: Fail-open logging may mask systemic persistence failures if alerting/metrics are missing.
- **MEDIUM**: Retry policy "1x transient" needs explicit exception taxonomy; otherwise either under-retry or unsafe retry.
- **LOW**: 60s timeout may be too high for worker throughput under load.

**Specific suggestions**
- Add targeted tests for wrapper behavior across subclass hierarchies.
- Define a strict provider error taxonomy (`transient`, `auth`, `rate_limit`, `validation`).
- Emit metric/counter for fail-open log failures; alert when above threshold.
- Add redaction tests to ensure API keys/prompts are not leaked in logs.

---

### Plan 02-02 — Canvas Backend Models + project-scoped CRUD API
**Summary**
The plan is correctly scoped for baseline canvas persistence and authz. It satisfies the "base canvas" foundation, but data integrity and security hardening need more explicit coverage (IDOR, cross-project references, schema validation depth).

**Strengths**
- Project-scoped access enforced on every endpoint.
- Simplifies model scope by dropping templates/versions for now.
- Includes node-type validation and same-canvas edge checks.

**Concerns**
- **HIGH**: Need explicit anti-IDOR coverage (cross-project canvas/node IDs in requests).
- **MEDIUM**: Node payload validation appears shallow (type set only); per-node data schema may drift.
- **MEDIUM**: Concurrent node/edge writes may create inconsistent graph states without transaction constraints.
- **LOW**: No cycle/self-loop rule decision documented (may affect execution semantics later).

**Specific suggestions**
- Add DB-level foreign keys/constraints and transaction boundaries for node/edge operations.
- Add negative tests for cross-project access attempts on all CRUD endpoints.
- Define minimal per-node `data` schema contracts now (even if permissive).
- Document cycle policy (allow/deny) explicitly.

---

### Plan 02-03 — TEXT + EXTRACT Skill Migration
**Summary**
This plan directly advances REQ-03 by migrating core text/extract capabilities to real LLM-backed skills. Main risk is structured-output fragility and parse failure behavior under imperfect model responses.

**Strengths**
- Moves from placeholders to real provider-backed execution.
- Introduces typed extraction models.
- Anticipates markdown-fence JSON extraction edge case.

**Concerns**
- **HIGH**: JSON parsing from LLM outputs remains brittle; fence handling alone is insufficient.
- **MEDIUM**: No explicit fallback behavior for partially-valid extraction payloads.
- **MEDIUM**: Hardcoded prompts improve speed now but increase regression risk during migration parity checks.
- **LOW**: Potential latency/cost increase if extract operations are multi-call without batching strategy.

**Specific suggestions**
- Add robust parse pipeline: strip fences, recover JSON substring, validate, and return typed errors.
- Define graceful degradation path (partial result + warnings).
- Add fixture-based golden tests comparing parent-service outputs vs migrated skill outputs.
- Include provider timeout/retry behavior in skill-level tests.

---

### Plan 02-04 — SCRIPT + STORYBOARD Skill Migration
**Summary**
Good REQ-03 coverage for script/storyboard domains with typed outputs. The migration is directionally right but has high contract-risk because these domains usually require stricter schema/ordering constraints than text/extract.

**Strengths**
- Continues structured migration with explicit Pydantic models.
- Updates registry wiring (`register_all.py`) as part of plan.
- Keeps scope focused on skill implementations.

**Concerns**
- **HIGH**: Complex structured outputs (clip segmentation/shot plans) are highly failure-prone without strict validators.
- **MEDIUM**: Registry update can cause naming collisions or accidental override if not validated.
- **MEDIUM**: Dependency on upstream content shape (from text/extract) is implicit, not contract-tested.
- **LOW**: No explicit handling for empty/short scripts and malformed screenplay formats.

**Specific suggestions**
- Add schema constraints for ordering, duration bounds, required fields, and non-empty arrays.
- Add contract tests for accepted screenplay/input variants.
- Add startup-time registry integrity check (duplicate key detection).
- Add edge-case fixtures: tiny script, malformed screenplay, multilingual input.

---

### Plan 02-05 — Canvas Frontend Shell
**Summary**
Appropriate baseline UI plan for REQ-04 enablement. It creates the minimum canvas shell and rules, but needs tighter alignment with backend contracts and better failure-state behavior for real usage.

**Strengths**
- Clear separation: API layer, state store, connection rules, route/page.
- Module-level `nodeTypes` direction aligns with performance guidance.
- Keeps first version intentionally simple with placeholder nodes.

**Concerns**
- **MEDIUM**: Client-side connection rules can diverge from backend validation rules.
- **MEDIUM**: Missing explicit error/loading/retry UX for API failures.
- **LOW**: No clear stale-state handling when backend updates fail mid-session.
- **LOW**: Potential auth/session guard gaps on dynamic canvas route.

**Specific suggestions**
- Centralize node/edge contract constants shared between FE/BE where possible.
- Add explicit UI states: loading, unauthorized, not found, save failure.
- Add store tests for optimistic update rollback.
- Ensure route-level auth guard and project ownership check.

---

### Plan 02-06 — Billing Baseline
**Summary**
This plan correctly introduces core pricing primitives and hooks cost into call logging, which is required for future monetization. Biggest risk is pricing-version correctness and authorization scope in usage endpoints.

**Strengths**
- Uses decimal precision (`12,8`) and admin-only CRUD.
- Integrates auto-cost calc at log-write boundary.
- Includes failure isolation for pricing computation.

**Concerns**
- **HIGH**: Price versioning/time-of-call snapshot not explicit; cost reproducibility/auditability may break.
- **MEDIUM**: Usage stats endpoint scope/authorization boundaries are not detailed.
- **MEDIUM**: Pricing failure fallback behavior may silently produce zero/NULL costs without visibility.
- **LOW**: Currency and unit normalization not explicitly defined.

**Specific suggestions**
- Store price snapshot fields in `AICallLog` (unit price, currency, pricing version ID).
- Add explicit authorization matrix for usage stats (admin/team/project).
- Emit structured warning metric when pricing lookup fails.
- Add tests for model-not-priced and pricing-change-over-time scenarios.

---

### Plan 02-07 — VISUAL Skill Migration
**Summary**
Important for REQ-03 completion and future creative pipeline, but this is the plan with the largest operational/security uncertainty (moderation, artifact handling, cost tracking).

**Strengths**
- Covers both prompt-generation and image-generation capabilities.
- Introduces dedicated image provider integration.
- Keeps migration aligned with real-provider requirement.

**Concerns**
- **HIGH**: Content safety/moderation policy is not specified for image generation.
- **HIGH**: Output artifact lifecycle/storage contract is not explicit (where image bytes/URLs go, retention, access).
- **MEDIUM**: Billing integration for image-gen (non-token pricing) is unclear.
- **LOW**: Sync prompt-generation path may impact responsiveness if used in request path.

**Specific suggestions**
- Define moderation gate and blocked-content behavior before generation.
- Define artifact storage/URL model and authz access path explicitly.
- Add pricing model support for image generation units.
- Add provider failure tests (quota exceeded, safety block, invalid prompt).

---

### Plan 02-08 — Canvas 5 Node Types + Execution Hook
**Summary**
This is the core REQ-04 delivery plan and the most critical integration point. The functional scope is correct, but dependency and execution-control gaps could block end-to-end reliability.

**Strengths**
- Implements the exact five node types required for baseline.
- Adds execution hook with bounded backoff and cleanup.
- Uses module-level nodeTypes registry (performance/correctness aligned).

**Concerns**
- **HIGH**: Dependency list omits explicit dependency on 02-07 despite `image-gen-node`.
- **HIGH**: No idempotency/cancellation strategy for repeated executes or node edits during run.
- **MEDIUM**: Polling policy (up to ~14+ minutes) may be poor UX and can create request pressure.
- **MEDIUM**: Failure mapping from backend task states to node UI states is not described.
- **LOW**: No mention of partial graph execution semantics (single-node vs downstream fan-out).

**Specific suggestions**
- Add explicit dependency on 02-07.
- Introduce execution token/idempotency key per node run.
- Add cancel endpoint/UX (or at least disable re-trigger while running).
- Define strict UI state machine: queued/running/success/error/timeout.
- Add jitter to polling and global cap on concurrent pollers.

---

### Plan 02-09 — Integration Acceptance Test Gate
**Summary**
Good instinct to add a gate, but current test scope is too narrow for Phase 02 risk profile. As written, it will not adequately protect REQ-03/REQ-04 outcomes.

**Strengths**
- Establishes explicit acceptance-gate concept.
- Includes auth checks and billing authorization basics.
- Validates expected skill registration count.

**Concerns**
- **HIGH**: Missing end-to-end execution test for canvas node -> skill task -> result path (REQ-04 core).
- **HIGH**: No tests for provider retry/timeout/fail-open logging behavior.
- **MEDIUM**: Fixed expected skill count can become brittle as catalog evolves.
- **MEDIUM**: No contract tests for structured output parsing failures.
- **LOW**: No frontend integration/smoke test for execution workflow.

**Specific suggestions**
- Add one critical E2E integration test: create canvas, execute node, poll to completion/failure.
- Add provider behavior tests with mocked transient/permanent failures.
- Validate presence of required skill names instead of only fixed count.
- Add billing computation tests tied to recorded `AICallLog` entries.

---

## Wave Structure Review

**Dependency correctness**
- Wave 1 structure is sound (`02-01` infra, `02-02` canvas data/API).
- Wave 2 mostly correct.
- `02-08` should explicitly depend on `02-07` due to `image-gen-node`.
- `02-09` depends on all, but testing only at Wave 4 is late for high-risk integration points.

**Parallelization**
- Good parallel potential in Wave 2.
- Risk: concurrent edits to shared files (`register_all.py`, provider/logging paths) may cause merge/integration conflicts.
- Recommend introducing mini-checkpoints after each Wave 2 plan merge.

**Risk distribution**
- Too much integration risk accumulates before meaningful end-to-end validation.
- Recommend shifting some acceptance tests earlier:
  1. Minimal provider/logging tests right after 02-01
  2. Canvas authz/validation tests right after 02-02
  3. One execution-path test immediately after 02-08

---

## Cross-Cutting Concerns

- **Observability**: Trace propagation, fail-open logging metrics, and correlation IDs across HTTP -> Celery -> provider are critical and currently under-specified.
- **Error taxonomy**: Needs consistent error classes and status mapping across all skills for predictable retries and UI behavior.
- **Authz consistency**: Project-scoped checks must be universally applied (CRUD, execution, usage stats, artifact access).
- **Structured-output robustness**: TEXT/EXTRACT/SCRIPT/STORYBOARD all depend on fragile LLM JSON behavior; shared parser utilities are needed.
- **Billing correctness**: Cost reproducibility requires price snapshots/versioning at call time.
- **Execution control**: Idempotency, cancellation, and node run state transitions are required for reliable canvas UX.
- **Migration parity risk**: Parent-project behavior can drift due to hardcoded prompts and omitted helper dependencies.
- **Testing gap**: Current gate under-covers the most failure-prone paths (provider failures, parsing failures, execution lifecycle).

---

## Consensus Summary

### Top Concerns
1. `02-08` dependency gap (`image-gen-node` without explicit `02-07` dependency) and missing execution idempotency/cancellation.
2. Test gate (`02-09`) is too shallow for REQ-03/REQ-04 validation.
3. Structured LLM output parsing reliability is insufficiently hardened across multiple migration plans.
4. Billing auditability risk without pricing snapshot/version handling in logs.
5. Context/logging propagation correctness across Celery is high-risk and needs explicit validation.

### Agreed Strengths
- Phase scope is well aligned to roadmap goals.
- Wave 1 foundations are sensible.
- Skill migration is decomposed into manageable domain chunks.
- Canvas baseline and billing baseline are appropriately scoped for this phase.
- Security intent (project-scoped authz, admin-only pricing) is present early.

### Overall Risk Assessment
- **MEDIUM-HIGH** as currently planned.
- With dependency fix for `02-08`, earlier targeted tests, and explicit hardening of parsing/logging/idempotency/billing versioning, risk can drop to **MEDIUM** while still preserving phase velocity.

---

*Review conducted by Codex (gpt-5.3-codex) on 2026-03-27*
