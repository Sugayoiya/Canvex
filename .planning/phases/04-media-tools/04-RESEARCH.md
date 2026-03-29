# Phase 04: Media/Slash Skills + Quota Controls - Research

**Researched:** 2026-03-30
**Domain:** Canvas node redesign, media skill implementation, quota enforcement
**Confidence:** HIGH

## Summary

Phase 04 is a large-scope redesign that replaces the current 5 functional-type canvas nodes (text-input, llm-generate, extract, image-gen, output) with 4 material-type nodes (text, image, video, audio), adds a focus-panel interaction system, template system, asset library, left floating toolbar, and enforces quota controls. The phase has extensive existing design work (UI-SPEC, CANVAS-NODE-DESIGN, component-specs, design-tokens) that serve as the authoritative implementation contract.

The codebase has a solid foundation from Phases 02-03.1: SkillRegistry + Executor + Celery async path, useNodeExecution/useNodePersistence/useUpstreamData hooks, AICallLog + ModelPricing + SkillExecutionLog models, and billing API. What's missing: video generation skill/provider, quota enforcement middleware, the new node type components, focus-panel system, template system, and asset library.

**Primary recommendation:** Implement in 4 waves as defined in CANVAS-NODE-DESIGN.md — Wave 1 (bug fixes + infra), Wave 2 (minimal nodes + focus panels), Wave 3 (toolbar + assets + connection UX), Wave 4 (template system). Quota enforcement should be added as a cross-cutting concern in Wave 1 at the SkillExecutor level.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
_No locked decisions captured — CONTEXT.md has placeholder content._

### Claude's Discretion
_Full discretion on implementation approach — no constraints from discuss phase._

### Deferred Ideas
_No deferred ideas captured._
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-07 | Media/slash skills are available for image/video workflows | New `video.generate_video` skill + enhanced `visual.generate_image`, template system as skill-driven node workflows, slash commands via AI Generate Panel `/` trigger |
| REQ-08 | Usage quota checks and enforcement exist at user/team level | QuotaService at SkillExecutor level, new `UserQuota`/`TeamQuota` model, pre-execution check + deterministic rejection |
</phase_requirements>

## Project Constraints (from .cursor/rules/)

- **Aspect ratio**: Use `aspect_ratio_service.py` utilities for ratio parsing/Gemini mapping; front-end passes `aspect_ratio` string, backend handles resolution
- **Next.js 16**: App Router with breaking changes — read `node_modules/next/dist/docs/` before writing code (per web/AGENTS.md)
- **TailwindCSS 4**: Uses `@import "tailwindcss"` syntax, `@theme inline` blocks (not v3 `@tailwind` directives)
- **React 19**: Current version in use — no legacy patterns
- **No shadcn**: Project uses custom components on `@xyflow/react` and `lucide-react`
- **Commit convention**: conventional commit with category prefix (`feat:`, `fix:`, `chore:`)
- **Respond in 中文**: User rules require Chinese communication

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@xyflow/react` | 12.10.1 | Canvas graph editor — nodes, edges, handles, viewport | Installed, in use |
| `lucide-react` | 1.7.0 | Icon library — all node/menu/action icons | Installed, in use |
| `zustand` | 5.0.12 | Client state (canvas store, chat store) | Installed, in use |
| `@tanstack/react-query` | 5.95.2 | Server state management | Installed, in use |
| `react` / `react-dom` | 19.2.4 | UI framework | Installed |
| `next` | 16.2.1 | App Router SSR framework | Installed |
| `tailwindcss` | 4.x | Utility CSS | Installed |
| `axios` | 1.13.6 | HTTP client with JWT interceptors | Installed, in use |
| `google-genai` | 1.14.0+ | Gemini API SDK (image + video) | Installed backend |
| `celery[redis]` | 5.4.0+ | Async task queue | Installed backend |
| `sqlalchemy[asyncio]` | 2.0.46+ | ORM | Installed backend |

### No new dependencies required

The existing stack covers all Phase 04 needs. No new npm or pip packages are needed:
- CSS custom properties (no CSS-in-JS library)
- `@xyflow/react` handles all canvas interactions including edge-drop-to-create
- `lucide-react` has all required icons (file-text, image, play-circle, music, plus, git-branch, package, etc.)
- Google genai SDK already supports video generation via `generate_videos` method (Veo model)
- No TipTap needed for text toolbar — Phase 04 uses a simple formatting toolbar (H1/H2/H3/B/I) that can be implemented with `contenteditable` or basic state management

## Architecture Patterns

### Recommended Frontend File Structure

```
web/src/components/canvas/
├── canvas-workspace.tsx          # MODIFY: Replace CanvasToolbar, new nodeTypes, focus system
├── canvas-floating-toolbar.tsx   # NEW: Left floating menu
├── canvas-asset-panel.tsx        # NEW: Asset library sidebar
├── canvas-node-creation-menu.tsx # NEW: Edge-drop node picker
├── save-asset-dialog.tsx         # NEW: Save-to-asset dialog
├── nodes/
│   ├── index.ts                  # MODIFY: New type registry + backward compat map
│   ├── text-node.tsx             # NEW: Minimal text card
│   ├── image-node.tsx            # NEW: Minimal image card
│   ├── video-node.tsx            # NEW: Minimal video card
│   ├── audio-node.tsx            # NEW: Minimal audio card (placeholder)
│   └── shared/
│       ├── node-shell.tsx        # NEW: Shared card container
│       └── status-indicator.tsx  # NEW: 7-state indicator
├── panels/
│   ├── ai-generate-panel.tsx     # NEW: AI generation (below empty nodes)
│   ├── text-toolbar.tsx          # NEW: Rich text toolbar (above text w/ content)
│   ├── template-action-panel.tsx # NEW: Template menu (above media w/ content)
│   └── panel-host.tsx            # NEW: Panel positioning + animation manager
├── hooks/
│   ├── use-node-execution.ts     # EXISTING: Reuse as-is
│   ├── use-node-persistence.ts   # EXISTING: Reuse as-is
│   ├── use-upstream-data.ts      # MODIFY: Add videoUrl, audioUrl
│   ├── use-prompt-builder.ts     # NEW: final_prompt = hidden + description + upstream
│   └── use-node-focus.ts         # NEW: Focus state, panel direction logic
└── edges/
    └── custom-edge.tsx           # EXISTING or modify for new styling
