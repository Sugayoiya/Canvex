# Retrospective: Canvas Studio

## Milestone: v2.0 — Skill + Celery Refactor

**Shipped:** 2026-03-30
**Phases:** 7 (incl. 3.1 inserted) | **Plans:** 39

### What Was Built
- SkillRegistry/Descriptor/Executor + Celery async backbone (13 business skills)
- 4 material-type canvas nodes with focus-panel interaction and asset library
- PydanticAI agent with SSE chat sidebar, pipeline orchestration, and context tools
- Fail-closed quota enforcement (UserQuota/TeamQuota) with atomic locks
- Recharts billing dashboard with KPI cards and UTC-normalized time-series
- Multi-tenant collaboration: Team/Group RBAC, Google/GitHub OAuth
- DB-backed ProviderManager with Fernet encryption and round-robin KeyRotator
- Obsidian Lens design system across all pages

### What Worked
- **Skill abstraction**: Single SkillRegistry backbone for canvas nodes + agent tools eliminated duplication
- **Wave-based plan parallelization**: Backend (W1) + frontend (W2-W3) kept dependencies clean
- **Inserted Phase 03.1**: Catching 12 quality issues early prevented compounding bugs in later phases
- **39-test acceptance gate (02-09)**: Verified all Phase 02 deliverables before advancing

### What Was Inefficient
- **Phase 01 had no formal plans**: Foundation was done ad-hoc, making it harder to trace
- **v2.0 not formally archived**: No MILESTONES.md entry or archive created at completion time
- **Audio node deferred**: Placeholder-only audio node created debt carried into all subsequent phases

### Patterns Established
- Category__skill double-underscore namespacing for collision-free tool names
- 7-state node execution machine (idle/queued/running/completed/failed/timeout/blocked)
- Fail-closed quota with idempotent usage tracking by skill_execution_id
- Obsidian Lens --ob-* tokens + --cv4-* canvas-specific tokens coexistence
- Partial degradation pattern: return valid items + warnings instead of full failure

### Key Lessons
- **Insert bugfix phases early**: Phase 03.1 prevented cascading quality issues
- **Acceptance test gates work**: Phase 02-09's 39-test suite caught integration gaps
- **Design system investment pays off**: Obsidian Lens tokens accelerated all frontend phases

---

## Milestone: v2.1 — Admin Console

**Shipped:** 2026-04-02
**Phases:** 5 | **Plans:** 17 | **Commits:** 107

### What Was Built
- Append-only AdminAuditLog with JSON change tracking and typed admin response schemas
- User management API + UI: paginated TanStack Table with status/admin toggles, safeguards
- Quota management: dual-tab user/team editor with ProgressBar and inline editing
- Pricing management: full CRUD table with dynamic form, string-precision price handling
- System AI Provider management: card-based UI with masked key display and lifecycle controls
- 4-tab monitoring page (Tasks / AI Calls / Skills / Usage & Cost) with shared useAdminLogTable hook
- Actionable KPI dashboard with click-to-navigate, alert badges, and graceful degradation
- AdminErrorBoundary wrapping all 7 admin pages with verified loading/error/empty state matrix

### What Worked
- **GSD workflow with cross-AI reviews**: Phase plans reviewed by external AI before execution consistently caught edge cases and improved design decisions (pricing soft-delete, fail-silent alerts, reusable hook patterns)
- **UI-SPEC before implementation**: Design contracts for frontend phases (08-11) prevented rework and ensured Obsidian Lens consistency
- **Reusable component extraction**: AdminDataTable/FilterToolbar/TabBar patterns from Phase 09 accelerated Phases 10-11
- **Shared hooks pattern**: useAdminLogTable eliminated duplication across 3 log tab components
- **Wave-based parallelization**: Backend + frontend infra (W1) before feature pages (W2-W3) kept dependencies clean

### What Was Inefficient
- **Traceability table not updated**: REQUIREMENTS.md traceability stayed "Planned" even after phases completed — manual sync overhead
- **Phase 08 was thin**: Only 2 plans for the frontend shell; could have been merged with Phase 09 to reduce overhead
- **Design spec iteration**: Phase 10 needed post-implementation design fixes (Pencil design didn't match implementation) — better to validate before execution

### Patterns Established
- AdminShell as independent layout (not extending AppShell) — clean admin visual isolation
- Sonner toast + Obsidian Lens theming for all admin feedback
- Composite DB indexes for count queries (SkillExecutionLog status+queued_at)
- AdminErrorBoundary with setState remount strategy and onReset query invalidation
- Lazy tab mount via conditional rendering — only active tab triggers data fetch

### Key Lessons
- **Start with reusable components**: The investment in AdminDataTable/FilterToolbar/ProgressBar in Phase 09 paid off 3x in Phases 10-11
- **Soft-delete over hard-delete**: Pricing soft-deactivate pattern preserves audit trail integrity
- **Fail-silent for non-critical features**: Dashboard alert badges gracefully degrade when API errors occur
- **Cross-DB portability matters**: CASE WHEN aggregation, nullslast(), dict.setdefault patterns needed for SQLite+PG dual support

### Cost Observations
- 5 phases completed in ~2 calendar days (aggressive velocity)
- Admin console is a complete vertical — API + UI + monitoring + polish
- Heavy use of code generation with human review checkpoints

---

## Cross-Milestone Trends

| Metric | v2.0 | v2.1 |
|--------|------|------|
| Phases | 7 (incl. 3.1) | 5 |
| Plans | 39 | 17 |
| Timeline | 4 days | 2 days |
| Code changes | ~90K LOC | +10.5K LOC |
| Key pattern | SkillRegistry backbone | Reusable admin components |

---
*Last updated: 2026-04-02*
