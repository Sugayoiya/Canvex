---
phase: 10
reviewers: [codex]
reviewed_at: 2026-04-01T18:40:00Z
plans_reviewed: [10-01-PLAN.md, 10-02-PLAN.md, 10-03-PLAN.md, 10-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 10

## Codex Review

### Plan 10-01: Backend Gaps + Frontend Foundation

#### Summary
This plan correctly targets the biggest blockers first and enables parallel page work, but it also introduces high-impact backend contract/data changes that are riskier than a typical "UI wiring" phase unless migration, compatibility, and security controls are made explicit.

#### Strengths
- Front-loads known blockers (key hint, provider key listing, pricing delete semantics).
- Creates shared frontend primitives early (`billingApi` extension, `TabBar`, `ProgressBar`) to reduce duplication in later plans.
- Dependency structure is clear: Wave 1 unblocks all Wave 2 pages.

#### Concerns
- **[HIGH]** Changing pricing DELETE to physical delete may break auditability, reporting, and existing clients expecting soft-deactivate behavior.
- **[HIGH]** Returning provider key list increases sensitive metadata exposure risk unless response is strictly minimal and access-checked.
- **[HIGH]** `key_hint` addition implies DB migration/backfill needs; plan does not specify handling existing keys.
- **[MEDIUM]** API contract changes are not versioned or compatibility-tested.
- **[MEDIUM]** No explicit migration rollback, integration tests, or regression tests called out.
- **[LOW]** Shared UI component acceptance criteria (tokens, accessibility) are not explicit.

#### Suggestions
- Keep DELETE as soft-deactivate; add explicit hard-delete endpoint only if truly needed and guarded.
- Add migration plan for `key_hint` with null-safe fallback for legacy rows.
- Limit key-list response to non-sensitive fields (`id`, `key_hint`, `created_at`, `last_used_at`).
- Add backend contract tests and frontend API client tests before Wave 2.
- Add rollout guardrails (feature flag or staged deploy) for backend behavior changes.

#### Risk Assessment
**HIGH** — foundational but touches security-sensitive and behavior-sensitive backend semantics.

---

### Plan 10-02: Quota Management Page

#### Summary
This plan is strongly aligned with REQ-21 and the locked UX decisions, but implementation packed into one page file and missing explicit stale-request/race handling will likely create maintainability and correctness issues.

#### Strengths
- Directly maps to required UX: dual tabs, debounced search, inline edit, reset, progress visualization.
- Single-expand row model reduces edit conflicts and UI complexity.
- Matches key user decisions (D-01 through D-08) closely.

#### Concerns
- **[HIGH]** All logic in one `page.tsx` risks complexity, poor testability, and regressions.
- **[MEDIUM]** Null quota ("Unlimited") and progress ratio edge cases may break thresholds/visualization.
- **[MEDIUM]** Debounced search without request cancellation can show stale results.
- **[MEDIUM]** Save/reset mutation races (double submit, tab switch during pending mutation) not addressed.
- **[LOW]** Pagination/search/tab state sync details are not explicit.

#### Suggestions
- Split into components/hooks (`QuotaList`, `QuotaRow`, `QuotaDetailArea`, query/mutation hooks).
- Use query cancellation or request versioning for debounced search.
- Define strict value rules: `null` = unlimited, `0` = hard stop; validate and clamp inputs.
- Disable actions while mutation is pending and lock single-expanded row during save.
- Add targeted tests for unlimited/reset/threshold color transitions.

#### Risk Assessment
**MEDIUM** — strong product fit, but correctness and maintainability risks need mitigation.

---

### Plan 10-03: Pricing Management Page

#### Summary
The plan is feature-complete for REQ-22 and reuses the right patterns (table + modal + confirmations), but money precision, dynamic-form correctness, and backend semantic alignment are significant risk points.

#### Strengths
- Covers required CRUD flows and status handling.
- Uses modal-based create/edit consistent with locked decisions.
- Includes filter and summary views for admin efficiency.

#### Concerns
- **[HIGH]** Price precision/rounding risk if JS `number` is used for rates.
- **[HIGH]** Dynamic fields by `pricing_model` may leak stale hidden values into submissions.
- **[MEDIUM]** Deactivate/activate semantics may conflict with DELETE behavior change from Plan 10-01.
- **[MEDIUM]** No explicit server-side pagination/sorting strategy for large pricing sets.
- **[LOW]** Unsaved-change handling in modal is not specified.

#### Suggestions
- Use schema validation (discriminated union) and clear non-applicable fields on model switch.
- Represent price as decimal-safe string or minor-unit integer end-to-end.
- Use PATCH for activation toggles; keep DELETE for explicit destructive/admin flows only.
- Ensure table supports server-side pagination/sort/filter if dataset grows.
- Add tests for model-switch field cleanup and status toggle confirmation flow.

#### Risk Assessment
**MEDIUM** — good scope fit, but correctness around money/forms needs stronger safeguards.

---

### Plan 10-04: Provider Management Page

#### Summary
This plan aligns well with REQ-23 and the chosen card-based UX, but it is the highest security-sensitive UI in this phase and needs stricter controls around key handling, isolation guarantees, and destructive operations.

#### Strengths
- Good mapping to decisions: cards, expandable key management, modal create/edit, delete confirmation.
- Clearly separated from team/personal console in intent.
- Includes operationally useful status indicators.

#### Concerns
- **[HIGH]** Key handling can leak secrets via logs, error payloads, cached responses, or toasts if not tightly controlled.
- **[HIGH]** Masked display requirement depends on `key_hint` availability; legacy keys may not render as expected.
- **[MEDIUM]** "System-only" isolation is stated but not backed by explicit route/API guard strategy.
- **[MEDIUM]** Provider delete may conflict with existing pricing/model references.
- **[LOW]** Card-list-only rendering may degrade with many providers (no pagination/virtualization noted).

#### Suggestions
- Enforce strict secret hygiene: never return plaintext keys after create, sanitize errors, avoid persistent client storage.
- Implement masked display fallback for missing hints (`sk-****`) and show metadata instead.
- Hardcode `owner_type=system` in client and enforce server-side authz checks.
- Add dependency checks before delete (or force-delete with explicit warning path).
- Invalidate and refetch provider/key queries atomically after key mutations.

#### Risk Assessment
**HIGH** — security and data-integrity surface is large despite good UX alignment.

---

## Consensus Summary

### Agreed Strengths
- Phase structure is well-organized: Wave 1 (backend + shared components) cleanly unblocks Wave 2 (parallel page implementations)
- All 3 requirements (REQ-21, REQ-22, REQ-23) are fully covered with clear plan-to-requirement mapping
- Locked user decisions (D-01 through D-22) are systematically addressed in each plan
- Reuse of Phase 09 component library (AdminDataTable, ConfirmationModal, etc.) avoids reinventing the wheel

### Agreed Concerns
1. **[HIGH] Security — key handling and sensitive data exposure** (Plans 01, 04): Returning key lists increases attack surface; secret hygiene (no plaintext in logs/toasts/cache) needs explicit rules; legacy keys without key_hint need graceful fallback
2. **[HIGH] Pricing DELETE behavior change** (Plan 01): Switching from soft-deactivate to physical delete affects auditability and could break existing consumers; needs careful consideration
3. **[HIGH] Price precision** (Plan 03): Using JavaScript `number` for financial values risks rounding errors; decimal-safe handling needed end-to-end
4. **[MEDIUM] Dynamic form field cleanup** (Plan 03): Switching pricing_model may leak stale hidden field values into submissions
5. **[MEDIUM] Mutation race conditions** (Plan 02): Double-submit, tab-switch-during-save, and stale debounced search results not addressed
6. **[MEDIUM] key_hint backfill for existing keys** (Plan 01): No migration strategy for legacy keys that lack key_hint values

### Divergent Views
- None identified — only one reviewer (Codex) in this review cycle

### Cross-Plan Verdict
Overall, the phase plan is directionally strong and likely to achieve REQ-21/22/23, but current drafts under-specify migration/testing/security controls. The biggest risk concentration is Plan 10-01 (backend behavior/data changes) and Plan 10-04 (key security). Prioritizing contract tests, migration/backfill strategy, and explicit authz/secret-handling rules will materially reduce delivery risk.
