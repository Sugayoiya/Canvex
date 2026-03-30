---
phase: 06
slug: collaboration-prod
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest >=8.3.5 + pytest-asyncio >=0.25.2 |
| **Config file** | `api/pyproject.toml` [tool.pytest.ini_options] asyncio_mode = "auto" |
| **Quick run command** | `cd api && uv run pytest tests/ -x --timeout=30` |
| **Full suite command** | `cd api && uv run pytest tests/ -v` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd api && uv run pytest tests/ -x --timeout=30`
- **After every plan wave:** Run `cd api && uv run pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | REQ-11a | integration | `pytest tests/test_teams_api.py -x` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | REQ-11b | integration | `pytest tests/test_groups_api.py -x` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | REQ-11c | integration | `pytest tests/test_projects_api.py -x` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 1 | REQ-11d | integration | `pytest tests/test_oauth_api.py -x` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 1 | REQ-11e | manual | Frontend manual test | N/A | ⬜ pending |
| 06-04-01 | 04 | 2 | REQ-12a | integration | `pytest tests/test_provider_management.py -x` | ❌ W0 | ⬜ pending |
| 06-04-02 | 04 | 2 | REQ-12b | unit | `pytest tests/test_ai_call_logger.py -x` | ❌ W0 | ⬜ pending |
| 06-04-03 | 04 | 2 | REQ-12c | unit | `pytest tests/test_quota_service.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_teams_api.py` — stubs for REQ-11a (Team + Group CRUD)
- [ ] `tests/test_groups_api.py` — stubs for REQ-11b (Group role enforcement)
- [ ] `tests/test_projects_api.py` — stubs for REQ-11c (Project ownership scoping)
- [ ] `tests/test_oauth_api.py` — stubs for REQ-11d (OAuth flow mocks)
- [ ] `tests/test_provider_management.py` — stubs for REQ-12a (DB provider + key routing)
- [ ] `tests/test_ai_call_logger.py` — stubs for REQ-12b (Enriched dimensions)
- [ ] `tests/test_quota_service.py` — stubs for REQ-12c (Team→member quota)
- [ ] `tests/conftest.py` — extend existing fixtures for team/group/project factory helpers

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AuthGuard route protection | REQ-11e | Client-side navigation/redirect logic requires browser | 1. Open app without auth tokens 2. Verify redirect to /login 3. Login and verify access to protected routes 4. Switch between personal/team space |
| OAuth login flow | REQ-11d | External provider redirect requires real browser interaction | 1. Click Google/GitHub login button 2. Complete OAuth flow 3. Verify JWT tokens received and stored 4. Verify user account linked |
| Space switching UI | REQ-11 | Visual navigation state requires manual verification | 1. Switch from personal to team space 2. Verify sidebar updates 3. Verify project list changes 4. Verify no stale data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
