---
phase: 09
slug: user-team-management-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), pytest (backend) |
| **Config file** | `web/vitest.config.ts`, `api/pyproject.toml` |
| **Quick run command** | `cd web && npm run test -- --run` |
| **Full suite command** | `cd web && npm run test -- --run && cd ../api && uv run pytest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd web && npm run test -- --run`
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | REQ-19 | unit | `cd api && uv run pytest tests/ -k admin_users` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | REQ-19 | integration | `cd web && npm run test -- --run` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | REQ-19 | component | `cd web && npm run test -- --run` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 1 | REQ-20 | component | `cd web && npm run test -- --run` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 2 | REQ-19 | component | `cd web && npm run test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Backend test stubs for admin_users teams field extension
- [ ] Frontend component test stubs for AdminDataTable, AdminPagination
- [ ] Frontend component test stubs for ConfirmationModal, row action handlers

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Debounced search (300ms) | REQ-19 | Timing-sensitive UX | Type in search, verify network tab shows delayed request |
| Toast notification content | REQ-19 | Visual UX verification | Toggle user status, verify toast shows email + action result |
| Last admin tooltip | REQ-19 | UI state edge case | With 1 admin, verify "Revoke Admin" is disabled with tooltip |
| Loading skeletons render | REQ-19, REQ-20 | Visual verification | Throttle network, verify skeleton rows appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