```

### Pattern 1: Focus Panel System (Core Interaction)

**What:** A centralized panel manager that positions floating panels relative to focused nodes.
**When to use:** Every node interaction flows through this system.
**Architecture:**

```typescript
// use-node-focus.ts
interface FocusState {
  focusedNodeId: string | null;
  panelType: 'ai-generate' | 'text-toolbar' | 'template-menu' | null;
  panelDirection: 'above' | 'below';
}

function useFocusPanel() {
  // Determine panel type based on:
  // 1. Node type (text vs image/video/audio)
  // 2. Content state (empty vs has content)
  // Returns: which panel to render and where
}
```

**Key decision:** The panel should render as an overlay **outside** the ReactFlow node component, managed by `panel-host.tsx` in the ReactFlow container. This avoids ReactFlow's node dimension calculations being affected by panel size.

### Pattern 2: NodeShell Shared Container

**What:** All 4 node types share a `NodeShell` wrapper that handles card styling, header, handles, focus ring.
**Benefit:** Single place for border/shadow/animation logic, DRY.

```typescript
interface NodeShellProps {
  nodeType: 'text' | 'image' | 'video' | 'audio';
  nodeId: string;
  hasContent: boolean;
  status: NodeExecutionStatus;
  children: React.ReactNode;
}
```

### Pattern 3: Backward Compatibility Mapping

**What:** Old node types render through new components via the nodeTypes registry.
**Why:** Existing canvases in DB have `node_type` values like `"text-input"`, `"llm-generate"`, etc.

```typescript
export const nodeTypes: NodeTypes = {
  // New primary types
  text: TextNode,
  image: ImageNode,
  video: VideoNode,
  audio: AudioNode,
  // Legacy backward compat
  "text-input": TextNode,
  "llm-generate": TextNode,
  "prompt-input": TextNode,
  "ai-text-generate": TextNode,
  "source-text": TextNode,
  extract: TextNode,
  output: TextNode,
  "image-gen": ImageNode,
  "ai-image-process": ImageNode,
  "source-image": ImageNode,
};
```

### Pattern 4: CSS Custom Properties for Theming

**What:** Design tokens from `design-tokens.json` map to `--cv4-*` CSS custom properties.
**Where:** Added to `globals.css` with `.theme-dark` / `.theme-light` class toggles.
**Benefit:** All Phase 04 components reference `var(--cv4-*)` — single source of truth for theming.

### Pattern 5: Quota Enforcement at SkillExecutor Level

**What:** Pre-execution quota check in `SkillExecutor.invoke()` before delegating to registry.
**Why:** Centralized enforcement — applies to both UI-triggered and agent-triggered skill invocations.

```python
class SkillExecutor:
    async def invoke(self, name, params, context):
        # 1. Check quota BEFORE execution
        quota_result = await self._check_quota(context)
        if not quota_result.allowed:
            return SkillResult.failed(
                message=quota_result.reason,
                error_code="QUOTA_EXCEEDED"
            )
        # 2. Proceed with existing invoke logic
        ...
