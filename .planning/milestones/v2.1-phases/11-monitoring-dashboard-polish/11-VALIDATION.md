---
phase: 11
slug: monitoring-dashboard-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), pytest (backend) |
| **Config file** | `web/vitest.config.ts`, `api/pyproject.toml` |
| **Quick run command** | `cd web && npm run test -- --run` / `cd api && uv run pytest -x -q` |
| **Full suite command** | `cd web && npm run test -- --run && cd ../api && uv run pytest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick test command for affected area
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | REQ-25 | integration | `cd api && uv run pytest tests/test_admin_alerts.py -x` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | REQ-25 | manual | Browser: verify KPI cards clickable | N/A | ⬜ pending |
| 11-02-01 | 02 | 1 | REQ-24 | integration | `cd api && uv run pytest tests/test_logs_pagination.py -x` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | REQ-24 | manual | Browser: verify monitoring tabs + filters | N/A | ⬜ pending |
| 11-03-01 | 03 | 2 | REQ-24 | manual | Browser: verify Usage & Cost charts render | N/A | ⬜ pending |
| 11-04-01 | 04 | 2 | REQ-24/25 | manual | Browser: verify loading/error/empty states | N/A | ⬜ pending |
| 11-05-01 | 05 | 2 | REQ-25 | manual | Bundle analysis: admin chunks isolated | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api/tests/test_admin_alerts.py` — stubs for GET /admin/alerts endpoint
- [ ] `api/tests/test_logs_pagination.py` — verify X-Total-Count header on /logs/skills, /logs/ai-calls

*Existing frontend test infrastructure (vitest) and backend test infrastructure (pytest) cover framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| KPI cards click-to-navigate | REQ-25 | Requires browser navigation | Click each KPI card, verify navigation to correct sub-page |
| Monitoring tab switching | REQ-24 | UI interaction | Switch tabs, verify content loads for Tasks/AI Calls/Skills/Usage & Cost |
| Loading skeletons visible | REQ-24/25 | Visual verification | Throttle network, verify skeleton states appear |
| Error boundaries catch errors | REQ-24/25 | Requires error injection | Disable API, verify error boundary UI renders |
| Empty states display | REQ-24/25 | Requires empty data | Clear test data, verify empty state messages |
| Dashboard fits one viewport | REQ-25 | Visual layout check | Load dashboard at 1920x1080, verify no scrollbar |
| Bundle isolation | REQ-25 | Build analysis | Run `npm run build`, verify admin chunks not in non-admin routes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
