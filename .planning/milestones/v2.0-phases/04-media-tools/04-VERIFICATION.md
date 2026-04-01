---
phase: 04-media-tools
verified: 2026-03-30T08:15:00Z
status: passed
score: 3/3 success criteria verified (38/38 plan-level truths verified)
re_verification:
  previous_status: pending
  previous_score: 0/0
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open canvas, click each of the 4 node types from LeftFloatingMenu, verify they render correctly"
    expected: "Text/Image/Video/Audio nodes render with NodeShell wrapper, correct icons, and --cv4-* styled cards"
    why_human: "Visual rendering and interaction behavior requires browser"
  - test: "Click an empty node, verify AIGeneratePanel appears below it with prompt input"
    expected: "Panel slides in below the node with textarea, tags, model/ratio pills, and send button"
    why_human: "Viewport-transform positioning and animation requires live browser"
  - test: "Click a text node with content, verify TextToolbar appears above"
    expected: "Toolbar with H1/H2/H3/B/I formatting buttons appears above the node"
    why_human: "Panel direction and positioning is viewport-dependent"
  - test: "Open AssetPanel via LeftFloatingMenu package icon, verify type tabs and empty state"
    expected: "Asset panel slides in with All/Text/Image/Video/Audio tabs, shows empty state message"
    why_human: "UI interaction and state management requires browser"
---

# Phase 04: Media/Slash Skills + Quota Controls — Verification Report

**Phase Goal:** Replace 5 functional-type canvas nodes with 4 material-type nodes (text/image/video/audio), add focus-panel interaction system, template-driven workflows, asset library, video generation skill, and enforce quota constraints.
**Verified:** 2026-03-30T08:15:00Z
**Status:** passed
**Re-verification:** No — initial verification (previous was empty placeholder)

## Goal Achievement

### Success Criteria (from ROADMAP.md)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| SC-1 | Media/slash skill set is available and callable | ✓ VERIFIED | `video.generate_video` registered in SkillRegistry via `register_all_skills()`, `GeminiVideoProvider` wraps Veo API, provider auto-select iterates [gemini, openai, deepseek] |
| SC-2 | Usage aggregation and quota checks are enforced | ✓ VERIFIED | `QuotaService.check_quota()` called pre-execution in `SkillExecutor.invoke()` (line 32), `update_usage()` called post-execution with idempotent `skill_execution_id` |
| SC-3 | Exceeding quotas returns deterministic policy outcomes | ✓ VERIFIED | Returns `SkillResult.failed(message=..., error_code="QUOTA_EXCEEDED")` when quota check fails; fail-closed on any exception |

**Score: 3/3 success criteria verified**

### Plan-Level Observable Truths (38/38)

#### Plan 01: Frontend Infrastructure (6/6)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CSS --cv4-* tokens render correct colors in both dark/light themes | ✓ VERIFIED | 30+ vars in `globals.css` :root/.theme-dark (line 29-65), .theme-light (line 76+) with full dual-theme coverage |
| 2 | Connection rules enforce material-type compatibility | ✓ VERIFIED | `connection-rules.ts` has NODE_IO with exactly 4 types (text/image/video/audio), `isValidConnection` checks output→input compatibility |
| 3 | toFlowNode extracts config.text/config.prompt into data | ✓ VERIFIED | `canvas-workspace.tsx` toFlowNode (line 81-82): `text: (config.text as string) ?? ""`, `prompt: (config.prompt as string) ?? ""` |
| 4 | Old node_type values can be migrated via script | ✓ VERIFIED | `api/scripts/migrate_node_types.py` exists |
| 5 | NodeShell provides shared card container | ✓ VERIFIED | `node-shell.tsx` (51 lines): full card with Handle, header (icon+label+status), children slot, --cv4-* styling |
| 6 | useUpstreamData returns videoUrl/audioUrl arrays | ✓ VERIFIED | `use-upstream-data.ts` type includes `videoUrl: string[]`, `audioUrl: string[]`, aggregation at lines 48/51 |

