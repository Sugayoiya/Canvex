---
phase: 04-media-tools
plan: 04
subsystem: ui
tags: [react, xyflow, zustand, canvas-nodes, material-types]

requires:
  - phase: 04-01
    provides: "NodeShell, StatusIndicator, connection-rules, CSS tokens, use-upstream-data"
provides:
  - "4 material node components (TextNode, ImageNode, VideoNode, AudioNode)"
  - "useNodeFocus hook for focus state management and panel type derivation"
  - "usePromptBuilder hook for 3-part prompt assembly"
  - "Canvas store focus state (focusedNodeId, focusedNodeType, focusedNodeHasContent)"
  - "Clean nodeTypes registry with exactly 4 entries (no legacy)"
affects: [04-05, 04-06, 04-07]

tech-stack:
  added: []
  patterns:
    - "Material node wraps NodeShell for consistent card structure"
    - "Focus state in Zustand store, derived panelType/panelDirection in hook"
    - "Prompt assembly: hidden_prompt + node text + upstream text"

key-files:
  created:
    - web/src/components/canvas/nodes/text-node.tsx
    - web/src/components/canvas/nodes/image-node.tsx
    - web/src/components/canvas/nodes/video-node.tsx
    - web/src/components/canvas/nodes/audio-node.tsx
    - web/src/components/canvas/hooks/use-node-focus.ts
    - web/src/components/canvas/hooks/use-prompt-builder.ts
  modified:
    - web/src/stores/canvas-store.ts
    - web/src/components/canvas/nodes/index.ts

key-decisions:
  - "nodeTypes has exactly 4 keys — no legacy type backward compat (per user decision)"
  - "Audio node is placeholder-only with hasContent always false"
  - "Focus state stored in Zustand canvas-store, panel logic derived in useNodeFocus hook"

patterns-established:
  - "Material node pattern: useNodeFocus + useNodeExecution + useNodePersistence inside NodeShell wrapper"
  - "Panel derivation: empty→ai-generate(below), text+content→text-toolbar(above), media+content→template-menu(above)"

requirements-completed: [REQ-07]

duration: 2min
completed: 2026-03-29
---

# Phase 04 Plan 04: Material Nodes + Focus Hooks Summary

**4 material node components (text/image/video/audio) with NodeShell wrapper, useNodeFocus for panel derivation, and usePromptBuilder for 3-part prompt assembly**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29T17:29:18Z
- **Completed:** 2026-03-29T17:31:31Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created 4 material node components using NodeShell wrapper with content/empty states and type-specific rendering
- Implemented useNodeFocus hook that derives panelType (ai-generate/text-toolbar/template-menu) and panelDirection (above/below) from focus state
- Implemented usePromptBuilder hook assembling hidden_prompt + node text + upstream text with media URL arrays
- Extended canvas-store with focusedNodeId/focusedNodeType/focusedNodeHasContent state
- Replaced legacy nodeTypes registry (5 old types) with clean 4-entry registry

## Task Commits

Each task was committed atomically:

1. **Task 1: useNodeFocus + usePromptBuilder hooks + canvas-store focus state** - `bf998f3` (feat)
2. **Task 2: 4 material node components + nodeTypes registry** - `8937d57` (feat)

## Files Created/Modified
- `web/src/components/canvas/hooks/use-node-focus.ts` - Focus state management with panelType/panelDirection derivation
- `web/src/components/canvas/hooks/use-prompt-builder.ts` - 3-part prompt assembly (hidden + node + upstream) with media arrays
- `web/src/components/canvas/nodes/text-node.tsx` - Text node with left-border accent content view and empty hints
- `web/src/components/canvas/nodes/image-node.tsx` - Image node with img preview and model/ratio footer
- `web/src/components/canvas/nodes/video-node.tsx` - Video node with video element + play overlay
- `web/src/components/canvas/nodes/audio-node.tsx` - Audio node placeholder with "音频功能即将上线"
- `web/src/stores/canvas-store.ts` - Added focus state fields and actions
- `web/src/components/canvas/nodes/index.ts` - Clean 4-entry nodeTypes (text/image/video/audio)

## Decisions Made
- nodeTypes registry contains exactly 4 entries with no legacy type mappings (per user decision "旧节点不需要了")
- Audio node is intentionally placeholder-only (hasContent=false always) — real audio support deferred
- Focus state lives in Zustand store; panel type/direction derived in useNodeFocus hook (not stored)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 material nodes render via ReactFlow without errors
- Focus infrastructure ready for floating panel components (AIGeneratePanel, TextToolbar, TemplateMenu)
- Prompt builder ready for AI generation trigger integration

## Self-Check: PASSED

---
*Phase: 04-media-tools*
*Completed: 2026-03-29*
