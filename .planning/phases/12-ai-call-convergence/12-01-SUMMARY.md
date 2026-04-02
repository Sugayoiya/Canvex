---
phase: 12-ai-call-convergence
plan: 01
subsystem: ai
tags: [redis, caching, health-check, credential-resolution, security]

requires: []
provides:
  - "KeyHealthManager — Redis CRUD for per-key health state with atomic pipelines + degraded fallback"
  - "CredentialCache — Redis credential resolution cache with metadata-only storage + single-flight lock"
affects: [12-02-provider-manager-integration, 12-04-admin-api]

tech-stack:
  added: [redis.asyncio]
  patterns: [redis-degraded-fallback, atomic-pipeline-ops, metadata-only-cache, single-flight-lock, error-redaction]

key-files:
  created:
    - api/app/services/ai/key_health.py
    - api/app/services/ai/credential_cache.py
  modified: []

key-decisions:
  - "Metadata-only caching — CredentialCache stores key_id + config metadata, never decrypted API keys, trading chain-walk for single PK lookup"
  - "canvex: Redis namespace prefix for all keys to avoid collision with Celery or other Redis users"
  - "TTL jitter (55-65s) to prevent synchronized cache expiry across concurrent callers"
  - "Degrade to safe defaults on Redis unavailability — keys treated as healthy, cache misses force DB query"

patterns-established:
  - "Redis degraded fallback: every async Redis method wrapped in try/except returning safe defaults"
  - "Atomic pipeline pattern: multi-step Redis mutations via pipeline() for consistency"
  - "Error redaction: regex-based stripping of API keys/tokens/credentials from error messages before persistence"
  - "Module-level singleton with get_*() factory function"

requirements-completed: [CONV-07, CONV-08]

duration: 2min
completed: 2026-04-02
---

# Phase 12 Plan 01: Redis Foundation Modules Summary

**KeyHealthManager + CredentialCache — Redis-backed per-key health CRUD with atomic pipelines, metadata-only credential caching with single-flight lock, and graceful degradation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-02T10:15:51Z
- **Completed:** 2026-04-02T10:17:38Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- KeyHealthManager provides per-key health state CRUD (error_count, last_used_at, recent errors, hourly usage trend) backed by Redis atomic pipelines
- CredentialCache stores only key selection metadata (key_id, config_id, provider_name) — never decrypted API keys — with single-flight SET NX lock and jittered TTL
- Both modules degrade gracefully when Redis is unavailable (no crash, safe defaults)
- Error messages redacted via 5 regex patterns before Redis storage (OpenAI keys, Google keys, Bearer tokens, generic api_key=, URL credentials)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create KeyHealthManager** - `2733b16` (feat)
2. **Task 2: Create CredentialCache** - `41be9ec` (feat)

## Files Created/Modified
- `api/app/services/ai/key_health.py` — KeyHealthManager with atomic Redis ops, degraded fallback, error redaction, usage trend, singleton factory
- `api/app/services/ai/credential_cache.py` — CredentialCache with metadata-only storage, single-flight lock, jittered TTL, SCAN-based invalidation, singleton factory

## Decisions Made
- Metadata-only caching: cache stores key_id + config metadata, never decrypted API keys. On cache hit, caller does a single-row DB lookup by key_id to decrypt. Trades expensive chain-walk (3+ DB queries) for single PK lookup (1 query).
- `canvex:` namespace prefix for all Redis keys to avoid collisions with Celery broker or other Redis users.
- TTL jitter (55-65s random) prevents synchronized cache expiry across concurrent callers.
- On Redis unavailability: keys treated as healthy (conservative), cache miss forces normal DB query path.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Redis is already required for Celery.

## Next Phase Readiness
- Both modules ready for ProviderManager integration in Plan 12-02
- KeyHealthManager exports: `KeyHealthManager`, `get_key_health_manager`
- CredentialCache exports: `CredentialCache`, `get_credential_cache`
- Plan 12-04 (Admin API) can consume `get_recent_errors()` and `get_usage_trend()` for the admin dashboard

## Self-Check: PASSED

---
*Phase: 12-ai-call-convergence*
*Completed: 2026-04-02*