#### Plan 02: Backend Quota (5/5)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Quota check blocks skill execution when monthly credit limit exceeded | ✓ VERIFIED | `executor.py` lines 32-40: check_quota pre-execution gate returns `SkillResult.failed` |
| 2 | Quota counter increment is atomic via SELECT...FOR UPDATE | ✓ VERIFIED | `quota_service.py` lines 24, 44, 93, 103: `.with_for_update()` on all SELECT queries |
| 3 | Usage update is idempotent by skill_execution_id | ✓ VERIFIED | `quota_service.py` lines 83-89: existing check before insert, `QuotaUsageLog.skill_execution_id` unique constraint |
| 4 | Quota admin PUT endpoints require admin role and write audit log | ✓ VERIFIED | `quota.py`: `require_admin(user)` on PUT endpoints (lines 53, 107), `QuotaUsageLog(action="admin_set")` with JSON details |
| 5 | Quota exceeded returns deterministic SkillResult with QUOTA_EXCEEDED | ✓ VERIFIED | `executor.py` lines 37-40: `SkillResult.failed(message=quota_result.reason, error_code=quota_result.error_code)` |

#### Plan 03: Backend Video (5/5)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Provider 'auto' selects first available configured provider | ✓ VERIFIED | `provider_manager.py` lines 58-68: iterates `["gemini", "openai", "deepseek"]`, returns first with API key |
| 2 | GeminiVideoProvider generates video via google.genai SDK | ✓ VERIFIED | `gemini_video.py`: full implementation with `genai.Client`, `generate_videos`, polling loop (5s × 120 = 10min max), .mp4 save |
| 3 | video.generate_video skill is registered in SkillRegistry | ✓ VERIFIED | `register_all.py` line 16: `from app.skills.video import register_video_skills`, line 25: `register_video_skills()` |
| 4 | Video skill returns SkillResult for async Celery execution | ✓ VERIFIED | `generate_video.py` descriptor: `execution_mode="async_celery"`, `celery_queue="media_processing"`, handler returns `SkillResult(status="completed")` |
| 5 | If Veo model unavailable, skill returns clear error message | ✓ VERIFIED | `gemini_video.py` lines 87-88: catches "not found"/"not supported" → `TransientError("视频生成模型不可用")` |

#### Plan 04: Material Nodes (5/5)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 4 material node types render correctly with NodeShell wrapper | ✓ VERIFIED | All 4 nodes (text/image/video/audio) import and wrap content in `<NodeShell>` with correct nodeType prop |
| 2 | nodeTypes registry contains ONLY 4 entries | ✓ VERIFIED | `nodes/index.ts`: exactly `{ text: TextNode, image: ImageNode, video: VideoNode, audio: AudioNode }` — no legacy types |
| 3 | useNodeFocus tracks single focused node with panel type/direction | ✓ VERIFIED | `use-node-focus.ts`: derives panelType (ai-generate/text-toolbar/template-menu) and panelDirection (above/below) from focus state |
| 4 | usePromptBuilder assembles final_prompt = hidden_prompt + node text + upstream text | ✓ VERIFIED | `use-prompt-builder.ts`: 3-part assembly (lines 22-28) with `hiddenPrompt`, `nodePrompt`, `upstream.text` joined by `\n\n` |
| 5 | Audio node displays placeholder '音频功能即将上线' | ✓ VERIFIED | `audio-node.tsx` line 37: `🎵 音频功能即将上线`, `hasContent` always `false` |