```

### Anti-Patterns to Avoid

- **Panel inside ReactFlow node:** Don't render focus panels as children of node components — they'll affect node dimensions and cause layout thrashing
- **Multiple focus states:** Only one node can be focused at a time. Don't allow panel-inside-panel nesting
- **Hardcoded theme colors:** All colors must use CSS variables, never hardcoded hex in component styles
- **toFlowNode data loss:** Current `toFlowNode()` doesn't map `config.text` to `data.text` — this bug (documented in design doc) must be fixed in Wave 1

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node positioning on canvas | Custom drag logic | `@xyflow/react` built-in | Handles zoom, panning, snapping, minimap |
| Panel positioning relative to nodes | Manual coordinate calc | `useReactFlow().getViewport()` + node internals | Viewport transform is complex; ReactFlow handles zoom/pan math |
| Theme switching | Custom toggle + context | CSS custom properties + class toggle | Zero JS overhead, instant switch, SSR-safe |
| Connection validation | Manual type checking | Extend existing `connection-rules.ts` | Already has NODE_IO pattern |
| Async task polling | Custom intervals | Existing `useNodeExecution` hook | Already has backoff, timeout, status machine |
| Cost calculation | Inline math | Existing `pricing_service.py` | Already handles per_token, per_image, per_request models |

## Common Pitfalls

### Pitfall 1: toFlowNode Data Mapping Bug
**What goes wrong:** Current `toFlowNode()` puts everything in `data.config` but nodes read from `data.text`, `data.result_url`, etc. directly. The LLM node passes `{ text: inputText }` as the param but the skill expects `prompt`.
**Why it happens:** Phase 02 had inconsistent naming between backend (config.text) and frontend (data.text).
**How to avoid:** Wave 1 must fix `toFlowNode()` to extract `config.text` → `data.text`, `config.prompt` → `data.prompt`. Also fix LLM node to pass `prompt` not `text`.
**Warning signs:** Nodes appear empty after page reload despite having content in DB.

### Pitfall 2: ReactFlow Node Dimension Instability
**What goes wrong:** Adding floating panels as children of node components causes ReactFlow to recalculate node dimensions, shifting edges and causing visual jitter.
**Why it happens:** ReactFlow measures node DOM elements to position handles and edges.
**How to avoid:** Render panels in a separate layer (`panel-host.tsx`) positioned absolutely relative to the ReactFlow container, using `useReactFlow().getViewport()` for coordinate transforms.
**Warning signs:** Edges shift/detach when panels appear.

### Pitfall 3: Backward Compat Node Type Confusion
**What goes wrong:** Old nodes stored as `"text-input"` don't render or lose functionality when mapped to new `TextNode`.
**Why it happens:** New `TextNode` expects different `data` shape than old `TextInputNode`.
**How to avoid:** `toFlowNode()` must normalize old data shapes. Map old `config.text` → new `data.text`, old `config.aspect_ratio` → preserved in config.
**Warning signs:** Canvas loads but nodes show empty/broken state.

### Pitfall 4: Quota Check Race Condition
**What goes wrong:** Two concurrent skill invocations both pass quota check, then both execute, overshooting quota.
**Why it happens:** Check-then-execute is not atomic.
**How to avoid:** Use `SELECT ... FOR UPDATE` or atomic counter decrement in the quota check. For Phase 04 MVP, accept minor overshoot (fail-open) since exact enforcement is a later optimization.
**Warning signs:** Usage slightly exceeds quota limits.

### Pitfall 5: Video Provider Not Implemented
**What goes wrong:** `video.generate_video` skill is registered but backend provider doesn't exist, causing runtime failures.
**Why it happens:** Gemini Veo API requires a different SDK call path than Imagen.
**How to avoid:** Implement `GeminiVideoProvider` using `google.genai` SDK's `generate_videos` (or similar) endpoint. If Veo is not available or requires waitlist, implement a stub that returns a clear error.
**Warning signs:** Video node execution always fails.

### Pitfall 6: CSS Variable Naming Collision
**What goes wrong:** Phase 04 `--cv4-*` variables conflict with existing `--background` / `--foreground` variables in globals.css.
**Why it happens:** Both systems define background/foreground colors.
**How to avoid:** Phase 04 scopes ALL new variables under `--cv4-` prefix. The canvas page uses these exclusively; existing variables remain for non-canvas pages.
**Warning signs:** Canvas colors bleed into other pages or vice versa.

## Codebase State Analysis

### What Exists and Can Be Reused

| Component | Location | Reuse Status |
|-----------|----------|-------------|
| `useNodeExecution` hook | `hooks/use-node-execution.ts` | **Reuse as-is** — 7-state machine, Celery polling, backend writeback |
| `useNodePersistence` hook | `hooks/use-node-persistence.ts` | **Reuse as-is** — debounced save, flush on beforeunload |
| `useUpstreamData` hook | `hooks/use-upstream-data.ts` | **Enhance** — add `videoUrl[]` and `audioUrl[]` fields |
| `SkillRegistry` | `api/app/skills/registry.py` | **Reuse as-is** — register/invoke/poll pattern |
| `SkillExecutor` | `api/app/skills/executor.py` | **Modify** — add quota check before invoke |
| `SkillContext` | `api/app/skills/context.py` | **Reuse as-is** — carries user_id, team_id, project_id |
| `SkillDescriptor` | `api/app/skills/descriptor.py` | **Reuse as-is** — categories already include VIDEO, AUDIO, MEDIA |
| `AICallLog` model | `api/app/models/ai_call_log.py` | **Reuse as-is** — tracks per-call cost |
| `ModelPricing` model | `api/app/models/model_pricing.py` | **Reuse as-is** — per_token, per_image, per_request |
| `SkillExecutionLog` model | `api/app/models/skill_execution_log.py` | **Reuse as-is** — tracks total_cost per skill execution |
| `pricing_service.py` | `api/app/services/billing/` | **Reuse as-is** — calculate_cost + snapshot |
| `billing.py` router | `api/app/api/v1/billing.py` | **Reuse as-is** — pricing CRUD + usage stats |
| `GeminiImageProvider` | `api/app/services/ai/model_providers/gemini_image.py` | **Reuse as-is** — Imagen API wrapper |
| `connection-rules.ts` | `web/src/lib/connection-rules.ts` | **Replace** — new NODE_IO for 4 material types |
| `canvasApi` | `web/src/lib/api.ts` | **Extend** — add asset CRUD endpoints |
| `canvas-store.ts` | `web/src/stores/canvas-store.ts` | **Extend** — add focused node state |
| `ChatSidebar` | `web/src/components/chat/chat-sidebar.tsx` | **Reference** — AI Chat popup redesign uses same agent backend |

### What Must Be Created

| Component | Scope |
|-----------|-------|
| 4 new node components | `TextNode`, `ImageNode`, `VideoNode`, `AudioNode` |
| `NodeShell` shared container | Card styling, header, handles, focus ring |
| Focus panel system | `use-node-focus.ts`, `panel-host.tsx` |
| `AIGeneratePanel` | AI generation dialog (below empty nodes) |
| `TextToolbar` | Formatting toolbar (above text nodes with content) |
| `TemplateMenu` | Template actions (above media nodes with content) |
| `LeftFloatingMenu` | Replaces `CanvasToolbar` |
| `NodeCreationMenu` | Edge-drop-to-create node type picker |
| `AssetPanel` + `SaveAssetDialog` | Asset library sidebar + save dialog |
| `use-prompt-builder.ts` | Prompt assembly: hidden + description + upstream |
| `video.generate_video` skill | Backend skill + Gemini Veo provider |
| `CanvasAsset` model | Backend asset storage model |
| Asset CRUD API | `/api/v1/canvas/assets` endpoints |
| `QuotaService` | Quota check/enforcement service |
| `UserQuota` / `TeamQuota` models | Quota configuration models |
| Quota API endpoints | Check/set quota endpoints |
| CSS custom properties | `--cv4-*` theme variables in globals.css |

### Current Bug Inventory (from design doc)

| Bug | Current Code | Fix |
|-----|-------------|-----|
| LLM node sends `text` param | `llm-node.tsx:107` — `{ text: inputText }` | Change to `{ prompt: inputText }` |
| `toFlowNode` ignores config.text | `canvas-workspace.tsx:66-76` — config not extracted | Extract `config.text` → `data.text`, etc. |
| Provider "auto" unhandled | Backend doesn't fallback on "auto" | Add auto-selection logic in `provider_manager.py` |

## Video Generation Service Research

### Gemini Veo API (google-genai SDK)

**Confidence: MEDIUM** — Based on google-genai SDK documentation. The `generate_videos` method exists but may require specific model access.

The `google-genai` SDK (already installed as `google-genai>=1.14.0`) supports video generation:

```python
from google import genai
from google.genai import types

