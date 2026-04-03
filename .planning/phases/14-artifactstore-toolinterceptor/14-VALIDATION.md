---
phase: 14
slug: artifactstore-toolinterceptor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | api/pyproject.toml |
| **Quick run command** | `cd api && uv run pytest tests/ -x -q --tb=short` |
| **Full suite command** | `cd api && uv run pytest tests/ -v` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd api && uv run pytest tests/ -x -q --tb=short`
- **After every plan wave:** Run `cd api && uv run pytest tests/ -v`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | ARTS-01 | unit | `uv run pytest tests/test_artifact_store.py -k test_model` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | ARTS-02 | unit | `uv run pytest tests/test_artifact_store.py -k test_crud` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | ARTS-03,ARTS-04 | unit | `uv run pytest tests/test_tool_interceptor.py -k test_before_hook` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 1 | ARTS-05 | unit | `uv run pytest tests/test_tool_interceptor.py -k test_after_hook` | ❌ W0 | ⬜ pending |
| 14-02-03 | 02 | 1 | ARTS-06 | unit | `uv run pytest tests/test_tool_interceptor.py -k test_recursive_backfill` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 2 | PIPE-05 | integration | `uv run pytest tests/test_celery_tasks.py` | ❌ W0 | ⬜ pending |
| 14-04-01 | 04 | 2 | PIPE-03 | integration | `uv run pytest tests/test_pipeline_artifacts.py` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api/tests/test_artifact_store.py` — stubs for ARTS-01, ARTS-02
- [ ] `api/tests/test_tool_interceptor.py` — stubs for ARTS-03, ARTS-04, ARTS-05, ARTS-06
- [ ] `api/tests/test_celery_tasks.py` — stubs for PIPE-05
- [ ] `api/tests/test_pipeline_artifacts.py` — stubs for PIPE-03
- [ ] `api/tests/conftest.py` — shared fixtures (db session, mock celery)

*Existing pytest infrastructure covers framework needs; only test files need creation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSE tool return format shows summary instead of JSON blob | ARTS-04 | Requires browser + real agent session | 1. Start agent chat 2. Trigger generate_image 3. Verify SSE shows summary text not raw JSON |
| Celery worker processes queued tasks under load | PIPE-05 | Requires running Celery worker + Redis | 1. Start worker 2. Submit 3+ concurrent image gen 3. Verify tasks complete with retry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