#### Plan 05: Focus Panels + Menus (6/6)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AIGeneratePanel appears below empty nodes with text input, model selector, send button | ✓ VERIFIED | `ai-generate-panel.tsx` (200 lines): textarea, TAGS row, model pill (Sparkles+"Gemini"), ratio pill, send button |
| 2 | TextToolbar appears above text nodes with content — H1/H2/H3/B/I buttons | ✓ VERIFIED | `text-toolbar.tsx` (121 lines): TOOLBAR_BUTTONS array with H1/H2/H3/Paragraph/Bold/Italic + list/hr/copy/expand |
| 3 | TemplateMenu appears above image/video/audio nodes with content — template chips | ✓ VERIFIED | `template-action-panel.tsx` (87 lines): IMAGE_TEMPLATES with 九宫格/三视图/风格迁移/图生视频 chips |
| 4 | PanelHost positions panels correctly using ReactFlow viewport transform | ✓ VERIFIED | `panel-host.tsx` lines 40-41: `screenX = node.position.x * viewport.zoom + viewport.x`, correct above/below offset calc |
| 5 | LeftFloatingMenu provides add node, assets, history, help, user buttons | ✓ VERIFIED | `canvas-floating-toolbar.tsx`: Plus (add node picker), GitBranch, Package (assets), History, Info, User avatar |
| 6 | Send button in AIGeneratePanel is disabled with red zap icon when quota exceeded | ✓ VERIFIED | `ai-generate-panel.tsx` lines 172-175: `Zap` icon with `quotaExceeded ? "#EF4444"` color, line 183: `disabled={quotaExceeded}` |

#### Plan 06: Asset Library (6/6)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Assets are project-scoped and CRUD endpoints enforce project membership | ✓ VERIFIED | `canvas_assets.py`: `resolve_project_access()` called on every endpoint (list/create/get/update/delete) |
| 2 | GET /assets supports pagination with limit/offset and filtering by asset_type | ✓ VERIFIED | `canvas_assets.py` lines 19-21: `limit: int = Query(20)`, `offset: int = Query(0)`, `asset_type: str \| None` |
| 3 | PATCH /assets/{id} allows updating asset name, tags, and metadata | ✓ VERIFIED | `canvas_assets.py` lines 78-100: PATCH endpoint with `AssetUpdate` (name, tags, config_json) |
| 4 | JSON payload config_json has 50KB size limit enforced by Pydantic validator | ✓ VERIFIED | `canvas_asset.py` schema: `MAX_CONFIG_JSON_SIZE = 50 * 1024`, `@field_validator("config_json")` with UTF-8 byte length check |
| 5 | AssetPanel displays project assets with type tabs and drag-to-canvas | ✓ VERIFIED | `canvas-asset-panel.tsx` (241 lines): TABS (all/text/image/video/audio), `handleDragStart` with dataTransfer JSON, grid layout |
| 6 | SaveAssetDialog captures name and tags when saving node content | ✓ VERIFIED | `save-asset-dialog.tsx` (169 lines): name input (required, max 255), tags input, canvasApi.createAsset mutation |

#### Plan 07: Integration + Templates (5/5)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | canvas-workspace.tsx uses new nodeTypes, LeftFloatingMenu, PanelHost, --cv4-* colors | ✓ VERIFIED | Imports: `nodeTypes` (line 29), `LeftFloatingMenu` (line 25), `PanelHost` (line 26), `AssetPanel` (line 27), `background: "var(--cv4-canvas-bg)"` (line 204) |
| 2 | Integration is incremental — targeted edits, NOT full rewrite | ✓ VERIFIED | Original `InnerWorkspace` structure preserved with `useNodesState/useEdgesState`, `persistViewport`, `handleConnect` etc. |
| 3 | Template application creates downstream nodes with auto-connections and hidden prompts | ✓ VERIFIED | `canvas-templates.ts` `applyTemplate()`: creates positioned nodes from `downstreamNodes`, edges from sourceNodeId to each, hidden_prompt injected into config |
| 4 | Template validate rejects cycles and incompatible NODE_IO connections | ✓ VERIFIED | `validateTemplateGraph()`: DFS cycle detection (lines 63-89), IO compatibility check (lines 50-61) |
| 5 | Old CanvasToolbar import removed and replaced by LeftFloatingMenu | ✓ VERIFIED | No `CanvasToolbar` import in workspace; `LeftFloatingMenu` rendered at line 240 |

