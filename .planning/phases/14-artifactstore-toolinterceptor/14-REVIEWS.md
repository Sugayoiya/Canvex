---
phase: 14
reviewers: [claude]
reviewed_at: 2026-04-04T12:00:00Z
plans_reviewed: [14-01-PLAN.md, 14-02-PLAN.md, 14-03-PLAN.md]
---

# Cross-AI Plan Review — Phase 14

## Claude Review

### Plan 14-01: ArtifactStore Data Layer

**Summary:** A well-structured foundation plan that creates the `AgentArtifact` model, `ArtifactStoreService`, and extends `ToolContext` with `session_id`. The design follows established project patterns (append-only storage, AsyncSessionLocal per-call, frozen dataclass contextvars) and correctly anticipates Plan 03's dependency on these contracts.

**Strengths:**
- Clean model design — UUID PK, proper FKs with cascade rules (CASCADE for session, SET NULL for execution_log), composite indexes for both lookup patterns
- Service layer pattern — Each method opens its own `AsyncSessionLocal()` matching established convention
- Summary templates — Per-skill template approach with truncation fallback is pragmatic and LLM-friendly
- Backward compatibility — `session_id: str | None = None` allows gradual rollout
- Test coverage planning — 6+ tests covering model, service, and context propagation

**Concerns:**
- **MEDIUM:** Missing `reset_tool_context` function declaration — Plan 03 depends on this for context restoration
- **MEDIUM:** No migration strategy for existing sessions — should document behavior when `session_id=None`
- **LOW:** Summary template coverage — only 7 templates for 17 tools (fallback is acceptable)

**Risk Assessment: LOW**

---

### Plan 14-02: Celery AI Generation Tasks

**Summary:** A solid plan for offloading long-running AI generation to Celery with proper retry semantics, execution logging, and in-tool polling. The async-to-sync bridge pattern matches existing `skill_task.py` convention.

**Strengths:**
- Retry configuration — max_retries=2, exponential countdown, acks_late=True correctly implements D-17/D-19
- Execution log integration — Creating/updating SkillExecutionLog entries per D-21
- Key health reporting — Properly reports success/error to KeyHealthManager
- Polling with exponential backoff — event-loop-friendly with asyncio.sleep

**Concerns:**
- **HIGH:** Potential event loop conflict in nested async calls — Celery worker runs sync, internal providers run async
- **MEDIUM:** No timeout on provider calls inside _async_generate_* functions — could hang indefinitely
- **MEDIUM:** Task ID pre-assignment — log created inside task, no pre-execution trace on creation failure
- **LOW:** Queue routing hardcoded — acceptable for Phase 14 but not dynamic

**Suggestions:**
- Add `asyncio.wait_for()` with configurable timeout inside `_async_generate_*` functions
- Consider pre-assigning task IDs via `uuid4()` before `apply_async()`

**Risk Assessment: MEDIUM**

---

### Plan 14-03: ToolInterceptor + Integration

**Summary:** The most complex and critical plan, implementing StructuredTool wrappers with before/after hooks. The contextvars-based injection is architecturally correct, and the two-pass wrapping pattern solves the recursive backfill visibility problem.

**Strengths:**
- Contextvars injection pattern — Storing `injected_artifacts` on `ToolContext` via `dataclasses.replace()` avoids TypeError on Pydantic args_schema
- Two-pass wrapping — Shared mutable `wrapped_ref` list ensures backfill finds wrapped tools
- Sentinel for double-wrapping — Prevents duplicate hooks on hot reload
- Recursive backfill with depth limit — MAX_BACKFILL_DEPTH=3 prevents infinite recursion
- Graceful degradation — Hooks skip when `session_id=None`
- Comprehensive test coverage — 10+ tests

**Concerns:**
- **HIGH:** Backfill `ainvoke({})` with empty dict — Tools with required parameters will fail; only tools with all-optional params can be backfilled
- **MEDIUM:** `payload.pop("log_id", None)` mutates the result — intentional but should be documented
- **MEDIUM:** Read-only tools skipping after-hook — D-10 says "全部 17 个 @tool 统一包装" but current implementation only skips on error, no explicit read-only handling
- **MEDIUM:** Error message language inconsistency — Chinese/English mixing in LLM-facing messages
- **LOW:** `_find_tool_by_kind` O(n²) lookup — negligible with 17 tools

**Suggestions:**
- Add `_can_backfill_without_input()` check or derive default params from ToolContext
- Add `produces_artifact: bool` to TOOL_METADATA for explicit read-only handling
- Standardize error messages to Chinese for LLM-facing output

**Risk Assessment: MEDIUM-HIGH**

---

### Cross-Plan Data Contract Consistency

| Contract | Plan 01 | Plan 02 | Plan 03 | Consistent? |
|----------|---------|---------|---------|-------------|
| `session_id` on ToolContext | Adds field | — | Uses field | ✅ |
| `log_id` in Celery result | — | Returns `{"log_id": ...}` | Extracts via `payload.pop()` | ✅ |
| `generate_summary()` | Defines function | — | Uses function | ✅ |
| `ArtifactStoreService.save()` | Defines signature | — | Calls same params | ✅ |
| `get_tool_context().session_id` | Extended | — | Relied upon | ✅ |

**Verdict:** Cross-plan contracts are consistent and well-coordinated.

---

## Consensus Summary

### Agreed Strengths
- Architecture cleanly separated: data layer (01) / async execution (02) / interception logic (03)
- Established project patterns followed throughout (AsyncSessionLocal, frozen dataclass, Celery task patterns)
- Cross-plan data contracts consistent
- Reversibility: setting `session_id=None` disables all hooks gracefully
- Two-pass wrapping pattern correctly solves recursive backfill visibility problem

### Agreed Concerns
1. **Backfill parameter derivation (HIGH)** — Tools with required params cannot be backfilled with empty `ainvoke({})`; needs explicit handling
2. **Async event loop interactions in Celery (MEDIUM)** — Provider calls inside Celery tasks need explicit timeout wrappers
3. **Read-only tool handling ambiguity (MEDIUM)** — "No meaningful payload" needs explicit criteria, not just error-key check

### Divergent Views
N/A (single reviewer)

### Recommended Pre-Execution Changes
1. **Plan 14-02:** Add `asyncio.wait_for()` timeout inside `_async_generate_*` functions
2. **Plan 14-03:** Add `_can_backfill_without_input()` check or explicit backfill parameter derivation
3. **Plan 14-03:** Add `produces_artifact` metadata flag for read-only tool after-hook skipping

### Final Verdict

| Plan | Risk | Recommendation |
|------|------|----------------|
| 14-01 | LOW | Approve |
| 14-02 | MEDIUM | Approve with minor revisions |
| 14-03 | MEDIUM-HIGH | Approve with revisions |

**Overall Phase Risk: MEDIUM**

---

*Reviewed by: Claude Code 2.1.91*
*Reviewed at: 2026-04-04*
