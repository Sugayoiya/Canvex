---
phase: "06"
plan: "04"
subsystem: api-auth-teams
tags: [oauth, teams, groups, invitations, rbac]
dependency_graph:
  requires: [06-01]
  provides: [oauth-endpoints, team-crud, group-crud, invitation-flow]
  affects: [auth.py, teams.py, router.py, schemas/auth.py, schemas/team.py]
tech_stack:
  added: [httpx]
  patterns: [oauth-state-jwt, link-based-invitation, role-enforcement]
key_files:
  created:
    - api/app/api/v1/teams.py
    - api/app/schemas/team.py
  modified:
    - api/app/api/v1/auth.py
    - api/app/schemas/auth.py
    - api/app/api/v1/router.py
decisions:
  - "OAuth state uses JWT-signed nonce with 10min expiry for CSRF protection"
  - "GitHub fallback to /user/emails when primary email is null"
  - "Group member add validates team membership first"
  - "Last team_admin guard prevents removing sole admin"
metrics:
  duration: ~4min
  completed: "2026-03-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 3
---

# Phase 06 Plan 04: OAuth + Team/Group CRUD API Summary

OAuth social login (Google + GitHub) and full Team/Group/Member/Invitation CRUD API endpoints with role-based access enforcement.

## What Was Built

### Task 1: OAuth login/callback endpoints (Google + GitHub) — `ac6d58b`
- Added JWT-signed OAuth state helpers for CSRF protection
- Implemented `_find_or_create_oauth_user` with 3-path logic: existing OAuthAccount → existing User by email → new User + OAuthAccount
- Google OAuth: login URL generation + callback with token exchange + userinfo fetch
- GitHub OAuth: login URL generation + callback with token exchange + user fetch + email fallback
- Extended `UserResponse` schema with optional `teams` field
- Added `OAuthCallbackParams` schema

### Task 2: Team CRUD + Member management + Invitation API — `f3b486b`
- Created `api/app/schemas/team.py` with 14 Pydantic schemas covering teams, groups, members, invitations
- Team CRUD: create (auto team_admin), list (user's teams with member_count/my_role), get, update, soft-delete
- Member management: list (with user info join), add (with role validation), update role, remove (with last-admin guard)
- Invitation system: create link-based invite (7-day expiry, `secrets.token_urlsafe`), accept with token validation

### Task 3: Group CRUD + Group member management + route registration — `fcafcd2`
- Group CRUD: create (auto leader), list (with member count), update (leader role required), soft-delete (team_admin required)
- Group member management: list, add (validates team membership first), update role, remove (leader required)
- Registered `teams_router` in `api/app/api/v1/router.py`
- 19 total routes across team/member/invitation/group/group-member

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- All 4 OAuth routes present: `/auth/oauth/{google,github}/{login,callback}`
- All 11 Team/Member/Invitation routes verified
- All 8 Group/GroupMember routes verified
- teams_router registered in api_router confirmed
- Total: 19 routes on teams router + 4 OAuth routes on auth router

## Known Stubs

None — all endpoints are fully wired to models and database operations.

## Self-Check: PASSED