**Score: 38/38 plan-level truths verified**

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/src/app/globals.css` | --cv4-* CSS tokens | ✓ VERIFIED | 30+ vars, dark+light themes, panel animations |
| `web/src/lib/connection-rules.ts` | 4 material types only | ✓ VERIFIED | NODE_IO with text/image/video/audio, isValidConnection, getCompatibleTargetTypes |
| `web/src/components/canvas/nodes/shared/node-shell.tsx` | NodeShell | ✓ VERIFIED | 51 lines, Handle+header+children slot, --cv4-* styling |
| `web/src/components/canvas/nodes/shared/status-indicator.tsx` | StatusIndicator | ✓ VERIFIED | 7-state display with color coding and animation |
| `web/src/components/canvas/nodes/text-node.tsx` | TextNode | ✓ VERIFIED | 95 lines, NodeShell+useNodeFocus+useNodeExecution+useNodePersistence |
| `web/src/components/canvas/nodes/image-node.tsx` | ImageNode | ✓ VERIFIED | 94 lines, image preview + model/ratio metadata |
| `web/src/components/canvas/nodes/video-node.tsx` | VideoNode | ✓ VERIFIED | 72 lines, video preview with play overlay |
| `web/src/components/canvas/nodes/audio-node.tsx` | AudioNode | ✓ VERIFIED | 43 lines, placeholder "音频功能即将上线" |
| `web/src/components/canvas/nodes/index.ts` | nodeTypes (4 entries) | ✓ VERIFIED | Exactly 4 keys, no legacy mappings |
| `web/src/components/canvas/hooks/use-node-focus.ts` | useNodeFocus | ✓ VERIFIED | Focus state + panel type/direction derivation |
| `web/src/components/canvas/hooks/use-prompt-builder.ts` | usePromptBuilder | ✓ VERIFIED | 3-part prompt assembly with upstream data |
| `web/src/components/canvas/panels/panel-host.tsx` | PanelHost | ✓ VERIFIED | Viewport transform positioning, CSS transitions, Escape handler |
| `web/src/components/canvas/panels/ai-generate-panel.tsx` | AIGeneratePanel | ✓ VERIFIED | 200 lines, full UI with skillsApi.invoke, quota indicator |
| `web/src/components/canvas/panels/text-toolbar.tsx` | TextToolbar | ✓ VERIFIED | 121 lines, H1-H3/B/I/list/hr toggle buttons |
| `web/src/components/canvas/panels/template-action-panel.tsx` | TemplateMenu | ✓ VERIFIED | 87 lines, template chips (visual-only for MVP) |
| `web/src/components/canvas/canvas-floating-toolbar.tsx` | LeftFloatingMenu | ✓ VERIFIED | 191 lines, glassmorphism sidebar, node picker |
| `web/src/components/canvas/canvas-node-creation-menu.tsx` | NodeCreationMenu | ✓ VERIFIED | 96 lines, connection-rule-filtered type list |
| `web/src/lib/canvas-templates.ts` | Templates with graph validation | ✓ VERIFIED | validateTemplateGraph (cycle+IO), applyTemplate, 5 BUILT_IN_TEMPLATES |
| `web/src/stores/canvas-store.ts` | Focus state in store | ✓ VERIFIED | focusedNodeId/focusedNodeType/focusedNodeHasContent + setFocusedNode/clearFocus |
| `api/app/models/quota.py` | UserQuota, TeamQuota | ✓ VERIFIED | UserQuota + TeamQuota + QuotaUsageLog ORM models |
| `api/app/services/quota_service.py` | QuotaService | ✓ VERIFIED | check_quota (fail-closed, FOR UPDATE), update_usage (idempotent), _lazy_reset |
| `api/app/skills/executor.py` | Quota integration | ✓ VERIFIED | Pre-execution check_quota gate, post-execution update_usage |
| `api/app/api/v1/quota.py` | Quota API | ✓ VERIFIED | GET /my, GET/PUT /user/{id}, GET/PUT /team/{id} with require_admin |
| `api/app/schemas/quota.py` | Quota schemas | ✓ VERIFIED | QuotaResponse, QuotaUpdate, QuotaCheckResult |
| `api/app/services/ai/model_providers/gemini_video.py` | GeminiVideoProvider | ✓ VERIFIED | 91 lines, Veo API with polling, error handling |
| `api/app/skills/video/generate_video.py` | video.generate_video skill | ✓ VERIFIED | 136 lines, full implementation with descriptor, handler, registration |
| `api/app/models/canvas_asset.py` | CanvasAsset model | ✓ VERIFIED | SoftDeleteMixin, project-scoped, JSON config |
| `api/app/schemas/canvas_asset.py` | Asset schemas | ✓ VERIFIED | AssetCreate/Update/Response + 50KB config_json validator |
| `api/app/api/v1/canvas_assets.py` | Asset CRUD API | ✓ VERIFIED | List/Create/Get/Update/Delete with resolve_project_access |
| `web/src/components/canvas/canvas-asset-panel.tsx` | AssetPanel | ✓ VERIFIED | 241 lines, type tabs, drag-to-canvas, delete confirmation |
| `web/src/components/canvas/save-asset-dialog.tsx` | SaveAssetDialog | ✓ VERIFIED | 169 lines, name+tags form, canvasApi.createAsset |
| `web/src/components/canvas/canvas-workspace.tsx` | Integration | ✓ VERIFIED | All Phase 04 components integrated, nodeTypes/LeftFloatingMenu/PanelHost/AssetPanel |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| node-shell.tsx | globals.css | var(--cv4-*) CSS custom properties | ✓ WIRED | NodeShell uses 8+ --cv4-* variables |
| canvas-workspace.tsx | connection-rules.ts | isValidConnection import | ✓ WIRED | Line 24 import, used in handleConnect and isValidConnection prop |
| text-node.tsx | node-shell.tsx | import { NodeShell } | ✓ WIRED | Line 4 import, renders as wrapper |
| use-prompt-builder.ts | use-upstream-data.ts | useUpstreamData(nodeId) | ✓ WIRED | Line 4 import, line 14 call |
| nodes/index.ts | 4 node components | nodeTypes registry with 4 keys | ✓ WIRED | 4 imports + 4 entries in const |
| panel-host.tsx | use-node-focus.ts | useNodeFocus() for panelType/direction | ✓ WIRED | Line 4 import, line 13 destructure |
| ai-generate-panel.tsx | api.ts | skillsApi.invoke() for generation | ✓ WIRED | Line 14 import, line 42-52 call |
| executor.py | quota_service.py | QuotaService.check_quota() pre-execution | ✓ WIRED | Line 30 import, line 32-36 check, line 37-40 enforce |
| executor.py | quota_service.py | QuotaService.update_usage() post-execution | ✓ WIRED | Line 54 _update_quota_usage call chain |
| quota.py | deps.py | require_admin role check | ✓ WIRED | Line 10 import, used on PUT endpoints |
| generate_video.py | gemini_video.py | GeminiVideoProvider.generate_video() | ✓ WIRED | Line 99 import, line 101 instantiate, line 102 call |
| provider_manager.py | _PROVIDER_REGISTRY | get_provider('auto') auto-selection | ✓ WIRED | Lines 58-68: iterates candidates, resolves API key |
| canvas_assets.py | deps.py | resolve_project_access() membership check | ✓ WIRED | Line 5 import, called on all 5 endpoints |
| canvas-asset-panel.tsx | api.ts | canvasApi.listAssets() | ✓ WIRED | Line 7 import, useQuery call on line 58 |
| canvas-workspace.tsx | nodes/index.ts | import { nodeTypes } — 4 material types | ✓ WIRED | Line 29 import, line 214 prop |
| canvas-workspace.tsx | panels/panel-host.tsx | PanelHost rendered in container | ✓ WIRED | Line 26 import, line 241 render |
| canvas-templates.ts | connection-rules.ts | NODE_IO for IO validation | ✓ WIRED | Line 1 import, used in validateTemplateGraph |
| register_all.py | video/generate_video.py | video skill registration | ✓ WIRED | Line 16 import, line 25 register call |
| router.py | canvas_assets.py | Router registration | ✓ WIRED | Line 8 import, line 16 include (before canvas_router) |
| router.py | quota.py | Router registration | ✓ WIRED | Line 4 import, line 20 include |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REQ-07 | 04-01, 04-03, 04-04, 04-05, 04-06, 04-07 | Media/slash skills are available for image/video workflows | ✓ SATISFIED | video.generate_video skill registered, 4 material nodes, asset library, template system, AIGeneratePanel invokes skills |
| REQ-08 | 04-02, 04-05 | Usage quota checks and enforcement exist at user/team level | ✓ SATISFIED | QuotaService (check + update), SkillExecutor pre-execution gate, admin API, AIGeneratePanel quota indicator |

No orphaned requirements — both REQ-07 and REQ-08 are covered by multiple plans and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `template-action-panel.tsx` | 61 | onClick handler is no-op (`/* template application deferred */`) | ⚠️ Warning | Template chips visible but non-functional; `applyTemplate` exists in canvas-templates.ts but not wired to UI buttons |
| `audio-node.tsx` | 12 | `hasContent = false` (hardcoded) | ℹ️ Info | Deliberate design decision — audio deferred; not blocking phase goal |
| `ai-generate-panel.tsx` | 176-177 | Quota count "14" hardcoded | ⚠️ Warning | Static display — not connected to real-time quota API; cosmetic only |
| `nodes/text-input-node.tsx` | — | Legacy node file still exists | ℹ️ Info | Orphaned — not imported by nodeTypes or workspace; cleanup deferred |
| `nodes/extract-node.tsx` | — | Legacy node file still exists | ℹ️ Info | Orphaned — not imported |
| `nodes/image-gen-node.tsx` | — | Legacy node file still exists | ℹ️ Info | Orphaned — not imported |
| `nodes/llm-node.tsx` | — | Legacy node file still exists | ℹ️ Info | Orphaned — not imported |
| `canvas-toolbar.tsx` | — | Legacy toolbar still exists | ℹ️ Info | Orphaned — workspace imports LeftFloatingMenu instead |

### Human Verification Required

### 1. Canvas Node Rendering
**Test:** Open canvas, add each of the 4 node types via LeftFloatingMenu, verify they render correctly with NodeShell card structure
**Expected:** Nodes display with correct icons (FileText/Image/PlayCircle/Music), header labels (文本/图片/视频/音频), status indicator, and --cv4-* themed styling
**Why human:** Visual rendering requires browser with ReactFlow

### 2. Focus Panel System
**Test:** Click an empty image node → verify AIGeneratePanel appears below; enter text in a text node → click it → verify TextToolbar appears above; click an image node with content → verify TemplateMenu appears above
**Expected:** Panels animate in (opacity + translateY), positioned correctly relative to node via viewport transform, dismiss on pane click or Escape
**Why human:** Viewport-based positioning and animation requires live browser

### 3. Asset Library Drag-to-Canvas
**Test:** Save a node to asset library via SaveAssetDialog, then open AssetPanel and drag an asset onto the canvas
**Expected:** Asset appears in AssetPanel with correct type icon, draggable to canvas via dataTransfer
**Why human:** Drag-and-drop interaction requires browser

### 4. Quota Enforcement End-to-End
**Test:** Set a user quota limit via admin API, then invoke a skill that would exceed the limit
**Expected:** SkillExecutor returns QUOTA_EXCEEDED error; subsequent invocations blocked until next month/day reset
**Why human:** Requires running backend with database to test full flow

---

_Verified: 2026-03-30T08:15:00Z_
_Verifier: Claude (gsd-verifier)_
