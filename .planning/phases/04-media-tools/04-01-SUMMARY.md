---
phase: 04-media-tools
plan: 01
subsystem: ui
tags: [css-tokens, design-system, xyflow, canvas, material-types, migration]

requires:
  - phase: 02-skills-canvas
    provides: Canvas workspace + node types + connection rules baseline
  - phase: 03.1-agent-chat-canvas-fix
    provides: useUpstreamData hook with text/json/imageUrl aggregation
provides:
  - "--cv4-* CSS custom property system for dark/light canvas themes"
  - "Material-type connection rules (4 types: text/image/video/audio)"
  - "NodeShell shared card container for all node types"
  - "StatusIndicator 7-state execution status display"
  - "Enhanced useUpstreamData with videoUrl/audioUrl"
  - "DB migration script for old→new node_type values"
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07]

tech-stack:
  added: []
  patterns:
    - "CSS custom properties under --cv4-* namespace for canvas theming"
    - "Material-type node system (text/image/video/audio) replacing legacy types"
    - "Shared NodeShell component pattern for consistent node card rendering"

key-files:
  created:
    - web/src/components/canvas/nodes/shared/node-shell.tsx
    - web/src/components/canvas/nodes/shared/status-indicator.tsx
    - api/scripts/migrate_node_types.py
  modified:
    - web/src/app/globals.css
    - web/src/lib/connection-rules.ts
    - web/src/components/canvas/canvas-workspace.tsx
    - web/src/components/canvas/hooks/use-upstream-data.ts
    - api/app/schemas/canvas.py

key-decisions:
  - "4 material types only (text/image/video/audio) — no legacy type compatibility in connection rules"
  - "CSS custom properties over Tailwind theme extension for canvas tokens"
  - "toFlowNode extracts config.text/config.prompt into data top-level for direct node access"

patterns-established:
  - "NodeShell pattern: shared card container with Handle, header (icon+label+status), children slot"
  - "--cv4-* token naming: prefix all Phase 04 canvas CSS variables with cv4"

requirements-completed: [REQ-07]

duration: 3min
completed: 2026-03-29
---

# Phase 04 Plan 01: Infrastructure Foundation Summary

**CSS design tokens (30+ --cv4-* vars, dual theme), connection rules rewritten for 4 material types, NodeShell/StatusIndicator shared primitives, useUpstreamData with video/audio, DB migration script**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-29T17:23:17Z
- **Completed:** 2026-03-29T17:26:16Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- 30+ CSS custom properties (`--cv4-*`) for dark and light themes covering surfaces, text, borders, shadows, and radii
- Connection rules rewritten from 5 legacy types to 4 material types with `getCompatibleTargetTypes` helper
- `toFlowNode` bug fixed — now extracts `config.text` and `config.prompt` into `data` top-level fields
- NodeShell shared card container referencing cv4 tokens with Handle integration
- StatusIndicator with 7 execution states (idle/queued/running/completed/failed/timeout/blocked)
- `useUpstreamData` enhanced with `videoUrl[]` and `audioUrl[]` fields
- DB migration script covering all 10 old→new type mappings

## Task Commits

Each task was committed atomically:

1. **Task 1: CSS design tokens + connection rules rewrite + toFlowNode bug fix** - `45d0532` (feat)
2. **Task 2: NodeShell + StatusIndicator + useUpstreamData + DB migration script** - `30944ef` (feat)

## Files Created/Modified
- `web/src/app/globals.css` — Added --cv4-* CSS custom properties for dual-theme canvas system
- `web/src/lib/connection-rules.ts` — Rewritten with 4 material types (text/image/video/audio), exports getCompatibleTargetTypes
- `web/src/components/canvas/canvas-workspace.tsx` — Updated NODE_LABELS to material types, fixed toFlowNode data extraction
- `api/app/schemas/canvas.py` — VALID_NODE_TYPES updated to material types
- `web/src/components/canvas/nodes/shared/node-shell.tsx` — Shared card container with cv4 token references
- `web/src/components/canvas/nodes/shared/status-indicator.tsx` — 7-state execution status indicator
- `web/src/components/canvas/hooks/use-upstream-data.ts` — Added videoUrl/audioUrl to UpstreamData interface
- `api/scripts/migrate_node_types.py` — One-time migration for 10 old→new node type mappings

## Decisions Made
- Used 4 material types only (text/image/video/audio) — no backward compat in connection rules per user decision "旧节点不需要了"
- CSS custom properties under `--cv4-*` namespace rather than Tailwind theme extension
- `toFlowNode` extracts `config.text` and `config.prompt` into data top-level for direct node component access

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added result fields to BackendNode interface**
- **Found during:** Task 1 (toFlowNode enhancement)
- **Issue:** toFlowNode references `n.result_text`, `n.result_url`, `n.error_message` but BackendNode interface didn't declare them
- **Fix:** Added `result_text?: string`, `result_url?: string`, `error_message?: string` to BackendNode interface
- **Files modified:** web/src/components/canvas/canvas-workspace.tsx
- **Verification:** TypeScript compilation passes cleanly
- **Committed in:** 45d0532 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for TypeScript correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All cv4 design tokens available for subsequent plans to reference via `var(--cv4-*)`
- Connection rules ready for node creation and validation
- NodeShell and StatusIndicator ready for TextNode/ImageNode/VideoNode/AudioNode implementation in Plan 02+
- Migration script available for converting existing DB data when deploying

## Self-Check: PASSED

All 8 files verified present. Both task commits (45d0532, 30944ef) verified in git log.

---
*Phase: 04-media-tools*
*Completed: 2026-03-29*
