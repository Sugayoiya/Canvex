---
phase: 12-ai-call-convergence
plan: 03
subsystem: ai
tags: [convergence, migration, async, provider-manager, sqlite-removal, health-reporting, contextvars]

requires:
  - phase: 12-02
    provides: "ProviderManager with get_provider() async path, resolve_llm_provider(), contextvars"
provides:
  - "All 13 AI call sites migrated to unified ProviderManager async path"
  - "get_provider_sync() fully removed"
  - "SQLite support dropped (D-16)"
  - "LLMProviderBase contextvars-based health reporting"
  - "6 integration tests verifying all 4 call stacks (LLM/Agent/Image/Video)"
affects: [12-04-admin-api, all-skills, agent-service]

tech-stack:
  added: []
  patterns: [resolve_llm_provider-pattern, resolve_pydantic_model-pattern, explicit-health-reporting, contextvars-health-hooks]

key-files:
  created:
    - api/tests/test_provider_convergence.py
  modified:
    - api/app/skills/text/llm_generate.py
    - api/app/skills/text/refine.py
    - api/app/skills/script/convert_screenplay.py
    - api/app/skills/script/split_clips.py
    - api/app/skills/extract/characters.py
    - api/app/skills/extract/scenes.py
    - api/app/skills/storyboard/plan.py
    - api/app/skills/storyboard/detail.py
    - api/app/skills/visual/character_prompt.py
    - api/app/skills/visual/scene_prompt.py
    - api/app/skills/visual/generate_image.py
    - api/app/skills/video/generate_video.py
    - api/app/agent/agent_service.py
    - api/app/api/v1/agent.py
    - api/app/services/ai/llm_provider_base.py
    - api/app/services/ai/provider_manager.py
    - api/app/core/config.py
    - api/app/core/database.py
    - api/tests/conftest.py

key-decisions:
  - "resolve_llm_provider(ctx) pattern for all 10 LLM skills — single-line migration, ctx carries team_id/user_id"
  - "resolve_pydantic_model() for Agent — async, DB-backed, no settings.*_API_KEY reads"
  - "Image/Video skills use explicit health reporting (report_success/report_error) since they bypass LLMProviderBase"
  - "LLMProviderBase health hooks use contextvars for concurrency safety (not instance attributes)"
  - "SQLite validator in Settings rejects sqlite:// URLs with clear migration message"
  - "Settings.Config.extra='ignore' for backward compat with .env files containing removed fields"
  - "seed_providers_from_env() intentionally retains settings.*_API_KEY reads (startup env→DB bridge, not runtime)"

patterns-established:
  - "LLM skill migration pattern: import resolve_llm_provider, destructure (provider, _key_id), pass ctx"
  - "Image/Video migration pattern: get_provider() → api_key + key_id, explicit health report on success/error"
  - "Agent async model resolution: resolve_pydantic_model(provider, model, team_id=, user_id=)"

requirements-completed: [CONV-01, CONV-02, CONV-03, CONV-04, CONV-06]

duration: 7min
completed: 2026-04-02
---

# Phase 12 Plan 03: Caller Migration & Legacy Removal Summary

**All 13 AI call sites migrated to unified ProviderManager async path with contextvars health reporting, legacy sync removed, SQLite dropped**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-02T10:28:26Z
- **Completed:** 2026-04-02T10:35:35Z
- **Tasks:** 2
- **Files modified:** 19 (1 created, 18 modified)

## Accomplishments

- **10 LLM Skills** migrated from `get_provider_sync()` to `resolve_llm_provider(ctx)` — unified async DB credential chain
- **Agent (PydanticAI)** migrated from `create_pydantic_model(settings.*)` to `async resolve_pydantic_model()` using DB-backed credentials with team_id/user_id
- **Image Skill** migrated from `settings.GEMINI_API_KEY` to `get_provider()` with explicit `report_success(key_id)` / `report_error(key_id, ...)` health hooks
- **Video Skill** migrated same pattern as Image
- **LLMProviderBase** enriched with contextvars-based health reporting — `_current_key_id_var` read in `_wrapped_generate` success/error paths
- `get_provider_sync()`, `_get_env_api_key()`, `_ENV_KEY_MAP` fully removed from ProviderManager
- `USE_SQLITE`, `SQLITE_URL`, SQLite branches removed from config and database modules
- SQLite rejection validator added to Settings
- 6 new integration tests covering all 4 convergence stacks + sync removal + skill registration
- Static verification confirms zero hidden env/settings API key reads in runtime code

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate all 13 call sites + LLMProviderBase health hooks** - `e5d836c` (feat)
2. **Task 2: Remove legacy code, drop SQLite, add convergence tests** - `6361f34` (feat)

## Files Created/Modified

### Created
- `api/tests/test_provider_convergence.py` — 6 integration tests: LLM skill, Agent, Image, Video, sync removal, registration

