---
phase: 02
slug: skills-canvas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) / vitest (frontend) |
| **Config file** | api/pyproject.toml / web/vitest.config.ts |
| **Quick run command** | `cd api && uv run pytest tests/ -x -q` |
| **Full suite command** | `cd api && uv run pytest tests/ && cd ../web && npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd api && uv run pytest tests/ -x -q`
- **After every plan wave:** Run `cd api && uv run pytest tests/ && cd ../web && npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | Skill migration | unit | `uv run pytest tests/test_skills.py` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | Canvas UI | component | `npm run test` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | Billing baseline | unit | `uv run pytest tests/test_billing.py` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api/tests/test_skills.py` — stubs for Skill registration and invocation
- [ ] `api/tests/conftest.py` — shared fixtures (db session, skill registry)
- [ ] `web/src/__tests__/` — canvas component test stubs

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canvas drag-and-drop | Base canvas UX | Browser interaction | Open canvas, drag nodes, verify connections |
| Node execution visual feedback | Canvas node states | Visual UI | Execute a node, verify loading/success states |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
