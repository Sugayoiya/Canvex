---
phase: 08
slug: admin-frontend-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected — no vitest/jest config in `web/` |
| **Config file** | none — no test runner installed |
| **Quick run command** | `npm run build` (TypeScript compilation as smoke test) |
| **Full suite command** | N/A — all validation is manual/visual + TypeScript compilation |
| **Estimated runtime** | ~30 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` (TypeScript compilation)
- **After every plan wave:** Visual verification of admin shell rendering
- **Before `/gsd-verify-work`:** Manual UAT against all 7 success criteria
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | REQ-18 | smoke | `cd web && npm ls @tanstack/react-table sonner` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | REQ-18 | smoke | `cd web && npx tsc --noEmit` | ❌ | ⬜ pending |
| 08-02-01 | 02 | 1 | REQ-17 | manual | Navigate to `/admin` as non-admin → redirect to `/projects` | N/A | ⬜ pending |
| 08-02-02 | 02 | 1 | REQ-17 | manual | AdminShell layout renders (sidebar + topbar + main) | N/A | ⬜ pending |
| 08-02-03 | 02 | 1 | REQ-17 | manual | `/auth/me` called on admin entry (Network tab) | N/A | ⬜ pending |
| 08-03-01 | 03 | 1 | REQ-17 | manual | Code splitting — admin JS not loaded on `/projects` (Network tab) | N/A | ⬜ pending |
| 08-03-02 | 03 | 1 | REQ-18 | manual | Sidebar shows "Admin Console" for admin user, hidden for non-admin | N/A | ⬜ pending |
| 08-03-03 | 03 | 1 | REQ-18 | manual | Sonner Toaster renders in admin layout (DOM inspection) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `@tanstack/react-table` and `sonner` installed via npm
- [ ] `--cv4-btn-secondary-border` token added to `globals.css`
- [ ] Manrope font weight `700` added to `app/layout.tsx`

*No frontend test framework setup — this phase is pure scaffolding with no business logic to unit-test. TypeScript compilation serves as automated verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AdminGuard blocks non-admin | REQ-17 | Requires browser session + user role | Login as non-admin, navigate to `/admin`, verify redirect to `/projects` |
| AdminShell layout renders correctly | REQ-17 | Visual layout verification | Login as admin, navigate to `/admin`, verify sidebar + topbar + main content |
| Code splitting isolation | REQ-17 | Requires Network tab inspection | Navigate to `/projects`, verify no admin JS chunks loaded |
| `/auth/me` re-validation | REQ-17 | Requires Network tab inspection | Navigate to `/admin`, verify `/auth/me` call in Network tab |
| Sidebar Admin Console entry | REQ-18 | Requires user role check | Login as admin, verify "Admin Console" link in sidebar; login as non-admin, verify absence |
| Sonner Toaster theming | REQ-18 | Visual theming verification | Navigate to admin, trigger a toast, verify Obsidian Lens styling |
| Placeholder pages render | REQ-17 | Visual verification per page | Navigate to each `/admin/*` route, verify title + empty state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
