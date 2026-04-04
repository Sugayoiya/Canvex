---
phase: 14-artifactstore-toolinterceptor
plan: 02
subsystem: ai-generation-pipeline
tags: [celery, ai-tools, retry, polling, image-generation, video-generation]
dependency_graph:
  requires: [celery_app, provider_manager, key_health, tool_context, skill_execution_log]
  provides: [generate_image_task, generate_video_task, celery_offload_polling]
  affects: [ai_tools, celery_app_config]
tech_stack:
  added: []
  patterns: [celery-apply-async, exponential-backoff-polling, asyncio-wait-for-timeout]
key_files:
  created:
    - api/app/tasks/ai_generation_task.py
    - api/tests/test_celery_generation.py
  modified:
    - api/app/celery_app.py
    - api/app/agent/tools/ai_tools.py
decisions:
  - "110s image / 280s video provider timeout inside Celery tasks (buffer below 600s soft limit)"
  - "Exponential backoff polling in @tool: 1s→2s→4s→8s cap for non-blocking event loop"
  - "SkillExecutionLog created before execution, updated after — consistent with existing skill_task pattern"
metrics:
  duration: 3min
  completed: "2026-04-04"
  tasks: 2
  files: 4
---

# Phase 14 Plan 02: Celery AI Generation Tasks + Tool Offload Summary

**One-liner:** Celery tasks with retry/acks_late for image/video generation, @tool wrappers offload via apply_async + exponential backoff polling.

## What Was Done

### Task 1: Create Celery AI Generation Tasks
- Created `api/app/tasks/ai_generation_task.py` with two Celery tasks:
  - `generate_image_task`: `max_retries=2`, `acks_late=True`, exponential retry countdown (30s → 60s)
  - `generate_video_task`: `max_retries=2`, `acks_late=True`, exponential retry countdown (30s → 60s)
- Both tasks use `_get_or_create_event_loop()` + `loop.run_until_complete()` for async provider calls
- Provider calls wrapped with `asyncio.wait_for()`: 110s for image, 280s for video
- Both tasks create/update `SkillExecutionLog` entries (per D-21) before/after execution
- `KeyHealthManager.report_success/report_error` called on all outcomes
- Registered `"app.tasks.ai_generation_task"` in `celery_app.conf.include`
- Added task routes: image→`ai_generation` queue, video→`media_processing` queue
- **Commit:** `88c6d12`

### Task 2: Refactor ai_tools.py for Celery Offload + Tests
- Replaced inline `asyncio.wait_for(provider.generate_image(...))` with `generate_image_task.apply_async()` + polling
- Replaced inline `asyncio.wait_for(provider.generate_video(...))` with `generate_video_task.apply_async()` + polling
- Added `_poll_celery_result()` helper with exponential backoff (1s→2s→4s→8s cap)
- @tool functions remain `async def` using `asyncio.sleep()` for non-blocking polling
- Created 9 tests covering:
  - Polling success/timeout/failure scenarios
  - Task decorator config verification (acks_late, max_retries)
  - Source inspection for `apply_async` usage
  - `asyncio.wait_for` presence in Celery task async helpers
  - Timeout constant values (110/280)
- All 9 tests pass
- **Commit:** `84ab491`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed mock side_effect exhaustion in test**
- **Found during:** Task 2 test execution
- **Issue:** `mock_result.ready.side_effect = [False, True]` only had 2 values but `ready()` is called 3 times (once in loop, once to break, once after loop)
- **Fix:** Changed to `[False, True, True]` to cover all call sites
- **Files modified:** `api/tests/test_celery_generation.py`
- **Commit:** included in `84ab491`

## Verification Results

```
✅ generate_image_task importable with name "app.tasks.ai_generation_task.generate_image_task", max_retries=2
✅ generate_video_task importable with name "app.tasks.ai_generation_task.generate_video_task", max_retries=2
✅ ai_tools.py generate_image source contains "apply_async"
✅ 9/9 tests pass in test_celery_generation.py
```

## Known Stubs

None — all data paths are fully wired.

## Self-Check: PASSED
