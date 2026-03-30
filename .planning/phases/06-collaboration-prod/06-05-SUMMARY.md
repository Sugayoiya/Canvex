---
phase: 06-collaboration-prod
plan: 05
subsystem: api
tags: [project-crud, user-search, ai-provider, quota, ownership]
dependency_graph:
  requires: [06-01, 06-02, 06-04]
  provides: [project-api, user-api, ai-provider-api, team-member-quota]
  affects: [router, quota-service]
tech_stack:
  added: []
  patterns: [ownership-scoped-crud, fernet-key-encryption, subquery-count, clone-deep-copy]
key_files:
  created:
    - api/app/api/v1/projects.py
    - api/app/api/v1/users.py
    - api/app/api/v1/ai_providers.py
    - api/app/schemas/project.py
    - api/app/schemas/user.py
    - api/app/schemas/ai_provider.py
  modified:
    - api/app/api/v1/router.py
    - api/app/models/quota.py
    - api/app/services/quota_service.py
decisions:
  - "ProjectClone copies canvases + nodes + edges with new UUIDs and ID remapping"
  - "AI Provider ownership verification extracted to _verify_config_ownership helper"
  - "ModelConfigResponse.from_model_config classmethod handles JSON capabilities parsing"
  - "TeamMemberQuota uses same _lazy_reset pattern as UserQuota/TeamQuota"
metrics:
  duration: "3m17s"
  completed: "2026-03-30T15:02:57Z"
  tasks: 3
  files: 9
---

# Phase 06 Plan 05: Project CRUD, User API & AI Provider Admin Summary

Project CRUD with ownership-scoped filtering and deep clone (canvases+nodes+edges), user search/profile with team aggregation, AI provider admin CRUD with Fernet key encryption, and team→member quota allocation enforcement per D-19.

## What Was Built

### Task 1: Project CRUD + Clone + User Search/Profile API
- **Project endpoints** (6 routes): create, list, get, update, delete, clone
- Ownership scoping: personal projects filtered by user.id, team projects validated via `require_team_member`
- Clone copies project metadata + all canvases with nodes/edges (UUID remapping for integrity)
- Canvas count via correlated subquery on list/get
- **User endpoints** (3 routes): search, get profile, update profile
- Search by email/nickname with ILIKE pattern matching, excludes current user
- Profile returns user info with team memberships via selectinload join

### Task 2: AI Provider Admin API + Route Registration
- **AI Provider endpoints** (7 routes): list, create, update, delete providers; add/delete keys; list models
- Three-tier ownership authorization: system (require_admin), team (require_team_member team_admin), personal (owner_id match)
- Keys encrypted via `encrypt_api_key` (Fernet) — never exposed in responses
- Model listing resolves provider display names via AIModelProviderMapping join
- JSON capabilities string parsed to list in ModelConfigResponse.from_model_config
- **Router updated**: projects, users, ai-providers routers registered (89 total routes)

### Task 3: Quota Adaptation for Team→Member Allocation (D-19)
- `TeamMemberQuota` model with team_id+user_id unique constraint
- `check_quota` enforces member monthly credit + daily call limits after team-level check
- `update_usage` increments member-level counters alongside team-level counters
- `_lazy_reset` type hint extended to accept `TeamMemberQuota`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | c675160 | feat(06-05): add Project CRUD with ownership scoping, clone, and User search/profile API |
| 2 | b4f9598 | feat(06-05): add AI Provider admin CRUD with key encryption and route registration |
| 3 | c489403 | feat(06-05): add TeamMemberQuota model and team→member allocation enforcement (D-19) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all endpoints are fully wired to models and services.

## Self-Check: PASSED
