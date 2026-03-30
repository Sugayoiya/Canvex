---
phase: 06-collaboration-prod
plan: 01
subsystem: backend-models
tags: [orm, permissions, groups, oauth, ai-provider]
dependency_graph:
  requires: []
  provides: [Group, GroupMember, GroupProject, OAuthAccount, AIProviderConfig, AIProviderKey, AIModelConfig, AIModelProviderMapping, require_group_member]
  affects: [api/app/core/deps.py, api/app/core/database.py]
tech_stack:
  added: []
  patterns: [group-scoped project access, legacy role normalization, composite index for provider ownership]
key_files:
  created:
    - api/app/models/oauth_account.py
    - api/app/models/ai_provider_config.py
    - api/tests/test_teams_api.py
    - api/tests/test_groups_api.py
    - api/tests/test_projects_api.py
    - api/tests/test_oauth_api.py
    - api/tests/test_provider_management.py
    - api/tests/test_ai_call_logger.py
    - api/tests/test_quota_service.py
  modified:
    - api/app/models/team.py
    - api/app/core/deps.py
    - api/app/core/database.py
    - api/tests/conftest.py
decisions:
  - TeamMember default role migrated from "editor" to "member" with legacy backward compat via _LEGACY_TEAM_ROLE_MAP
  - resolve_project_access uses team_admin bypass + group-level editor check for write operations
  - OAuthAccount user relationship is lazy (no backref on User) to avoid circular dependency
metrics:
  duration: ~4 min
  completed: "2026-03-30T14:49:56Z"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 13
---

# Phase 06 Plan 01: Backend ORM Models & Permission Dependencies Summary

Group/OAuth/AIProvider data models with group-aware permission enforcement in deps.py

## What Was Built

### Task 0: Wave 0 Test Stubs + Conftest Factory Helpers
- Extended `conftest.py` with `make_user`, `make_team`, `make_group`, `make_project` factory fixtures
- Created 7 stub test files (teams, groups, projects, oauth, provider management, AI call logger, quota service)
- All stubs decorated with `@pytest.mark.skip("pending implementation")`

### Task 1: Organization Hierarchy Models + OAuthAccount + Deps Extension
- **Group model** (`groups` table): belongs to Team, with TimestampMixin + SoftDeleteMixin
- **GroupMember model** (`group_members` table): leader/editor/reviewer/viewer roles
- **GroupProject model** (`group_projects` table): join table linking groups to projects
- **OAuthAccount model** (`oauth_accounts` table): unique constraint on `(provider, provider_user_id)`
- **deps.py extensions**:
  - `TEAM_ROLE_PRIORITY`: team_admin(2) > member(1)
  - `GROUP_ROLE_PRIORITY`: leader(4) > editor(3) > reviewer(2) > viewer(1)
  - `_LEGACY_TEAM_ROLE_MAP`: maps owner/admin→team_admin, editor→member
  - `require_group_member()`: enforces group-level role minimums
  - `resolve_project_access()`: team_admin bypasses group check; members need group editor+ for writes

### Task 2: AI Provider DB Models
- **AIProviderConfig** (`ai_provider_configs` table): owner_type scoping (system/team/personal), composite index on (provider_name, owner_type, owner_id)
- **AIProviderKey** (`ai_provider_keys` table): encrypted key storage with error_count and rate_limit_rpm
- **AIModelConfig** (`ai_model_configs` table): unique model_name, capabilities as JSON string
- **AIModelProviderMapping** (`ai_model_provider_mappings` table): unique constraint on (model_config_id, provider_config_id)
- Registered all new models in `database.py` `init_db()` for auto-table creation

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 0 | d7b86f2 | test(06-01): add Wave 0 test stubs and conftest factory helpers |
| 1 | 1c44c28 | feat(06-01): add Group/GroupMember/GroupProject/OAuthAccount models and group-aware deps |
| 2 | 1522ade | feat(06-01): add AIProviderConfig/Key/ModelConfig/ModelProviderMapping models |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Registered new models in database.py init_db()**
- **Found during:** Task 2
- **Issue:** New models wouldn't have tables auto-created on startup without registration
- **Fix:** Added Group/GroupMember/GroupProject/OAuthAccount/AIProviderConfig/AIProviderKey/AIModelConfig/AIModelProviderMapping imports to init_db()
- **Files modified:** api/app/core/database.py
- **Commit:** 1522ade

## Known Stubs

None — all models are fully wired. Test stubs are intentionally pending (Wave 0 scaffolding).

## Self-Check: PASSED

- All 13 files verified present on disk
- All 3 commits verified in git log
- All 8 model classes import without errors
- No circular import issues
