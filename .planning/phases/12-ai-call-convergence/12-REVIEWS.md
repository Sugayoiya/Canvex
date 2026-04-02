---
phase: 12
reviewers: [codex]
reviewed_at: 2026-04-02T09:48:04Z
plans_reviewed: [12-01-PLAN.md, 12-02-PLAN.md, 12-03-PLAN.md]
---

# Cross-AI Plan Review — Phase 12

## Codex Review

Cross-AI CLI execution was attempted, but external runs were blocked in this environment (Gemini OAuth prompt, Claude/Codex runtime failures), so this is a rigorous in-session review against your provided plans.

### Plan 12-01: Redis Infrastructure (Wave 1)

#### 1. Summary
Plan 12-01 is directionally strong and matches the milestone backbone (single async provider path + rotator health loop), but it still needs harder guarantees around Redis failure modes, race-safe state transitions, and credential security in cache. Without those, this wave can pass unit tests but still fail under real concurrency/load.

#### 2. Strengths
- Activates the right dormant core (`get_provider()`) as the runtime entry point.
- Separates concerns cleanly (`KeyHealthManager`, `CredentialCache`, `ProviderManager` lifecycle hooks).
- Includes explicit anti-stampede idea (TTL jitter) and health sync lifecycle.
- Test scope covers the critical behaviors (round-robin, retry, no-env-fallback).

#### 3. Concerns
- **[HIGH]** No explicit fallback behavior when Redis is degraded/unavailable; this can turn a cache/health outage into full AI outage.
- **[HIGH]** Credential cache key design implies storing resolved creds in Redis; encryption/redaction policy is not defined.
- **[HIGH]** Round-robin + error counters are race-prone across workers unless atomic Redis ops/Lua scripts are used.
- **[MEDIUM]** TTL jitter alone does not prevent hot-key herd on miss; missing single-flight/lock strategy.
- **[MEDIUM]** 5-minute Redis→DB sync can lose recent health mutations on crash/restart if flush guarantees are weak.
- **[LOW]** Health thresholds are hard-coded; no per-provider tuning for different rate-limit behaviors.

#### 4. Suggestions
- Define a Redis-down degraded mode: DB-only credential resolution + conservative key selection.
- Encrypt or avoid storing raw API keys in Redis; cache only pointer metadata if possible.
- Implement atomic selection/error update (Lua or transaction pipeline) for rotator correctness.
- Add per-key cooldown/decay strategy (not only monotonic error_count) to avoid permanent starvation.
- Add integration tests against real Redis (not just fakeredis) for expiry, script, and concurrency semantics.
- Add explicit crash-consistency test for restore/sync cycle.

#### 5. Risk Assessment
**Overall risk: MEDIUM-HIGH**
Core architecture is correct, but reliability and security details are currently under-specified for production concurrency.

---

### Plan 12-02: Call Site Migration (Wave 2)

#### 1. Summary
Plan 12-02 is necessary and mostly well-scoped, but it carries the highest execution risk because it touches all live AI paths and introduces async cascade changes. The `_current_key_id` pattern and async conversion boundary need stricter design to avoid cross-request leakage and runtime breakage.

#### 2. Strengths
- Clear inventory of migration targets (13 call sites across LLM/Agent/Image/Video).
- Explicitly removes legacy bypasses (`get_provider_sync`, env readers), aligned with convergence goals.
- Preserves behavior target for existing 14 skills.
- Includes integration testing as part of migration, not post-hoc.

#### 3. Concerns
- **[HIGH]** `_current_key_id` mutable state can leak across concurrent calls if provider instances are reused.
- **[HIGH]** Async cascade risk: converting `create_agent()` async can break upstream sync callers or Celery loop handling.
- **[HIGH]** Retry semantics for image/video may duplicate non-idempotent operations without idempotency keys.
- **[MEDIUM]** "Mechanical swap" may miss hidden direct settings/env call sites unless enforced by static checks.
- **[MEDIUM]** Requirement text and decisions conflict on env fallback (criteria mention fallback; D-01 says runtime no fallback).
- **[MEDIUM]** Dropping SQLite while keeping SQLite in tests can mask production-only DB behavior differences.

#### 4. Suggestions
- Replace `_current_key_id` instance state with request-scoped context (contextvar or explicit call context).
- Add migration gate checks in CI: fail if direct env/settings key reads remain.
- Add idempotency strategy for retryable image/video calls (request IDs + provider response reconciliation).
- Split migration rollout behind feature flag for canary subset of skills first.
- Resolve the env-fallback contradiction in requirements now (single source of truth).
- Add "before/after golden output" contract tests for representative prompts in all 14 skills.

#### 5. Risk Assessment
**Overall risk: HIGH**
This wave is the most likely to introduce regressions due to broad call-site and async-surface changes.

---

### Plan 12-03: Admin Health UI (Wave 2 parallel)

#### 1. Summary
Plan 12-03 is product-valuable and mostly concrete, with good UX/accessibility intent. Main risks are backend API scaling, data sensitivity in error history, and consistency between Redis hot state and DB-backed views during mutations/sync.

#### 2. Strengths
- Clear endpoint responsibilities and UI behaviors.
- Good accessibility direction (`role="switch"`, `aria-checked`, explicit list semantics).
- Includes immediate cache invalidation after admin operations.
- Uses lazy fetch on expand rather than loading all details eagerly.

#### 3. Concerns
- **[HIGH]** Error history may expose sensitive provider payloads unless strict sanitization/redaction is enforced.
- **[MEDIUM]** Per-key health endpoint design can create N+1 API load on provider pages with many keys.
- **[MEDIUM]** 30s polling per expanded panel can become expensive with multiple admins/large key counts.
- **[MEDIUM]** Consistency model is unclear when Redis and DB differ (especially around reset/toggle + periodic sync).
- **[LOW]** Human visual checkpoint alone is insufficient; missing automated API/UI regression tests.

#### 4. Suggestions
- Add server-side redaction policy for error messages before persistence/display.
- Provide batch health endpoint for provider page to avoid N+1 fetch patterns.
- Add ETag/If-None-Match or websocket/SSE option for lower polling overhead.
- Define authoritative read/write path for mutation consistency (Redis-first with immediate DB write-through, or explicit eventual model).
- Add backend authz tests for key-level operations and frontend accessibility tests.

#### 5. Risk Assessment
**Overall risk: MEDIUM**
Good implementation clarity, but needs stronger data-safety and scalability controls for admin-scale usage.

---

## Consensus Summary

> Single-reviewer review (Codex only). For consensus, run with `--all` to include Gemini and Claude.

### Agreed Strengths
- Architecture is correct and aligned with v3.0 goals
- Clean separation of concerns (KeyHealthManager, CredentialCache, ProviderManager)
- Comprehensive migration inventory with 13 identified call sites
- Good accessibility and UX intent in admin UI

### Agreed Concerns
1. **[HIGH] Redis failure mode** — No degraded-mode fallback when Redis is down; could turn cache outage into full AI outage
2. **[HIGH] _current_key_id concurrency risk** — Mutable provider instance state can leak across concurrent requests
3. **[HIGH] Credential security in Redis** — Encryption/redaction policy not defined for cached credentials
4. **[HIGH] Retry idempotency** — Image/video retries may duplicate non-idempotent operations
5. **[MEDIUM] Env-fallback contradiction** — Success criteria mention env fallback but D-01 says no runtime env fallback

### Divergent Views
N/A — single reviewer

---

*Phase: 12-ai-call-convergence*
*Review completed: 2026-04-02*