client = genai.Client(api_key=api_key)

# Text-to-video
response = await client.aio.models.generate_videos(
    model="veo-2.0-generate-001",
    prompt="A cinematic shot of a sunset over mountains",
    config=types.GenerateVideosConfig(
        aspect_ratio="16:9",
        number_of_videos=1,
    ),
)

# Image-to-video
response = await client.aio.models.generate_videos(
    model="veo-2.0-generate-001",
    image=types.Image(image_bytes=image_data),
    prompt="Animate this scene with gentle camera movement",
    config=types.GenerateVideosConfig(
        aspect_ratio="16:9",
    ),
)
```

**Risk:** Veo model availability may depend on API access tier. If not available, the skill should return a clear error ("Video generation model not available for your API key").

**Fallback:** Implement `GeminiVideoProvider` with graceful degradation — if Veo is unavailable, the skill returns `SkillResult.failed("Video generation service not available")` rather than crashing.

### Video Generation Skill Design

```python
descriptor = SkillDescriptor(
    name="video.generate_video",
    display_name="AI 视频生成",
    description="使用 Gemini Veo API 生成视频",
    category=SkillCategory.VIDEO,
    execution_mode="async_celery",
    celery_queue="media_processing",
    estimated_duration="long",
    input_schema={
        "type": "object",
        "properties": {
            "prompt": {"type": "string"},
            "image_url": {"type": "string", "description": "首帧图片 URL (可选)"},
            "aspect_ratio": {"type": "string", "default": "16:9"},
            "duration_seconds": {"type": "integer", "default": 5},
            "model": {"type": "string", "default": "veo-2.0-generate-001"},
        },
        "required": ["prompt"],
    },
)
```

## Quota Enforcement Architecture

### Current State

Phase 02 built the **logging/costing** infrastructure:
- `AICallLog` records every AI call with cost
- `SkillExecutionLog` records every skill invocation with total_cost
- `ModelPricing` stores per-model pricing rules
- `pricing_service.py` calculates cost at write time (fail-open)
- `billing.py` router provides usage stats API

**What's missing:** There is NO quota enforcement — no limit checking, no rejection on overshoot.

### Quota Model Design

```python
class UserQuota(Base):
    __tablename__ = "user_quotas"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True, unique=True)
    monthly_credit_limit: Mapped[Decimal | None]  # NULL = unlimited
    daily_call_limit: Mapped[int | None]           # NULL = unlimited
    current_month_usage: Mapped[Decimal]            # Cached, reconciled daily
    current_day_calls: Mapped[int]                  # Reset daily
    last_reset_date: Mapped[datetime]
    
