---
phase: 05-interaction-video
plan: 01
subsystem: api
tags: [topological-sort, batch-execution, billing, time-series, task-monitoring, cors]

requires:
  - phase: 04-media-tools
    provides: "Canvas CRUD, SkillExecutionLog, AICallLog models"
  - phase: 02-skills-canvas
    provides: "Skill registry, billing pricing, base canvas endpoints"
provides:
  - "Batch graph execution with DB-backed state and Kahn's algorithm topological sort"
  - "Time-series billing aggregation with dual SQLite/PostgreSQL date grouping"
  - "Task monitoring list with admin visibility and pagination"
  - "Node execution history with project-level authorization"
  - "CORS expose_headers for X-Total-Count pagination header"
affects: [05-interaction-video]

tech-stack:
  added: []
  patterns:
    - "Kahn's algorithm BFS for DAG layer computation"
    - "Dual SQLite/PostgreSQL date grouping (strftime vs date_trunc)"
    - "UTC normalization at query boundary for time-series"
    - "X-Total-Count response header for pagination"
    - "JSONResponse for custom header injection on list endpoints"

key-files:
  created:
    - api/app/services/graph_execution_service.py
    - api/app/models/batch_execution.py
  modified:
    - api/app/api/v1/canvas.py
    - api/app/schemas/canvas.py
    - api/app/api/v1/billing.py
    - api/app/schemas/billing.py
    - api/app/api/v1/logs.py
    - api/app/main.py
    - api/app/models/__init__.py

key-decisions:
  - "DB-backed BatchExecution model replaces in-memory _batch_store for restart survivability"
  - "Orphan nodes (no edges) placed in layer 0 of topological sort"
  - "Terminal status transitions blocked with 409 Conflict"
  - "UTC normalization at query boundary — strip tzinfo from aware datetimes"
  - "JSONResponse used for list_tasks to inject X-Total-Count header"

patterns-established:
  - "Batch status validation: VALID_BATCH_STATUSES/TERMINAL_STATUSES constants"
  - "Dual DB date grouping: settings.USE_SQLITE branch for SQLite strftime vs PG date_trunc"
  - "Admin visibility pattern: is_admin sees all, non-admin scoped to own user_id"

requirements-completed: [REQ-09, REQ-10]

duration: 3min
completed: 2026-03-30
---

# Phase 05 Plan 01: Backend APIs for Batch Execution, Billing Time-Series, and Task Monitoring

**Kahn's algorithm batch graph execution with DB-backed state, UTC-normalized time-series billing, paginated task monitoring with admin visibility, and node execution history with project authz**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T06:56:06Z
- **Completed:** 2026-03-30T06:59:29Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Batch graph execution with topological sort handling cycles (structured errors), orphan nodes, and deterministic layer ordering
- DB-backed BatchExecution model replacing in-memory store for restart survivability
- Time-series billing aggregation with dual SQLite/PostgreSQL date grouping and UTC normalization
- Task monitoring with admin visibility, pagination, X-Total-Count header, and status counts
- Node execution history with project-level authorization check
- CORS expose_headers for X-Total-Count pagination header

## Task Commits

Each task was committed atomically:

1. **Task 1: Graph Execution Service + DB-Backed Batch Model + Batch Endpoints + CORS Fix** - `26a7daf` (feat)
2. **Task 2: Time-Series Billing API + Task Monitoring Endpoints + Node History** - `46eec43` (feat)

## Files Created/Modified
- `api/app/services/graph_execution_service.py` - Topological sort + BatchExecutionService with start/status/update
- `api/app/models/batch_execution.py` - DB-backed batch state model
- `api/app/schemas/canvas.py` - BatchExecuteRequest/Response/StatusResponse/NodeUpdateRequest
- `api/app/api/v1/canvas.py` - POST batch-execute, GET batch status, PATCH node status endpoints
- `api/app/main.py` - CORS expose_headers=["X-Total-Count"]
- `api/app/models/__init__.py` - Register BatchExecution model
- `api/app/schemas/billing.py` - TimeSeriesPoint/TimeSeriesResponse schemas
- `api/app/api/v1/billing.py` - GET /usage-timeseries/ with dual SQLite/PG date grouping
- `api/app/api/v1/logs.py` - GET /tasks, /tasks/counts, /node-history/{node_id}

## Decisions Made
- DB-backed BatchExecution model replaces in-memory _batch_store — survives restarts, works across workers
- Orphan nodes (no edges in subgraph) placed in layer 0 for deterministic batch ordering
- Terminal statuses (completed/failed/blocked/timeout) block further transitions with 409 Conflict
- UTC normalization at query boundary for time-series — strip tzinfo from aware datetimes before DB query
- JSONResponse used for list_tasks to inject custom X-Total-Count header alongside JSON body
- cast(date_trunc(...), String) for PostgreSQL to match SQLite strftime string output

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- All 4 backend endpoint groups ready for frontend consumption in Plans 04/05/06
- Batch execution service importable for canvas workflow orchestration
- CORS X-Total-Count exposure enables frontend pagination header access

---
*Phase: 05-interaction-video*
*Completed: 2026-03-30*
