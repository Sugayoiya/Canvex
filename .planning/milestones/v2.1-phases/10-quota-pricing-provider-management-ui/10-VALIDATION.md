---
phase: 10
slug: quota-pricing-provider-management-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend) + pytest (backend) |
| **Config file** | `web/vitest.config.ts`, `api/pyproject.toml` |
| **Quick run command** | `cd web && npm run test` |
| **Full suite command** | `cd web && npm run test && cd ../api && uv run pytest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd web && npm run test`
- **After every plan wave:** Run `cd web && npm run test && cd ../api && uv run pytest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | REQ-21,22,23 | unit | `cd api && uv run pytest tests/ -x -k "quota or pricing or provider"` | Partial | ⬜ pending |
| 10-02-01 | 02 | 2 | REQ-21 | integration | `cd web && npx vitest run --reporter=verbose src/app/admin/quotas` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | REQ-22 | integration | `cd web && npx vitest run --reporter=verbose src/app/admin/pricing` | ❌ W0 | ⬜ pending |
| 10-04-01 | 04 | 2 | REQ-23 | integration | `cd web && npx vitest run --reporter=verbose src/app/admin/providers` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/src/app/admin/quotas/__tests__/` — test stubs for REQ-21
- [ ] `web/src/app/admin/pricing/__tests__/` — test stubs for REQ-22
- [ ] `web/src/app/admin/providers/__tests__/` — test stubs for REQ-23
- [ ] Backend test for key_hint column addition
- [ ] Backend test for pricing physical delete behavior

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Obsidian Lens token consistency | SC-5 | Visual verification | Inspect computed styles in browser DevTools; verify --ob-* and --cv4-* vars applied |
| ProgressBar threshold colors | REQ-21 | Visual | Set quota usage to 50%, 70%, 90% and verify green/yellow/red transitions |
| Key masked display "sk-••••7a3b" | REQ-23 | Visual | Add a provider key, verify masked hint displays correctly in expanded card |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
