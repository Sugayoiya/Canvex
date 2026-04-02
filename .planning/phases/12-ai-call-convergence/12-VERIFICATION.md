---
phase: 12-ai-call-convergence
verified: 2026-04-02T18:45:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 12: AI Call Convergence Verification Report

**Phase Goal:** 收敛 3 条割裂 AI 调用栈为统一 ProviderManager 路径，激活 DB 级异步密钥链 + KeyRotator
**Verified:** 2026-04-02T18:45:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All LLM skills resolve via async resolve_llm_provider(), not get_provider_sync() | ✓ VERIFIED | All 10 skill files contain `resolve_llm_provider` (2 refs each). Grep for `get_provider_sync` in `app/` returns ZERO matches. |
| 2 | PydanticAI Agent resolves via async get_provider(), not settings.*_API_KEY | ✓ VERIFIED | `agent_service.py` contains `async def resolve_pydantic_model()` calling `pm.get_provider()`. No `settings.GEMINI_API_KEY` etc. in runtime code. |
| 3 | Image skill resolves via get_provider() with explicit health reporting | ✓ VERIFIED | `generate_image.py` calls `pm.get_provider("gemini", ...)` then `report_success(key_id)` / `report_error(key_id, ...)` explicitly. |
| 4 | Video skill resolves via get_provider() with explicit health reporting | ✓ VERIFIED | `generate_video.py` calls `pm.get_provider("gemini", ...)` then `report_success(key_id)` / `report_error(key_id, ...)` explicitly. |
| 5 | get_provider_sync() is fully removed | ✓ VERIFIED | Grep `get_provider_sync` across entire `app/` returns ZERO matches. `ProviderManager` class has no such method. |
| 6 | No runtime code reads settings.*_API_KEY for credential resolution | ✓ VERIFIED | Only 3 occurrences in `seed_providers_from_env()` (startup env→DB bridge, not runtime). Grep across `app/skills/` and `app/agent/` returns ZERO matches. |
| 7 | KeyRotator uses Redis-backed health for key selection | ✓ VERIFIED | `KeyRotator.next_key()` is `async def`, calls `khm.get_health(k.id)` for each candidate, logs `key_skip_unhealthy` when skipping. |
| 8 | LLMProviderBase reports health via contextvars _current_key_id_var | ✓ VERIFIED | `llm_provider_base.py` has 4 references to `_current_key_id_var` — reads contextvar in both success and error paths of `_wrapped_generate`. |
| 9 | Admin can view per-key health, toggle keys, and reset errors | ✓ VERIFIED | Backend has batch health endpoint (`GET /{id}/health`), per-key health, and key PATCH endpoint with cache invalidation. Frontend has HealthBadge, toggle switch, reset button, error history, sparkline — 5 admin tests pass. |
| 10 | SQLite support dropped and env fallback removed | ✓ VERIFIED | `USE_SQLITE` returns ZERO matches in `app/core/`. `config.py` has `validate_database_url` rejecting sqlite URLs. `database.py` has ZERO sqlite references. `_ENV_KEY_MAP` and `_get_env_api_key` return ZERO matches. |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/app/services/ai/key_health.py` | KeyHealthManager with Redis atomic ops, degraded fallback, error redaction | ✓ VERIFIED | 197 lines. Class with 8 async methods. 5 sensitive regex patterns. Every Redis method has try/except. Uses `canvex:` namespace. MAX_KEY_ERRORS=5. Singleton via `get_key_health_manager()`. |
| `api/app/services/ai/credential_cache.py` | CredentialCache with metadata-only storage, single-flight lock | ✓ VERIFIED | 139 lines. CRED_CACHE_TTL=60, CRED_CACHE_JITTER=5, LOCK_TTL=5. `set(...nx=True)` for lock. Jittered TTL via `random.randint`. SCAN-based invalidation. No decrypted API keys in cache values. |
| `api/app/services/ai/provider_manager.py` | Refactored ProviderManager with Redis, contextvars, retry, lifecycle | ✓ VERIFIED | 465 lines. `_current_key_id_var` ContextVar. `get_provider()` returns 3-tuple. `get_provider_with_retry()`. `resolve_llm_provider()`. `restore_health_from_db()`, `sync_health_to_db()`, `seed_providers_from_env()`. Consistency model documented in docstring. |
| `api/app/main.py` | Lifespan with startup seed/restore and shutdown sync/close | ✓ VERIFIED | Startup: `seed_providers_from_env()` + `restore_health_from_db()`. Shutdown: `sync_health_to_db()` + `get_key_health_manager().close()` + `get_credential_cache().close()`. |
| `api/app/tasks/health_sync.py` | Celery periodic task for Redis→DB sync | ✓ VERIFIED | 21 lines. `@celery_app.task(name="health_sync.sync_key_health_to_db")`. Uses `asyncio.new_event_loop()` to run async sync function. |
| `api/app/celery_app.py` | Beat schedule with 5-min sync | ✓ VERIFIED | `beat_schedule["sync-key-health"]` with `schedule: 300.0` and task `health_sync.sync_key_health_to_db`. Task include registered. |
| `api/app/services/ai/llm_provider_base.py` | Contextvars-based health reporting in _wrapped_generate | ✓ VERIFIED | 4 references to `_current_key_id_var`. Success path: `report_success(_key_id)`. Error path: `report_error(_key_id, ...)`. Both wrapped in fail-open try/except. |
| `api/app/agent/agent_service.py` | Async resolve_pydantic_model() via DB-backed credentials | ✓ VERIFIED | `async def resolve_pydantic_model()` calls `pm.get_provider()`. `create_agent()` is `async def`. Supports gemini/openai/deepseek. No `settings.*_API_KEY` reads. |
| `api/app/schemas/ai_provider.py` | KeyHealthResponse, KeyUpdateRequest, ProviderHealthResponse | ✓ VERIFIED | All 3 schemas present. KeyHealthResponse has key_id, error_count, is_healthy, health_badge, recent_errors, usage_trend. KeyUpdateRequest has is_active and reset_error_count. |
| `api/app/api/v1/ai_providers.py` | Batch health endpoint, per-key health, key PATCH | ✓ VERIFIED | `get_provider_health()` (batch), `get_key_health()` (per-key), `update_key()` (PATCH). Cache invalidation on mutations. AuditContext for system-scope operations. |
| `web/src/lib/api.ts` | getProviderHealth, getKeyHealth, updateKey API methods | ✓ VERIFIED | All 3 methods present in aiProvidersApi object. |
| `web/src/components/admin/provider-card.tsx` | Health badges, toggle, reset, expandable detail | ✓ VERIFIED | 6 matches for HealthBadge/UsageSparkline/role="switch"/provider-health patterns. |
| `web/src/components/admin/usage-sparkline.tsx` | Inline SVG sparkline for 24h usage | ✓ VERIFIED | 4 matches for UsageSparkline/role="img". File exists. |
| `web/src/app/admin/providers/page.tsx` | Toggle/reset mutations | ✓ VERIFIED | 12 matches for toggleKeyMutation/resetErrorsMutation/onToggleKey/onResetErrors. |
| `api/tests/test_provider_convergence.py` | Integration tests for call path convergence | ✓ VERIFIED | 6 tests: test_llm_skill_uses_async_provider, test_agent_uses_db_credentials, test_image_skill_uses_async_provider, test_video_skill_uses_async_provider, test_all_skills_registered, test_get_provider_sync_removed. |
| `api/tests/test_provider_management.py` | Unit tests for ProviderManager infrastructure | ✓ VERIFIED | 10 tests: DB chain, team priority, round-robin, error feedback, auto-retry skip, cache hit, cache invalidation, no-env-fallback, error redaction, degraded mode. No `@pytest.mark.skip`. |
| `api/tests/test_admin_providers.py` | Admin provider endpoint tests | ✓ VERIFIED | 5 tests: key toggle, key reset errors, batch health, per-key health, cache invalidation on toggle. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `provider_manager.py` | `key_health.py` | `get_key_health_manager()` | ✓ WIRED | Imported at top-level. Used in `KeyRotator.next_key()`, `get_provider_with_retry()`, `restore_health_from_db()`, `sync_health_to_db()`. |
| `provider_manager.py` | `credential_cache.py` | `get_credential_cache()` | ✓ WIRED | Imported at top-level. Used in `_resolve_key()` — cache check before DB walk, cache populate after DB walk. |
| `main.py` | `provider_manager.py` | `restore_health_from_db()` + `seed_providers_from_env()` in startup | ✓ WIRED | Lines 26-33: imports + calls in lifespan startup. Lines 44-46: shutdown sync + close. |
| `llm_generate.py` (all 10 LLM skills) | `provider_manager.py` | `resolve_llm_provider()` | ✓ WIRED | All 10 skill files import and call `resolve_llm_provider(provider_name, model_name, ctx)`. |
| `agent_service.py` | `provider_manager.py` | `get_provider_manager().get_provider()` | ✓ WIRED | `resolve_pydantic_model()` calls `pm.get_provider(provider, model=model_name, team_id=, user_id=)`. |
| `generate_image.py` | `provider_manager.py` + `key_health.py` | `get_provider()` + `report_success/report_error` | ✓ WIRED | Calls `pm.get_provider("gemini", ...)` for key resolution, `report_success(key_id)` on success, `report_error(key_id, ...)` on failure. |
| `generate_video.py` | `provider_manager.py` + `key_health.py` | `get_provider()` + `report_success/report_error` | ✓ WIRED | Same pattern as image skill. |
| `ai_providers.py` (admin) | `key_health.py` | `get_key_health_manager()` | ✓ WIRED | Used in batch health, per-key health, and key PATCH (reset_error_count). |
| `ai_providers.py` (admin) | `credential_cache.py` | `get_credential_cache().invalidate()` | ✓ WIRED | Called on key toggle/reset mutations for immediate effect (D-05). |
| `provider-card.tsx` | `ai_providers.py` | `GET /health` (batch) + `PATCH /keys/{id}` | ✓ WIRED | Frontend uses `getProviderHealth`, `updateKey` API methods. React Query batch fetch with 60s poll interval. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `provider-card.tsx` | `healthData` | `GET /ai-providers/{id}/health` → `KeyHealthManager.get_health()` → Redis | Redis health state from live AI calls | ✓ FLOWING |
| `usage-sparkline.tsx` | `data` prop | `healthData.keys[].usage_trend` → `KeyHealthManager.get_usage_trend()` → Redis hourly counters | Redis pipeline GET of hourly keys | ✓ FLOWING |
| `provider-card.tsx` ErrorHistory | `recent_errors` | `healthData.keys[].recent_errors` → `KeyHealthManager.get_recent_errors()` → Redis LRANGE | Redis list of JSON error entries | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running server with Redis and PostgreSQL. The phase's code is infrastructure (Redis modules, provider resolution, admin API) that depends on external services. All behavioral coverage is through the 21 unit/integration tests (10 + 6 + 5).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONV-01 | 12-03 | All LLM skill invocations resolve via unified ProviderManager async path | ✓ SATISFIED | 10/10 LLM skills use `resolve_llm_provider(ctx)`. Zero `get_provider_sync` matches. Test: `test_llm_skill_uses_async_provider`. |
| CONV-02 | 12-03 | PydanticAI Agent uses unified ProviderManager for model construction | ✓ SATISFIED | `resolve_pydantic_model()` uses `pm.get_provider()`. No `settings.*_API_KEY` reads. Test: `test_agent_uses_db_credentials`. |
| CONV-03 | 12-03 | Image generation skills resolve via unified ProviderManager | ✓ SATISFIED | `generate_image.py` uses `pm.get_provider("gemini", ...)` with explicit health reporting. Test: `test_image_skill_uses_async_provider`. |
| CONV-04 | 12-03 | Video generation skills resolve via unified ProviderManager | ✓ SATISFIED | `generate_video.py` uses `pm.get_provider("gemini", ...)` with explicit health reporting. Test: `test_video_skill_uses_async_provider`. |
| CONV-05 | 12-02, 12-03 | get_provider() async DB chain activated as single runtime entry point | ✓ SATISFIED | `get_provider()` resolves via team→personal→system DB chain with Redis cache. `get_provider_sync()` removed. Tests: `test_get_provider_async_db_chain`, `test_credential_chain_team_before_system`, `test_no_env_fallback`, `test_get_provider_sync_removed`. |
| CONV-06 | 12-03 | Existing 14 skills work without behavior changes | ✓ SATISFIED | Test: `test_all_skills_registered` asserts `len(names) >= 14`. All 10 LLM + image + video skills have matching handler tests. |
| CONV-07 | 12-01, 12-02 | KeyRotator round-robin distributes across multiple keys | ✓ SATISFIED | `KeyRotator.next_key()` async with `itertools.cycle`. Test: `test_key_rotation_round_robin` verifies 2 distinct keys across 4 calls. |
| CONV-08 | 12-01, 12-02 | KeyRotator error feedback closed-loop (429/5xx → report_error → unhealthy → skip) | ✓ SATISFIED | `report_error()` increments Redis `error_count`. `is_healthy = error_count < MAX_KEY_ERRORS`. Test: `test_error_feedback_loop` verifies 5 errors → unhealthy. |
| CONV-09 | 12-02 | Auto-retry on key failure with next healthy key | ✓ SATISFIED | `get_provider_with_retry()` with configurable `max_retries`. `KeyRotator` skips unhealthy keys. Test: `test_auto_retry_next_key` verifies sick key skipped. |
| CONV-10 | 12-04 | Admin API supports per-key management (enable/disable, reset errors) | ✓ SATISFIED | `PATCH /{id}/keys/{key_id}` with `KeyUpdateRequest`. Cache invalidation on mutations. Tests: `test_admin_key_toggle`, `test_admin_key_reset_errors`, `test_cache_invalidation_on_toggle`. |
| CONV-11 | 12-04 | Admin provider page shows per-key health status with key-level operations | ✓ SATISFIED | Batch health endpoint, per-key health endpoint. Frontend HealthBadge, toggle switch, reset button, error history, sparkline. Tests: `test_batch_health_endpoint`, `test_key_health_endpoint`. |

**All 11 requirements SATISFIED. No orphaned requirements.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns detected |

Scanned all key files (key_health.py, credential_cache.py, provider_manager.py, agent_service.py, llm_provider_base.py, generate_image.py, generate_video.py) for TODO/FIXME/PLACEHOLDER/stub patterns. Zero matches.

### Human Verification Required

### 1. Admin Provider Health UI Visual Check

**Test:** Navigate to Admin > Providers page. Verify health badges render correctly (green/yellow/red), toggle switch animates, reset errors works, expandable detail shows error history + sparkline.
**Expected:** Health badges visible per key row, toggle transitions in 200ms, toast messages in Chinese, sparkline renders SVG bars or empty state.
**Why human:** Visual appearance, animation timing, toast message rendering, and layout correctness cannot be verified programmatically.

### 2. End-to-End AI Call Flow

**Test:** Configure a real API key via Admin. Invoke an LLM skill via Agent chat. Check that key health state updates in Redis and displays in Admin UI.
**Expected:** After successful AI call, Admin health badge stays green, usage sparkline increments. After forced errors (e.g., invalid key), error count increases and badge turns yellow/red.
**Why human:** Requires running server with Redis + PostgreSQL + real AI provider API key.

## Summary

Phase 12 goal is **fully achieved**. All 3 legacy AI call stacks (Stack A: Agent/settings, Stack B: LLM skills/get_provider_sync, Stack C: Image+Video/settings) are converged to the single unified ProviderManager async DB chain. The system delivers:

1. **Unified credential path**: All 13 AI call sites (10 LLM + Agent + Image + Video) resolve via `ProviderManager.get_provider()` with team→personal→system DB chain + Redis credential cache.
2. **Active KeyRotator**: Redis-backed health state with round-robin key selection, automatic skip of unhealthy keys, and configurable retry.
3. **Per-key health infrastructure**: KeyHealthManager with atomic Redis ops, error redaction, degraded fallback. CredentialCache with metadata-only storage, single-flight lock, jittered TTL.
4. **Admin visibility**: Batch health endpoint, per-key health badges/toggle/reset/error-history/sparkline in admin UI.
5. **Lifecycle management**: Startup DB→Redis restore + env seeding. Shutdown Redis→DB sync. 5-min Celery beat background sync.
6. **Legacy removal**: `get_provider_sync()`, `_ENV_KEY_MAP`, `_get_env_api_key()`, `USE_SQLITE` all fully removed.
7. **Test coverage**: 21 tests (10 unit + 6 integration + 5 admin) covering all convergence requirements.

---

_Verified: 2026-04-02T18:45:00Z_
_Verifier: Claude (gsd-verifier)_
