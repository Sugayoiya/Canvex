---
phase: 12-ai-call-convergence
plan: 02
subsystem: ai
tags: [redis, provider-manager, contextvars, key-rotation, retry, lifecycle, fakeredis]

requires:
  - phase: 12-01
    provides: "KeyHealthManager + CredentialCache Redis modules"
provides:
  - "Refactored ProviderManager with Redis-backed get_provider(), contextvars key tracking, retry support"
  - "restore_health_from_db() and sync_health_to_db() lifecycle functions"
  - "resolve_llm_provider() convenience wrapper for Skill handlers"
  - "Celery beat task for 5-min Redis→DB health sync"
  - "fakeredis test fixtures and 10 comprehensive unit tests"
affects: [12-03-caller-migration, 12-04-admin-api]

tech-stack:
  added: [fakeredis]
  patterns: [contextvars-key-tracking, metadata-only-cache-integration, health-aware-rotation, retry-with-key-failover, lifespan-lifecycle-hooks]

key-files:
  created:
    - api/app/tasks/health_sync.py
  modified:
    - api/app/services/ai/provider_manager.py
    - api/app/main.py
    - api/app/celery_app.py
    - api/tests/conftest.py
    - api/tests/test_provider_management.py

key-decisions:
  - "contextvars.ContextVar for key tracking instead of instance attributes — concurrency-safe across async requests"
  - "get_provider() returns 3-tuple (provider, owner_desc, key_id) — key_id enables downstream health reporting"
  - "Credential cache integration: cache hit does single-PK lookup, cache miss walks DB chain and populates cache"
  - "KeyRotator.next_key() made async to call KeyHealthManager.get_health() for each candidate key"
  - "Env-var fallback removed from _resolve_key() and _auto_select() — runtime only uses DB chain"

patterns-established:
  - "Lifecycle hooks pattern: seed_providers_from_env() + restore_health_from_db() in startup, sync_health_to_db() + close() in shutdown"
  - "get_provider_with_retry() pattern: auto-retry with key rotation on retryable errors, max_retries configurable per call type"
  - "fakeredis test pattern: fake_redis fixture + mock_key_health/mock_credential_cache monkeypatches for isolated Redis testing"

requirements-completed: [CONV-05, CONV-07, CONV-08, CONV-09]

duration: 4min
completed: 2026-04-02
---

# Phase 12 Plan 02: ProviderManager Redis Integration Summary

**ProviderManager refactored with Redis-backed KeyHealthManager rotation, CredentialCache fast path, contextvars concurrency safety, retry failover, and lifecycle hooks**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-02T10:20:14Z
- **Completed:** 2026-04-02T10:24:44Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- ProviderManager.get_provider() now uses Redis-backed CredentialCache for fast credential resolution and KeyHealthManager for health-aware key rotation
- Key tracking switched from instance attributes to contextvars.ContextVar for concurrency safety across async requests
- Added get_provider_with_retry() for transparent failover — reports errors to Redis and rotates to next healthy key
- Env-var fallback removed from runtime resolution paths (_resolve_key, _auto_select) per D-01/D-02
- Startup/shutdown lifecycle hooks wire seed + health restore on boot, health sync + Redis close on shutdown
- Celery beat task syncs Redis health to DB every 5 minutes for crash recovery
- 10 comprehensive unit tests covering DB chain, rotation, retry, cache, security, and resilience

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor ProviderManager with contextvars, Redis integration, lifecycle hooks** - `df40d90` (feat)
2. **Task 2: Test infrastructure (fakeredis) and comprehensive unit tests** - `5ffc9c0` (test)

## Files Created/Modified
- `api/app/services/ai/provider_manager.py` — Refactored ProviderManager with Redis integration, contextvars, retry, lifecycle hooks, consistency model documented
- `api/app/main.py` — Lifespan startup (seed + restore) and shutdown (sync + close Redis)
- `api/app/tasks/health_sync.py` — Celery beat task for 5-min Redis→DB health sync
- `api/app/celery_app.py` — Registered beat schedule and health_sync task include
- `api/tests/conftest.py` — Added fake_redis, mock_key_health, mock_credential_cache, make_provider_config fixtures
- `api/tests/test_provider_management.py` — 10 unit tests replacing skip-marked stubs

## Decisions Made
- contextvars.ContextVar for key tracking: Each async request gets its own contextvar value, eliminating the concurrency leak from the old instance attribute pattern
- get_provider() returns 3-tuple: Adding key_id as third element enables callers to report success/error to KeyHealthManager
- Credential cache integration uses metadata-only pattern: cache stores key_id, caller does single-PK DB lookup to decrypt — never caches raw API keys
- KeyRotator.next_key() made async: calls get_health() per candidate key, logs key_skip_unhealthy when skipping
- Removed threading Lock from KeyRotator (not needed in async context)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed round-robin test to exercise KeyRotator directly**
- **Found during:** Task 2 (test implementation)
- **Issue:** Credential cache short-circuits rotation — after first get_provider() call, cache hit returns same key bypassing rotator
- **Fix:** Changed test to exercise KeyRotator.next_key() directly for round-robin verification
- **Files modified:** api/tests/test_provider_management.py
- **Committed in:** `5ffc9c0` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Redis pipeline mock for degraded-mode test**
- **Found during:** Task 2 (test implementation)
- **Issue:** redis.asyncio pipeline() is synchronous, but AsyncMock made it return a coroutine
- **Fix:** Used MagicMock for pipeline() with AsyncMock only for execute()
- **Files modified:** api/tests/test_provider_management.py
- **Committed in:** `5ffc9c0` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs in test setup)
**Impact on plan:** Both fixes necessary for test correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required. Redis is already required for Celery.

## Next Phase Readiness
- ProviderManager infrastructure complete, ready for caller migration in Plan 12-03
- Exports: ProviderManager, get_provider_manager, resolve_llm_provider, restore_health_from_db, sync_health_to_db, seed_providers_from_env, encrypt_api_key
- Plan 12-03 can start migrating callers from get_provider_sync() to get_provider() async path
- Plan 12-04 (Admin API) can use get_provider_with_retry() for admin operations

## Self-Check: PASSED

---
*Phase: 12-ai-call-convergence*
*Completed: 2026-04-02*
