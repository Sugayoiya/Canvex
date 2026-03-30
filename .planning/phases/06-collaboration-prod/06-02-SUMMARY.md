---
phase: 06-collaboration-prod
plan: 02
subsystem: ai, api
tags: [fernet, encryption, key-rotation, round-robin, credential-chain, billing-dimensions, sqlalchemy]

requires:
  - phase: 06-01
    provides: "AIProviderConfig + AIProviderKey + AIModelConfig DB models"
provides:
  - "DB-backed ProviderManager with credential chain (team→personal→system)"
  - "KeyRotator for round-robin key distribution with failover"
  - "Fernet encryption for API key storage"
  - "Env var seeding into DB on startup"
  - "Enriched AICallLog with group_id, canvas_id, node_id, key_owner_type, key_owner_id"
affects: [06-03, 06-04, 06-05, billing, canvas-execution]

tech-stack:
  added: [cryptography/fernet]
  patterns: [credential-chain-resolution, round-robin-key-rotation, env-seeding-on-startup, enriched-call-logging]

key-files:
  created: []
  modified:
    - api/app/services/ai/provider_manager.py
    - api/app/core/database.py
    - api/app/models/ai_call_log.py
    - api/app/services/ai/ai_call_logger.py
    - api/app/skills/extract/characters.py
    - api/app/skills/storyboard/detail.py
    - api/app/skills/storyboard/plan.py
    - api/app/skills/script/convert_screenplay.py
    - api/app/skills/script/split_clips.py
    - api/app/skills/extract/scenes.py
    - api/app/skills/visual/scene_prompt.py
    - api/app/skills/visual/character_prompt.py
    - api/app/skills/text/refine.py
    - api/app/skills/text/llm_generate.py

key-decisions:
  - "Fernet key derived from SHA-256 of SECRET_KEY (no extra env var)"
  - "Sync get_provider_sync preserved for 10 existing skill callers — async get_provider for new DB-backed path"
  - "Env fallback in credential chain as last resort when no DB keys exist"

patterns-established:
  - "Credential chain: team → personal → system → env fallback"
  - "KeyRotator pool invalidation on error report"

requirements-completed: [REQ-12]

duration: 4min
completed: 2026-03-30
---

# Phase 06 Plan 02: Provider Manager + Billing Dimensions Summary

**DB-backed ProviderManager with round-robin KeyRotator, Fernet-encrypted credentials, env seeding, and 5 new AICallLog billing dimensions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T14:52:44Z
- **Completed:** 2026-03-30T14:56:54Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Rewrote ProviderManager from env-only to DB-backed with async credential chain (team→personal→system→env)
- Added KeyRotator with round-robin distribution and MAX_KEY_ERRORS=5 failover
- Added Fernet encryption/decryption helpers derived from SECRET_KEY
- Wired seed_providers_from_env() into init_db() for automatic env→DB migration
- Enriched AICallLog with 5 new dimension columns + 3 composite indexes
- Updated ai_call_logger to pass enriched context and replace hardcoded credential_source

## Task Commits

Each task was committed atomically:

1. **Task 1: ProviderManager DB rewrite with KeyRotator + env seeding** - `954d248` (feat)
2. **Task 2: AICallLog dimension enrichment + ai_call_logger update** - `5516eb0` (feat)

## Files Created/Modified
- `api/app/services/ai/provider_manager.py` — Rewritten: KeyRotator, async get_provider, encrypt_api_key, seed_providers_from_env
- `api/app/core/database.py` — Wired seed_providers_from_env into init_db
- `api/app/models/ai_call_log.py` — 5 new columns + 3 composite indexes
- `api/app/services/ai/ai_call_logger.py` — Extended context params + dynamic credential_source
- `api/app/skills/*/` (10 files) — Migrated .get_provider() → .get_provider_sync()

## Decisions Made
- Fernet key derived from SHA-256 of SECRET_KEY — no extra env var needed, uses existing `cryptography` dependency from `python-jose[cryptography]`
- Preserved sync `get_provider_sync` for 10 existing skill callers to avoid breaking changes — new async `get_provider` is the forward path
- Env fallback as final step in credential chain ensures zero-config still works

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migrated 10 skill callers from get_provider to get_provider_sync**
- **Found during:** Task 1 (ProviderManager rewrite)
- **Issue:** Changing get_provider to async would break all 10 skill files that call it synchronously
- **Fix:** Added backward-compatible `get_provider_sync` method, updated all skill callers
- **Files modified:** 10 skill files across extract/, storyboard/, script/, visual/, text/
- **Verification:** Import check passes, skill files point to sync method
- **Committed in:** 954d248 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential backward compat fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ProviderManager ready for downstream API endpoints that need DB-backed key resolution
- AICallLog enrichment ready for billing dashboard queries by canvas/group/key-owner dimensions
- Existing skills continue working via sync path; future plans can migrate to async path

---
*Phase: 06-collaboration-prod*
*Completed: 2026-03-30*
