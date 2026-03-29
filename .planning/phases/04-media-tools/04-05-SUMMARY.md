---
phase: 04-media-tools
plan: 05
subsystem: ui
tags: [react, xyflow, canvas, panels, toolbar, lucide]

requires:
  - phase: 04-04
    provides: "Material nodes (text/image/video/audio) with NodeShell, useNodeFocus hook, canvas store focus state"
provides:
  - "PanelHost viewport-transform panel positioning manager"
  - "AIGeneratePanel with prompt input, tags, model/ratio pills, quota indicator"
  - "TextToolbar with H1/H2/H3/B/I formatting buttons"
  - "TemplateMenu with template chips for media nodes"
  - "LeftFloatingMenu glassmorphism sidebar replacing old CanvasToolbar"
  - "NodeCreationMenu with connection-rule-based type filtering"
affects: [04-06, 04-07]

tech-stack:
  added: []
  patterns:
    - "Panel positioning via ReactFlow viewport transform (screenX = node.x * zoom + viewport.x)"
    - "CSS transition-based panel enter/exit animation (opacity + translateY)"
    - "Glassmorphism sidebar via backdrop-filter blur(20px)"

key-files:
  created:
    - web/src/components/canvas/panels/panel-host.tsx
    - web/src/components/canvas/panels/ai-generate-panel.tsx
    - web/src/components/canvas/panels/text-toolbar.tsx
    - web/src/components/canvas/panels/template-action-panel.tsx
    - web/src/components/canvas/canvas-floating-toolbar.tsx
    - web/src/components/canvas/canvas-node-creation-menu.tsx
  modified:
    - web/src/app/globals.css

key-decisions:
  - "CSS transitions over CSS keyframes for panel enter/exit — allows React state-driven animation control"
  - "Template chip click is visual-only for MVP — actual template application deferred to Plan 07"
  - "LeftFloatingMenu node picker appears to the right of + button (not below) to avoid viewport overlap"

patterns-established:
  - "Panel components accept nodeId prop and derive state from hooks — no prop drilling"
  - "Glassmorphism pattern: surface-overlay bg + backdrop-filter blur(20px) + border-subtle"

requirements-completed: [REQ-07, REQ-08]

duration: 3min
completed: 2026-03-29
---

# Phase 04 Plan 05: Focus Panels & Canvas Menus Summary

**PanelHost viewport-positioned panels (AIGenerate/TextToolbar/TemplateMenu) + glassmorphism LeftFloatingMenu + connection-filtered NodeCreationMenu**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-29T17:33:59Z
- **Completed:** 2026-03-29T17:36:38Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- PanelHost renders panels at correct screen positions using ReactFlow viewport transform with CSS transition animations
- AIGeneratePanel with tags row (风格/标记/聚焦), prompt textarea, model/ratio pills, quota indicator (red zap when exceeded), send button calling skillsApi
- TextToolbar with 11 formatting buttons (H1/H2/H3/¶/B/I + divider + list/ordered + divider + hr/copy/expand)
- TemplateMenu with sparkles header, 4 template chips (九宫格场景/角色三视图/风格迁移/图生视频)
- LeftFloatingMenu with glassmorphism sidebar replacing legacy CanvasToolbar — +/workflow/assets/history/help/avatar
- NodeCreationMenu filters compatible target types via getCompatibleTargetTypes from connection-rules

## Task Commits

Each task was committed atomically:

1. **Task 1: PanelHost + AIGeneratePanel + TextToolbar** - `bb1fa61` (feat)
2. **Task 2: TemplateMenu + LeftFloatingMenu + NodeCreationMenu** - `b5fddb3` (feat)

## Files Created/Modified
- `web/src/components/canvas/panels/panel-host.tsx` - Panel positioning manager using viewport transform
- `web/src/components/canvas/panels/ai-generate-panel.tsx` - AI generation dialog with prompt/tags/send/quota
- `web/src/components/canvas/panels/text-toolbar.tsx` - Text formatting toolbar with toggleable buttons
- `web/src/components/canvas/panels/template-action-panel.tsx` - Template function menu with chips
- `web/src/components/canvas/canvas-floating-toolbar.tsx` - Left glassmorphism floating menu
- `web/src/components/canvas/canvas-node-creation-menu.tsx` - Edge-drop node type picker with connection filtering
- `web/src/app/globals.css` - Added cv4-panel-enter/exit keyframes

## Decisions Made
- Used CSS transitions (opacity + transform) driven by React state for panel enter/exit instead of CSS animation keyframes — allows better control of enter/exit timing
- Template chip clicks are visual-only for MVP — actual template application deferred to Plan 07
- Node picker popup appears to the right of the + button rather than below — avoids viewport clipping

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Panel system complete — ready for Plan 06 (canvas workspace integration) and Plan 07 (template skill wiring)
- All 6 components export clean interfaces for parent integration

## Self-Check: PASSED

---
*Phase: 04-media-tools*
*Completed: 2026-03-29*
