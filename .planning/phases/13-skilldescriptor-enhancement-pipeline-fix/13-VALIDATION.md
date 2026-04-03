---
phase: 13
slug: skilldescriptor-enhancement-pipeline-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (installed via uv) |
| **Config file** | api/pyproject.toml or implicit |
| **Quick run command** | `cd api && uv run pytest tests/test_descriptor_fields.py tests/test_skill_registration.py -x` |
| **Full suite command** | `cd api && uv run pytest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd api && uv run pytest tests/test_descriptor_fields.py tests/test_skill_registration.py -x`
- **After every plan wave:** Run `cd api && uv run pytest`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | DESC-01 | unit | `uv run pytest tests/test_descriptor_fields.py::test_skill_kind -x` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | DESC-02 | unit | `uv run pytest tests/test_descriptor_fields.py::test_require_prior_kind -x` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | DESC-03 | unit | `uv run pytest tests/test_descriptor_fields.py::test_default_require_prior_kind -x` | ❌ W0 | ⬜ pending |
| 13-01-04 | 01 | 1 | DESC-04 | unit | `uv run pytest tests/test_descriptor_fields.py::test_supports_skip -x` | ❌ W0 | ⬜ pending |
| 13-01-05 | 01 | 1 | DESC-05 | unit | `uv run pytest tests/test_descriptor_fields.py::test_safety_metadata -x` | ❌ W0 | ⬜ pending |
| 13-01-06 | 01 | 1 | DESC-06 | unit | `uv run pytest tests/test_descriptor_fields.py::test_skill_tier -x` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 2 | DESC-07 | integration | `uv run pytest tests/test_skill_annotations.py -x` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 3 | DESC-08 | unit | `uv run pytest tests/test_tool_middleware.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api/tests/test_descriptor_fields.py` — stubs for DESC-01 through DESC-06 (dataclass field existence + defaults)
- [ ] `api/tests/test_skill_annotations.py` — stubs for DESC-07 (all 14 skills have metadata)
- [ ] `api/tests/test_tool_middleware.py` — stubs for DESC-08 (metadata-driven filtering scenarios)
- [ ] Update `api/tests/test_skill_registration.py` — remove expectations for deprecated handlers

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| System prompt includes safety metadata | DESC-05/DESC-07 | Requires running agent and inspecting prompt | Start agent session, check system prompt contains `is_read_only`/`is_destructive` annotations |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
