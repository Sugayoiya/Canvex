---
phase: 05
slug: interaction-video
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) / vitest (frontend — not yet configured) |
| **Config file** | `api/pyproject.toml` (pytest section) |
| **Quick run command** | `cd api && uv run pytest tests/ -x --tb=short -q` |
| **Full suite command** | `cd api && uv run pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd api && uv run pytest tests/ -x --tb=short -q`
- **After every plan wave:** Run `cd api && uv run pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | REQ-09a | unit | `cd api && uv run pytest tests/test_graph_execution.py -x` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | REQ-09b | integration | `cd api && uv run pytest tests/test_batch_execute_api.py -x` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | REQ-10a | unit | `cd api && uv run pytest tests/test_billing_timeseries.py -x` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | REQ-10b | integration | `cd api && uv run pytest tests/test_billing_access.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_graph_execution.py` — stubs for REQ-09a (topological sort unit tests)
- [ ] `tests/test_batch_execute_api.py` — stubs for REQ-09b (batch execute endpoint)
- [ ] `tests/test_billing_timeseries.py` — stubs for REQ-10a (time-series aggregation)
- [ ] `tests/test_billing_access.py` — stubs for REQ-10b (admin visibility scoping)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| V5 node visual layout (label external, no header) | REQ-09 | Visual CSS positioning, not testable with unit tests | Inspect node in browser: label should be above-left of card, no header bar inside card |
| Audio waveform rendering | REQ-09 | Requires audio file playback in browser | Upload audio file → AudioNode should show waveform, red playhead, play/pause works |
| Billing charts render correctly | REQ-10 | SVG chart rendering requires visual inspection | Navigate to /billing → KPI cards, line chart, pie chart, table should render with data |
| Batch execution floating bar | REQ-09 | Multi-node selection UX requires manual interaction | Rectangle-select 2+ nodes → floating "Run Selected (N)" bar should appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