### Modified (13 migrated call sites)
- `api/app/skills/text/llm_generate.py` — `get_provider_sync` → `resolve_llm_provider(ctx)`
- `api/app/skills/text/refine.py` — same pattern
- `api/app/skills/script/convert_screenplay.py` — same pattern
- `api/app/skills/script/split_clips.py` — same pattern
- `api/app/skills/extract/characters.py` — same pattern
- `api/app/skills/extract/scenes.py` — same pattern
- `api/app/skills/storyboard/plan.py` — same pattern
- `api/app/skills/storyboard/detail.py` — same pattern
- `api/app/skills/visual/character_prompt.py` — same pattern
- `api/app/skills/visual/scene_prompt.py` — same pattern
- `api/app/skills/visual/generate_image.py` — `settings.GEMINI_API_KEY` → `get_provider()` + health reporting
- `api/app/skills/video/generate_video.py` — `settings.GEMINI_API_KEY` → `get_provider()` + health reporting
- `api/app/agent/agent_service.py` — `create_pydantic_model(settings)` → `async resolve_pydantic_model(DB)`

### Modified (infrastructure)
- `api/app/api/v1/agent.py` — `agent_service.create_agent()` → `await agent_service.create_agent(team_id=, user_id=)`
- `api/app/services/ai/llm_provider_base.py` — added `_current_key_id_var` health reporting in `_wrapped_generate`
- `api/app/services/ai/provider_manager.py` — removed `get_provider_sync`, `_get_env_api_key`, `_ENV_KEY_MAP`
- `api/app/core/config.py` — removed `USE_SQLITE`/`SQLITE_URL`, added `validate_database_url`, added `extra='ignore'`
- `api/app/core/database.py` — removed SQLite engine config, pragma hooks, branching
- `api/tests/conftest.py` — updated env vars for PostgreSQL-only settings validation

## Decisions Made

- **resolve_llm_provider(ctx) pattern**: All LLM skills use the same single-line migration. The `ctx` (SkillContext) carries team_id/user_id for the credential chain. The returned `_key_id` is unused by the skill because LLMProviderBase handles health reporting automatically via contextvars.
- **Explicit health reporting for Image/Video**: These skills bypass LLMProviderBase (they use GeminiImageProvider/GeminiVideoProvider directly), so they must call `report_success(key_id)` and `report_error(key_id, ...)` explicitly.
- **Settings.Config.extra='ignore'**: Prevents validation errors when `.env` files still contain `USE_SQLITE` or `SQLITE_URL` from before the migration. Allows gradual cleanup.
- **seed_providers_from_env() retained**: The startup seeder intentionally reads `settings.*_API_KEY` to create system-level DB rows. This is NOT runtime credential resolution — it's the one-time env→DB bridge function.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pydantic-settings extra field validation**
- **Found during:** Task 2 (SQLite removal)
- **Issue:** Removing `USE_SQLITE`/`SQLITE_URL` from Settings caused pydantic to reject env vars from `.env` files that still contain these fields
- **Fix:** Added `extra = "ignore"` to `Settings.Config` for backward compatibility
- **Files modified:** api/app/core/config.py
- **Committed in:** `6361f34` (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed test conftest env var for PostgreSQL**
- **Found during:** Task 2 (test execution)
- **Issue:** conftest set `DATABASE_URL=sqlite+aiosqlite:///./test.db` which now fails the sqlite rejection validator
- **Fix:** Changed to `DATABASE_URL=postgresql+asyncpg://...` (conftest creates its own SQLite test engine directly, bypassing settings)
- **Files modified:** api/tests/conftest.py
- **Committed in:** `6361f34` (Task 2 commit)

**3. [Rule 1 - Bug] Fixed test mock targets for lazy imports**
- **Found during:** Task 2 (test execution)
- **Issue:** Skills use lazy imports (`from ... import resolve_llm_provider` inside function body), so `patch("app.skills.text.llm_generate.resolve_llm_provider")` fails with AttributeError
- **Fix:** Patched at source module level (`app.services.ai.provider_manager.resolve_llm_provider`) instead
- **Files modified:** api/tests/test_provider_convergence.py
- **Committed in:** `6361f34` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug in tests)
**Impact on plan:** All fixes necessary for correct execution. No scope creep.

## Static Verification Results

| Check | Result |
|-------|--------|
| `get_provider_sync` in app/ | **ZERO** matches |
| `_ENV_KEY_MAP` in provider_manager.py | **ZERO** matches |
| `_get_env_api_key` in app/ | **ZERO** matches |
| `settings.*_API_KEY` in skills/ and agent/ | **ZERO** matches |
| `USE_SQLITE` in app/core/ | **ZERO** matches |
| `resolve_llm_provider` in all 10 skill files | **10/10** present |
| `_current_key_id_var` in llm_provider_base.py | **4** references (success + error paths) |

## Known Stubs

None — all data paths are fully wired.

## Issues Encountered

- Pre-existing test failure: `test_canvas_api.py::test_node_valid_types` fails (unrelated to this plan — canvas node type validation issue). Logged as out-of-scope.

## Self-Check: PASSED

- All 18 modified files verified present on disk
- Both commit hashes (`e5d836c`, `6361f34`) verified in git log
- 72/73 tests pass (1 pre-existing failure in test_canvas_api unrelated to this plan)

---
*Phase: 12-ai-call-convergence*
*Completed: 2026-04-02*