class TeamQuota(Base):
    __tablename__ = "team_quotas"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    team_id: Mapped[str] = mapped_column(String(36), index=True, unique=True)
    monthly_credit_limit: Mapped[Decimal | None]
    daily_call_limit: Mapped[int | None]
    current_month_usage: Mapped[Decimal]
    current_day_calls: Mapped[int]
    last_reset_date: Mapped[datetime]
```

### Enforcement Flow

```
User clicks Generate → Frontend calls skillsApi.invoke() →
Backend SkillExecutor.invoke() → QuotaService.check(user_id, team_id) →
  ✅ Allowed → proceed with skill execution
  ❌ Exceeded → return SkillResult.failed("QUOTA_EXCEEDED")
```

### Deterministic Policy Outcomes (REQ-08)

When quota is exceeded:
1. `SkillResult` returns `status="failed"`, `error_code="QUOTA_EXCEEDED"`
2. Frontend detects `QUOTA_EXCEEDED` and shows specific UI:
   - Send button disabled (50% opacity)
   - Zap icon turns red (#EF4444)
   - Tooltip: "额度已用完 — 升级计划或联系管理员"
3. Agent tool calls also receive the quota error and can inform the user

### Pre-execution Quota Estimation

For the AI Generate Panel to show estimated token/credit cost **before** generation:
- Frontend calls a lightweight `/api/v1/billing/estimate` endpoint with model + expected token count
- Returns estimated cost in credits
- Displayed as `⚡14` in the bottom bar

## Code Examples

### Focus Panel Positioning (ReactFlow coordinate transform)

```typescript
import { useReactFlow, useViewport } from "@xyflow/react";

