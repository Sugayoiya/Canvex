---
phase: 05-interaction-video
plan: 03
subsystem: ui
tags: [react, wavesurfer, canvas, toolbar, audio, dynamic-import]

requires:
  - phase: 05-02
    provides: PanelHost with placeholder toolbars, useNodeFocus with PanelType routing
  - phase: 04-01
    provides: NodeShell V5, design tokens, canvas theming system
provides:
  - ImageToolbar with 7 disabled template skills + 5 utility buttons
  - VideoToolbar with 2x speed toggle + download
  - AudioToolbar with 2x speed toggle + download
  - AudioNode with WaveSurfer waveform visualization (dynamic import, SSR-safe)
  - PanelHost wired to all three new toolbar components
affects: [05-04, 05-05, 05-06]

tech-stack:
  added: ["@wavesurfer/react (dynamic import)", "wavesurfer.js via WavesurferPlayer"]
  patterns: ["dynamic(() => import(...), { ssr: false }) for browser-only libs", "memo() wrapper on node components", "disabled skill UX: opacity 0.4 + aria-disabled + title tooltip"]

key-files:
  created:
    - web/src/components/canvas/panels/image-toolbar.tsx
    - web/src/components/canvas/panels/video-toolbar.tsx
    - web/src/components/canvas/panels/audio-toolbar.tsx
  modified:
    - web/src/components/canvas/panels/panel-host.tsx
    - web/src/components/canvas/nodes/audio-node.tsx

key-decisions:
  - "All 7 ImageToolbar template skills disabled with opacity 0.4 + 即将上线 tooltip until skill registry wired"
  - "WaveSurfer loaded via next/dynamic with ssr:false — prevents hydration mismatch from AudioContext/Canvas APIs"
  - "AudioNode uses memo() wrapper matching other node component patterns for re-render optimization"

patterns-established:
  - "Disabled skill button pattern: aria-disabled=true, opacity 0.4, cursor not-allowed, title=即将上线"
  - "Speed cycle toggle: 1x → 1.5x → 2x → 0.5x state machine via index rotation"
  - "Dynamic import pattern for browser-only audio/video libraries in Next.js SSR context"

requirements-completed: [REQ-09]

duration: 3min
completed: 2026-03-30
---

# Phase 05 Plan 03: Type-Specific Toolbars + AudioNode WaveSurfer Summary

**ImageToolbar (7+5 buttons), VideoToolbar, AudioToolbar, and AudioNode rewritten with WaveSurfer waveform via dynamic import for SSR safety**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T07:01:45Z
- **Completed:** 2026-03-30T07:04:53Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ImageToolbar with 7 disabled template skill buttons (即将上线 tooltip + aria-disabled) and 5 utility buttons (grid, annotate, crop, download, preview)
- VideoToolbar and AudioToolbar with 2x speed cycle toggle and download button
- PanelHost wired to real toolbar components replacing MediaToolbarPlaceholder
- AudioNode rewritten from basic `<audio>` tag to WaveSurfer waveform with red playhead, play/pause, time display, and circular upload button

## Task Commits

Each task was committed atomically:

1. **Task 1: ImageToolbar + VideoToolbar + AudioToolbar + PanelHost wiring** - `033df76` (feat)
2. **Task 2: AudioNode rewrite with WaveSurfer** - `1d3ee2d` (feat)

## Files Created/Modified
- `web/src/components/canvas/panels/image-toolbar.tsx` - ImageToolbar with 12 buttons (7 template + 5 utility) split by divider
- `web/src/components/canvas/panels/video-toolbar.tsx` - VideoToolbar with 2x speed toggle + download
- `web/src/components/canvas/panels/audio-toolbar.tsx` - AudioToolbar with 2x speed toggle + download
- `web/src/components/canvas/panels/panel-host.tsx` - Replaced MediaToolbarPlaceholder with real toolbar imports
- `web/src/components/canvas/nodes/audio-node.tsx` - Rewritten with WaveSurfer via dynamic import, lazy init, cleanup on unmount

## Decisions Made
- All 7 ImageToolbar template skills disabled initially — skills not in registry yet. UX: opacity 0.4 + `aria-disabled="true"` + `title="即将上线"` native tooltip
- WaveSurfer loaded via `next/dynamic` with `ssr: false` to prevent hydration mismatch (AudioContext/Canvas browser APIs)
- AudioNode wrapped in `memo()` matching ImageNode/VideoNode pattern for render optimization
- Lazy WaveSurfer init: only renders WavesurferPlayer when audioUrl is truthy, avoiding unnecessary instances for empty audio nodes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three media toolbars functional, ready for batch execution (Plan 04) and video generation wiring (Plan 05/06)
- AudioNode WaveSurfer integration complete, ready for audio skill integration when audio generation skills are added
- Template skill buttons ready to be enabled when skill registry wiring is implemented

## Self-Check: PASSED

- [x] image-toolbar.tsx exists
- [x] video-toolbar.tsx exists
- [x] audio-toolbar.tsx exists
- [x] panel-host.tsx updated
- [x] audio-node.tsx rewritten
- [x] Commit 033df76 found
- [x] Commit 1d3ee2d found
- [x] tsc --noEmit passes

---
*Phase: 05-interaction-video*
*Completed: 2026-03-30*
