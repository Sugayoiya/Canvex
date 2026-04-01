---
phase: 05-interaction-video
plan: 02
subsystem: ui
tags: [react, xyflow, css-tokens, recharts, wavesurfer, canvas-v5]

requires:
  - phase: 04-media-tools
    provides: "V4 NodeShell, --cv4-* CSS tokens, PanelHost with template-menu"
provides:
  - "V5 NodeShell with external label, no header row, overflow visible, drag affordance"
  - "V5 PanelType with image-toolbar/video-toolbar/audio-toolbar"
  - "V5 PanelHost routing 5 panel types"
  - "--cv5-* CSS custom properties for status/chart theming"
  - "npm deps: recharts, wavesurfer.js, @wavesurfer/react"
affects: [05-03-toolbars, 05-04-batch-selection, 05-05-audio-node, 05-06-billing]

tech-stack:
  added: [recharts, wavesurfer.js, "@wavesurfer/react"]
  patterns: [external-node-label, type-specific-panel-routing, cv5-css-tokens]

key-files:
  created: []
  modified:
    - web/src/components/canvas/nodes/shared/node-shell.tsx
    - web/src/components/canvas/hooks/use-node-focus.ts
    - web/src/components/canvas/panels/panel-host.tsx
    - web/src/app/globals.css
    - web/package.json

key-decisions:
  - "V5 label gap=8px and fontSize=13px per UI-SPEC consolidated typography"
  - "MediaToolbarPlaceholder shared for image/video/audio until Plan 03 builds real toolbars"
  - "TemplateMenu removed from PanelHost — replaced by type-specific toolbar routing"

patterns-established:
  - "External node label: absolute positioned at top:-24 with pointer-events-none"
  - "Type-specific panel routing: useNodeFocus derives panel type from material node type"
  - "--cv5-* CSS namespace for Phase 05 tokens alongside existing --cv4-*"

requirements-completed: [REQ-09]

duration: 2min
completed: 2026-03-30
---

# Phase 05 Plan 02: V5 Node Shell + Panel Routing Summary

**V5 NodeShell with external label above card, type-specific panel routing for image/video/audio toolbars, --cv5-* CSS status tokens, and recharts/wavesurfer npm deps installed**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T06:56:09Z
- **Completed:** 2026-03-30T06:58:03Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- NodeShell V5: removed internal header, placed type icon + name as external absolute label above-left of card with overflow:visible for zoom safety
- Drag affordance preserved via cursor:grab on card body after header removal
- PanelType extended with image-toolbar, video-toolbar, audio-toolbar — useNodeFocus derives type-specific panels
- PanelHost routes to placeholder toolbars for 3 new media types (real implementations in Plan 03)
- 13 --cv5-* CSS custom properties added for status colors, selection, and chart theming
- npm deps recharts, wavesurfer.js, @wavesurfer/react installed for downstream plans

## Task Commits

Each task was committed atomically:

1. **Task 1: Install npm deps + CSS tokens + NodeShell V5 redesign** - `3b46774` (feat)
2. **Task 2: useNodeFocus V5 panel types + PanelHost V5 routing** - `abf5a97` (feat)

## Files Created/Modified
- `web/src/components/canvas/nodes/shared/node-shell.tsx` - V5 NodeShell with external label, no header, overflow visible, cursor grab
- `web/src/components/canvas/hooks/use-node-focus.ts` - PanelType extended with image/video/audio toolbar types
- `web/src/components/canvas/panels/panel-host.tsx` - Routes 5 panel types, placeholder media toolbars
- `web/src/app/globals.css` - 13 --cv5-* CSS custom properties for status/chart/selection
- `web/package.json` - Added recharts, wavesurfer.js, @wavesurfer/react

## Decisions Made
- Used shared MediaToolbarPlaceholder for all 3 media toolbar slots — Plan 03 will replace with real ImageToolbar/VideoToolbar/AudioToolbar
- Removed template-menu panel type entirely — replaced by type-specific routing
- V5 label uses gap=8 and fontSize=13 per UI-SPEC consolidated spacing/typography (up from V4's gap=6 and fontSize=12)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| File | Location | Stub | Resolution |
|------|----------|------|------------|
| panel-host.tsx | MediaToolbarPlaceholder | Shared placeholder for image/video/audio toolbars | Plan 03 replaces with real toolbar components |

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- V5 NodeShell ready for all node types — external label renders for text/image/video/audio
- Panel routing framework ready for real toolbar implementations (Plan 03)
- CSS tokens and npm deps installed for billing charts (Plan 05) and audio waveform (Plan 03)
- template-action-panel.tsx file still exists but is no longer imported — can be cleaned up in Plan 03

## Self-Check: PASSED

- All 5 modified files exist on disk
- Commit `3b46774` (Task 1) verified in git log
- Commit `abf5a97` (Task 2) verified in git log
- TypeScript compilation passes (`tsc --noEmit` exit 0)

---
*Phase: 05-interaction-video*
*Completed: 2026-03-30*