function PanelHost({ focusedNodeId, panelType }: PanelHostProps) {
  const { getNodes } = useReactFlow();
  const viewport = useViewport();
  
  const node = getNodes().find(n => n.id === focusedNodeId);
  if (!node) return null;
  
  // Transform node position to screen coordinates
  const screenX = node.position.x * viewport.zoom + viewport.x;
  const screenY = node.position.y * viewport.zoom + viewport.y;
  const nodeHeight = (node.measured?.height ?? 200) * viewport.zoom;
  
  const hasContent = node.data.result_text || node.data.result_url;
  const panelY = hasContent
    ? screenY - PANEL_HEIGHT - GAP  // Above
    : screenY + nodeHeight + GAP;   // Below
  
  return (
    <div 
      className="absolute z-50 pointer-events-auto"
      style={{ left: screenX, top: panelY }}
    >
      {panelType === 'ai-generate' && <AIGeneratePanel />}
      {panelType === 'text-toolbar' && <TextToolbar />}
      {panelType === 'template-menu' && <TemplateMenu />}
    </div>
  );
}
```

### Prompt Builder Hook

```typescript
function usePromptBuilder(nodeId: string) {
  const upstream = useUpstreamData(nodeId);
  const nodes = useNodes();
  const node = nodes.find(n => n.id === nodeId);
  
  return useMemo(() => {
    const parts: string[] = [];
    
    // 1. Hidden prompt (from template)
    const hiddenPrompt = node?.data?.config?.hidden_prompt;
    if (hiddenPrompt) parts.push(hiddenPrompt);
    
    // 2. Node's own description/prompt
    const nodePrompt = node?.data?.text || node?.data?.prompt;
    if (nodePrompt) parts.push(nodePrompt);
    
    // 3. Upstream text
    if (upstream.text.length > 0) parts.push(upstream.text.join("\n"));
    
    return {
      finalPrompt: parts.join("\n\n"),
      upstreamImages: upstream.imageUrl,
      upstreamVideos: upstream.videoUrl,
    };
  }, [nodeId, upstream, node]);
}
```

### QuotaService Check

```python
class QuotaService:
    @staticmethod
    async def check_quota(
        user_id: str,
        team_id: str | None = None,
    ) -> QuotaCheckResult:
        async with AsyncSessionLocal() as session:
            # Check user quota
            user_quota = await session.get(UserQuota, user_id)
            if user_quota and user_quota.monthly_credit_limit is not None:
                if user_quota.current_month_usage >= user_quota.monthly_credit_limit:
                    return QuotaCheckResult(
                        allowed=False,
                        reason="用户月度额度已用完",
                        error_code="USER_QUOTA_EXCEEDED",
                    )
            
            # Check team quota
            if team_id:
                team_quota = await session.get(TeamQuota, team_id)
                if team_quota and team_quota.monthly_credit_limit is not None:
                    if team_quota.current_month_usage >= team_quota.monthly_credit_limit:
                        return QuotaCheckResult(
                            allowed=False,
                            reason="团队月度额度已用完",
                            error_code="TEAM_QUOTA_EXCEEDED",
                        )
            
            return QuotaCheckResult(allowed=True)
