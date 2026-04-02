---
phase: 12
slug: ai-call-convergence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3.5 + pytest-asyncio 0.25.2 |
| **Config file** | `api/pyproject.toml` [tool.pytest.ini_options] asyncio_mode = "auto" |
| **Quick run command** | `cd api && uv run pytest tests/test_provider_management.py tests/test_provider_convergence.py -x` |
| **Full suite command** | `cd api && uv run pytest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd api && uv run pytest tests/test_provider_management.py tests/test_provider_convergence.py -x`
- **After every plan wave:** Run `cd api && uv run pytest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | CONV-05 | unit | `uv run pytest tests/test_provider_management.py::test_get_provider_async_db_chain -x` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | CONV-07 | unit | `uv run pytest tests/test_provider_management.py::test_key_rotation_round_robin -x` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | CONV-08 | unit | `uv run pytest tests/test_provider_management.py::test_error_feedback_loop -x` | ❌ W0 | ⬜ pending |
| 12-01-04 | 01 | 1 | CONV-09 | unit | `uv run pytest tests/test_provider_management.py::test_auto_retry_next_key -x` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | CONV-01 | integration | `uv run pytest tests/test_provider_convergence.py::test_llm_skill_uses_async_provider -x` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 2 | CONV-02 | integration | `uv run pytest tests/test_provider_convergence.py::test_agent_uses_db_credentials -x` | ❌ W0 | ⬜ pending |
| 12-02-03 | 02 | 2 | CONV-03 | integration | `uv run pytest tests/test_provider_convergence.py::test_image_skill_uses_async_provider -x` | ❌ W0 | ⬜ pending |
| 12-02-04 | 02 | 2 | CONV-04 | integration | `uv run pytest tests/test_provider_convergence.py::test_video_skill_uses_async_provider -x` | ❌ W0 | ⬜ pending |
| 12-02-05 | 02 | 2 | CONV-06 | integration | `uv run pytest tests/test_skill_registration.py -x` | ✅ | ⬜ pending |
| 12-03-01 | 03 | 3 | CONV-10 | integration | `uv run pytest tests/test_provider_management.py::test_admin_key_toggle -x` | ❌ W0 | ⬜ pending |
| 12-03-02 | 03 | 3 | CONV-11 | manual | Visual inspection of admin provider page | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api/tests/test_provider_convergence.py` — integration tests for CONV-01 through CONV-04, CONV-06
- [ ] `api/tests/test_provider_management.py` — replace skip-marked stubs with real tests for CONV-05, CONV-07, CONV-08, CONV-09, CONV-10
- [ ] Redis mock fixture in `api/tests/conftest.py` — `fakeredis` or test Redis instance

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin provider page shows per-key health | CONV-11 | UI visual verification | 1. Open Admin > Providers page 2. Verify health badges (green/yellow/red) per key 3. Toggle key enable/disable 4. Click "Reset Error Count" 5. Verify status updates in real time |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
