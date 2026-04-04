---
phase: 14-artifactstore-toolinterceptor
plan: 03
subsystem: agent-backend
tags: [tool-interceptor, artifact-injection, before-after-hooks, recursive-backfill, pipeline-flow]

requires:
  - phase: 14-01
    provides: ArtifactStoreService, ToolContext session_id, set_tool_context_obj, reset_tool_context
  - phase: 14-02
    provides: Celery AI generation tasks, refactored ai_tools with apply_async
provides:
  - wrap_tool_with_interceptor() — StructuredTool wrapper with before/after artifact hooks
  - Before-hook dependency injection via ToolContext.injected_artifacts contextvars
  - After-hook artifact persistence with summary+artifact_id return to LLM
  - Recursive backfill with _can_backfill_without_input safety gate (max depth 3)
  - produces_artifact metadata flag for read-only/meta tool skip
  - System prompt ArtifactStore data flow guidance
  - Pipeline chain auto-injection via ArtifactStore
affects: [agent-chat, canvas-execution, pipeline-skills, future-skill-development]

tech-stack:
  added: []
  patterns: [before-after-hook-interceptor, contextvars-artifact-injection, two-pass-tool-wrapping, produces_artifact-gating]

key-files:
  created:
    - api/app/agent/tool_interceptor.py
    - api/tests/test_tool_interceptor.py
  modified:
    - api/app/agent/tool_context.py
    - api/app/agent/tools/__init__.py
    - api/app/agent/context_builder.py

key-decisions:
  - "Before-hook injects via ToolContext.injected_artifacts contextvars, not kwargs — tool functions have fixed Pydantic schemas that reject unexpected args"
  - "Two-pass wrapping with shared mutable wrapped_ref list ensures recursive backfill finds wrapped (not raw) tools"
  - "_can_backfill_without_input() inspects args_schema.model_fields — tools with required params raise RuntimeError instead of silent failure"
  - "9 read-only/meta tools have produces_artifact=False — after-hook skips storage entirely for query/meta tools"

patterns-established:
  - "ToolInterceptor wrapper pattern: wrap_tool_with_interceptor(tool, metadata, all_tools) for uniform before/after hooks"
  - "Two-pass wrapping: shared mutable list reference for safe recursive backfill resolution"
  - "produces_artifact metadata flag to control after-hook storage per tool"

requirements-completed: [ARTS-03, ARTS-04, ARTS-05, PIPE-03]

duration: 3min
completed: 2026-04-04
---

# Phase 14 Plan 03: ToolInterceptor + Artifact Auto-Injection Summary

**ToolInterceptor before/after hooks wrapping all 17 tools — auto-inject upstream artifacts via contextvars, auto-persist results to ArtifactStore with summary return, recursive backfill with safety gate**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-04T04:50:43Z
- **Completed:** 2026-04-04T04:54:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ToolInterceptor wraps all 17 tools uniformly with before/after artifact hooks
- Before-hook resolves upstream dependencies from ArtifactStore, injects via ToolContext.injected_artifacts (contextvars)
- After-hook persists tool results to ArtifactStore, returns `{"summary", "artifact_id"}` to LLM (≤500 char summary)
- Recursive backfill with `_can_backfill_without_input()` safety gate (max depth 3) — tools with required params raise RuntimeError
- 9 read-only/meta tools (get_*, read_*) skip after-hook via `produces_artifact=False`
- System prompt tells LLM about automated data flow between tools
- 19 tests covering all interceptor mechanics

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ToolInterceptor Module + Extend ToolContext** - `41d4777` (feat)
2. **Task 2: Integrate Interceptor + Update System Prompt + Tests** - `fe155d8` (feat)

## Files Created/Modified
- `api/app/agent/tool_interceptor.py` — ToolInterceptor with wrap_tool_with_interceptor(), before/after hooks, recursive backfill, _can_backfill_without_input safety gate
- `api/app/agent/tool_context.py` — Added `injected_artifacts: dict | None = None` field to ToolContext dataclass
- `api/app/agent/tools/__init__.py` — Two-pass wrapping in get_all_tools(), `produces_artifact: False` on 9 read-only/meta tools
- `api/app/agent/context_builder.py` — System prompt updated with 数据传递 (automatic data flow) section
- `api/tests/test_tool_interceptor.py` — 19 tests: double-wrap prevention, parse, after-hook persist/skip/log_id, before-hook inject, no-session skip, system prompt, all-tools wrapped, two-pass, backfill safety, produces_artifact, metadata flags

## Decisions Made
- Before-hook injects via `ToolContext.injected_artifacts` contextvars (not kwargs) because tool functions have fixed Pydantic-based `args_schema` signatures that reject unexpected keyword arguments
- Two-pass wrapping pattern: shared mutable `wrapped_ref` list populated after comprehension — at invocation time `_find_tool_by_kind()` finds wrapped tools (with after-hooks), not raw originals
- `_can_backfill_without_input()` inspects `args_schema.model_fields` — tools with required params (e.g. `generate_image` needs `prompt`) cannot be auto-backfilled; raises RuntimeError telling LLM to execute prerequisite manually
- 9 read-only/meta tools (`get_project_info`, `get_episodes`, `get_characters`, `get_scenes`, `get_script`, `get_canvas_state`, `get_style_templates`, `read_skill`, `read_resource`) have `produces_artifact=False` — after-hook skips storage entirely

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test mock patch paths for deferred imports**
- **Found during:** Task 2 (test execution)
- **Issue:** Tests patched `app.agent.tool_interceptor.get_tool_context` but the interceptor uses deferred imports (`from app.agent.tool_context import get_tool_context` inside the function), so the module-level attribute didn't exist
- **Fix:** Changed all test patches to target the source module: `app.agent.tool_context.get_tool_context`, `app.agent.tool_context.set_tool_context_obj`, `app.agent.tool_context.reset_tool_context`
- **Files modified:** `api/tests/test_tool_interceptor.py`
- **Committed in:** `fe155d8` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed test_before_hook using MagicMock instead of real ToolContext**
- **Found during:** Task 2 (test execution)
- **Issue:** `dataclasses.replace()` requires a real dataclass instance but test used `MagicMock(session_id="sess-2")`
- **Fix:** Changed to real `ToolContext(project_id="p1", user_id="u1", session_id="sess-2")`
- **Files modified:** `api/tests/test_tool_interceptor.py`
- **Committed in:** `fe155d8` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs in test code)
**Impact on plan:** Both auto-fixes necessary for test correctness. No scope creep.

## Issues Encountered
- Pre-existing JSONB/SQLite issue in `test_admin_alerts.py` (from Plan 01 `agent_artifacts` JSONB column) — not caused by this plan, out of scope

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 14 all 3 plans complete — ArtifactStore + Celery offload + ToolInterceptor fully integrated
- All 17 tools wrapped with interceptor, pipeline chains flow through ArtifactStore
- Ready for Phase 15+ (SkillDescriptor enhancement, pipeline skill development)

## Self-Check: PASSED

---
*Phase: 14-artifactstore-toolinterceptor*
*Completed: 2026-04-04*