```

## State of the Art

| Old Approach (Phase 02-03) | New Approach (Phase 04) | Impact |
|---------------------------|------------------------|--------|
| 5 functional node types | 4 material node types | Simpler mental model, each node = one content type |
| Controls embedded in node | Focus-panel overlay system | Cleaner nodes, richer editing panels |
| Top toolbar for node creation | Left floating menu | More canvas space, better mobile UX |
| `CanvasToolbar` component | `LeftFloatingMenu` component | Component replacement |
| No templates | Template-driven downstream workflows | Enable one-click complex workflows |
| No assets | Asset library with drag-to-canvas | Reusable content across canvases |
| Cost logging only | Cost logging + quota enforcement | Prevent overspend |
| No video skill | `video.generate_video` via Veo | Media workflow completion |

## Open Questions

1. **Veo API Availability**
   - What we know: google-genai SDK has video generation methods; `ModelType.VIDEO_GENERATION` already defined in entities.py
   - What's unclear: Whether the configured API key has access to Veo models, exact response format for video generation
   - Recommendation: Implement provider with try/catch, return clear error if model unavailable. Test with actual API key early in implementation.

2. **Audio Node Scope**
   - What we know: Design doc marks audio as "预留" (reserved/placeholder). Audio skill is `audio.generate` with "暂不实现" status.
   - What's unclear: Whether any audio functionality should be implemented or just the empty node shell
   - Recommendation: Implement AudioNode component shell only (empty state with placeholder hint "🎵 音频功能即将上线"), no backend audio skill.

3. **Quota Reset Mechanism**
   - What we know: Quota needs monthly/daily counters
   - What's unclear: Whether to use Celery Beat for periodic reset or lazy reset on first access
   - Recommendation: Lazy reset — check `last_reset_date` on each quota query, reset if month/day has changed. Simpler, no additional infra dependency.

4. **Existing Canvas Data Migration**
   - What we know: Backend `CanvasNode` table has `node_type` column with old type values
   - What's unclear: Whether to migrate DB records or just handle backward compat in frontend
   - Recommendation: Frontend-only backward compat mapping (as designed). No DB migration. Old nodes display through new components.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.3.5 (asyncio_mode=auto) |
| Config file | `api/pyproject.toml` [tool.pytest.ini_options] |
| Quick run command | `cd api && uv run pytest tests/ -x -q` |
| Full suite command | `cd api && uv run pytest tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-07a | video.generate_video skill registered | unit | `pytest tests/test_skill_registration.py -x` | ✅ extend |
| REQ-07b | Video skill invocation returns result | integration | `pytest tests/test_media_skills.py -x` | ❌ Wave 0 |
| REQ-07c | Template system creates downstream nodes | unit | `pytest tests/test_templates.py -x` | ❌ Wave 4 |
| REQ-08a | QuotaService blocks when exceeded | unit | `pytest tests/test_quota.py -x` | ❌ Wave 0 |
| REQ-08b | SkillExecutor checks quota before invoke | integration | `pytest tests/test_quota.py::test_executor_quota_check -x` | ❌ Wave 0 |
| REQ-08c | Quota exceeded returns deterministic error | unit | `pytest tests/test_quota.py::test_quota_error_format -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd api && uv run pytest tests/ -x -q` (< 30s)
- **Per wave merge:** `cd api && uv run pytest tests/ -v` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/test_media_skills.py` — covers REQ-07 video skill registration + invocation
- [ ] `tests/test_quota.py` — covers REQ-08 quota check/enforcement
- [ ] `tests/test_templates.py` — covers template creation + downstream node logic

## Sources

### Primary (HIGH confidence)
- Codebase inspection — all files read directly from `/Users/sugayoiya/Documents/Short-Drama-Studio/Canvex/`
- `04-CANVAS-NODE-DESIGN.md` — authoritative design document with 4 waves
- `designs/component-specs.md` — pixel-precise component specifications
- `designs/design-tokens.json` — complete dual-theme token system
- `04-UI-SPEC.md` — verified UI design contract

### Secondary (MEDIUM confidence)
- Google genai SDK video generation API — based on SDK structure and `entities.py` ModelType definitions
- `@xyflow/react` 12.x API — node measured dimensions, viewport transforms

### Tertiary (LOW confidence)
- Veo model availability and exact response format — needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — design docs are exhaustive, codebase patterns well-established
- Pitfalls: HIGH — identified from direct code inspection of current bugs
- Video provider: MEDIUM — SDK exists but runtime availability unverified
- Quota design: HIGH — straightforward extension of existing billing infrastructure

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable — no external API changes expected)
