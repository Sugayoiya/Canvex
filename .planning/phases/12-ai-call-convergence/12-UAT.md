---
status: testing
phase: 12-ai-call-convergence
source:
  - 12-01-SUMMARY.md
  - 12-02-SUMMARY.md
  - 12-03-SUMMARY.md
  - 12-04-SUMMARY.md
started: 2026-04-02T12:00:00Z
updated: 2026-04-02T13:30:00Z
---

## Current Test

number: 6
name: Product — AI call still succeeds (convergence)
expected: |
  In the main app (not admin), trigger one AI action that uses DB-backed keys: e.g. agent chat, an LLM skill, or image/video generation. It should complete without "missing API key" / credential errors in the UI or network tab.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Fresh API start succeeds; no startup crash; optional verification on API base URL — `GET /health` and `/docs` (e.g. `http://localhost:8000/health`, `http://localhost:8000/docs`), not under `/api/v1/`.
result: pass
note: Prior checkpoint wrongly cited `/api/v1/health` (404). FastAPI mounts health at app root `/health` and docs at `/docs`; use backend port (8000), not the Next.js port (3000).

### 2. Admin provider cards — health badges and expand
expected: On `/admin/providers` (or your admin providers route), expanding a provider shows per-key rows with health badges (green/yellow/red per policy). Batch health loads without N+1 visible breakage (single load or 60s refresh acceptable).
result: pass

### 3. Admin — toggle key and reset errors
expected: Toggle a key active/inactive persists after refresh; "Reset errors" (or equivalent) clears error count as shown in UI.
result: pass

### 4. Admin — error history and 24h usage sparkline
expected: Expanded key detail shows error history list and 24-bar usage sparkline; empty states acceptable if no data.
result: pass
note: User had just reset errors in prior step — error history empty; acceptable per UAT. Sparkline/empty UI still validates layout.

### 5. Admin — accessibility spot-check
expected: Toggle has `role="switch"` (or native switch); sparkline has `role="img"` and label; expandable region has sensible `aria-expanded` / labels.
result: pass
note: User-supplied DOM — provider header role=button aria-expanded; key toggle role=switch aria-checked aria-label; health span aria-label; reset aria-label. Sparkline role=img per implementation when key row expanded (not in snippet).

### 6. Product — AI call still succeeds (convergence)
expected: From the app UI, run one flow that hits the unified provider path (e.g. an LLM skill, agent chat, or image generation you use in dev). Request completes without credential/env-key errors in UI or obvious API failure.
result: [pending]

## Summary

total: 6
passed: 5
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

[none yet]
