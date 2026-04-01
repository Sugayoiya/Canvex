---
phase: 07
slug: admin-api-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio |
| **Config file** | `api/pyproject.toml` |
| **Quick run command** | `cd api && uv run pytest tests/test_admin_*.py -q` |
| **Full suite command** | `cd api && uv run pytest tests/ -q` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd api && uv run pytest tests/test_admin_*.py -q`
- **After every plan wave:** Run `cd api && uv run pytest tests/ -q`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | REQ-14 | unit | `cd api && uv run pytest tests/test_admin_audit.py -q` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | REQ-13 | integration | `cd api && uv run pytest tests/test_admin_users_api.py -q` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 2 | REQ-14 | integration | `cd api && uv run pytest tests/test_admin_users_api.py -q` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 3 | REQ-15 | integration | `cd api && uv run pytest tests/test_admin_observability_api.py -q` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 3 | REQ-16 | integration | `cd api && uv run pytest tests/test_admin_observability_api.py -q` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 2 | REQ-14 | integration | `cd api && uv run pytest tests/test_admin_audit_wiring.py -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api/tests/test_admin_audit.py` — audit model/service tests for REQ-14
- [ ] `api/tests/test_admin_users_api.py` — `/admin/users` listing/toggles/safeguards tests for REQ-13
- [ ] `api/tests/test_admin_observability_api.py` — `/logs/*` scope + `/admin/teams` + `/admin/dashboard` tests for REQ-15/16
- [ ] `api/tests/test_admin_audit_wiring.py` — audit emission tests for quota/billing/provider endpoints for REQ-14
- [ ] `api/tests/conftest.py` — admin/non-admin override fixtures for authz assertions

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin dashboard KPI interpretation | REQ-16 | Numeric correctness can be asserted automatically, but product usefulness is subjective | 1. Seed mixed data 2. Call `/api/v1/admin/dashboard` 3. Confirm KPI labels/windows align with product expectations |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
