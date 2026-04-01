# Retrospective: Canvas Studio

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
