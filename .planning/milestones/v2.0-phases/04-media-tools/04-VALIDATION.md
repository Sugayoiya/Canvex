---
phase: 04
slug: media-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) / vitest (frontend) |
| **Config file** | `api/pyproject.toml` / `web/vitest.config.ts` |
| **Quick run command** | `cd api && uv run pytest tests/ -x -q --tb=short` |
| **Full suite command** | `cd api && uv run pytest tests/ -q && cd ../web && npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd api && uv run pytest tests/ -x -q --tb=short`
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| *To be populated after plans are created* | | | | | | | |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing test infrastructure covers backend (pytest) and frontend (vitest)
- [ ] No new framework installation needed

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canvas node focus panel UX | REQ-07 | Visual interaction requires browser | Focus empty/content nodes, verify panel direction and content |
| Template menu skill integration | REQ-07 | End-to-end flow across frontend+backend+AI | Click template → verify downstream node creation + skill execution |
| Quota exceeded UX feedback | REQ-08 | Requires exhausting quota first | Set low quota → generate → verify disabled send + error tooltip |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
