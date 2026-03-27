# Phase 02: Full Skill Migration + Base Canvas + Billing Baseline - Research

**Researched:** 2026-03-27
**Domain:** Skill system migration, @xyflow/react canvas, billing/pricing data model
**Confidence:** HIGH

## Summary

Phase 2 builds on the Phase 1 foundation (SkillRegistry + Celery + logging) by: (1) migrating 5 categories of business services from the parent Short-Drama-Studio repo into Canvex Skills, (2) building a base canvas UI with @xyflow/react v12 and 5 core node types that execute through SkillRegistry, and (3) implementing the billing baseline (ModelPricing table + AICallLog write path with token extraction + cost calculation).

The existing codebase has a well-established Skill pattern (descriptor + handler + registration), Celery task routing, and log tables (SkillExecutionLog, AICallLog). Phase 2's primary risk is scope: ~20 new Skills need real LLM integration (not placeholders), a full canvas UI from scratch, and a billing model. The restructuring plan (`canvas_studio_重构方案_v2`) provides detailed specifications for all three areas.

**Primary recommendation:** Prioritize Skill migration by category (TEXT → EXTRACT → SCRIPT → STORYBOARD → VISUAL), build canvas UI in parallel, and keep billing baseline minimal (ModelPricing CRUD + AICallLog write path — defer aggregation/quotas to Phase 4).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-03 | Core business services are migrated into structured Skills (TEXT/EXTRACT/SCRIPT/STORYBOARD/VISUAL) | Skill migration architecture, parent service analysis, registration pattern |
| REQ-04 | Baseline canvas with 5 core node types executes through SkillRegistry | @xyflow/react architecture, node registry, connection rules, SkillRegistry invoke pattern |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115.0 | Backend API | Already in pyproject.toml |
| SQLAlchemy[asyncio] | >=2.0.46 | ORM | Already in pyproject.toml |
| Celery[redis] | >=5.4.0 | Task queue | Already configured with 4 queues |
| structlog | >=24.4.0 | Structured logging | Already integrated with trace_id middleware |
| @xyflow/react | ^12.10.1 | Canvas graph editor | Already in package.json |
| React | 19.2.4 | UI framework | Already in package.json |
| Next.js | 16.2.1 | Frontend framework | Already in package.json |
| @tanstack/react-query | ^5.95.2 | Server state | Already in package.json |
| zustand | ^5.0.12 | Client state | Already in package.json |
| TailwindCSS | ^4 | Styling | Already in devDependencies |

### Supporting (May Need Adding)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| openai (Python) | >=2.16.0 | LLM provider API | Already in pyproject.toml, needed for Skill LLM calls |
| google-generativeai | latest | Gemini provider | Need to add if migrating Gemini Skills |
| Decimal (stdlib) | N/A | Cost calculation | Already used in AICallLog model |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @xyflow/react | Reactflow (old name) | Same library, @xyflow/react is current v12 package name |
| zustand for canvas state | xyflow's built-in useNodesState/useEdgesState | Use xyflow hooks for node/edge state; zustand only for app-level state |

## Architecture Patterns

### Backend: Skill Migration Pattern

Each new Skill follows the exact pattern established in Phase 1:

```
api/app/skills/
├── {category}/
│   ├── __init__.py          # register_{category}_skills() function
│   ├── {skill_name}.py      # descriptor + handler + registration
│   └── ...
```

**Per-Skill file structure:**
```python
# api/app/skills/text/refine.py
descriptor = SkillDescriptor(
    name="text.refine",
    display_name="文本润色",
    description="...",
    category=SkillCategory.TEXT,
    execution_mode="async_celery",
    celery_queue="ai_generation",
    input_schema={...},
    output_schema={...},
)

async def handle_refine(params: dict, ctx: SkillContext) -> SkillResult:
    # 1. Validate params
    # 2. Get LLM provider (from provider_manager or factory)
    # 3. Build messages (with prompt templates if needed)
    # 4. Call provider.generate()
    # 5. Parse response
    # 6. Return SkillResult with structured data
    ...

def register_text_refine_skill():
    skill_registry.register(descriptor, handle_refine)
```

**Key difference from Phase 1 stubs:** Phase 2 Skills call actual LLM providers instead of returning placeholders. This requires:
1. Migrating `ProviderManager` (or a simplified version) from parent repo
2. Migrating `PromptTemplateService` for prompt rendering
3. Migrating `Message` dataclass and base provider interfaces

### Backend: Provider Integration Strategy

The parent repo's `LLMProviderBase.__init_subclass__` auto-wraps `generate()` with `auto_log_generation()`. For Canvex, the logging should flow through the new `AICallLog` table (already defined) instead of the legacy `ai_generation_logs` table.

**Recommended approach:**
1. Port `ProviderManager` with credential lookup (env vars only for Phase 2, skip team-scoped credentials)
2. Port `LLMProviderBase` + Gemini/OpenAI/DeepSeek providers
3. Replace `auto_log_generation` wrapper with a new wrapper that writes to `AICallLog`
4. Each provider's `_extract_usage()` returns `{input_tokens, output_tokens}` from native response

### Backend: PromptTemplateService

Many business services depend on `PromptTemplateService.render_by_slug()` to load prompt templates from DB. Options:
1. **Full migration:** Port PromptTemplate model + seeds + render service
2. **Hardcoded prompts:** Embed prompts in Skill handlers directly
3. **Hybrid:** Use simple string templates in Skill files; add DB-driven templates later

**Recommendation:** Use hardcoded prompt strings in Skill handlers for Phase 2. Port PromptTemplateService in a later phase when template customization is needed. This avoids migrating the PromptTemplate model, seeds, and render logic.

### Frontend: Canvas Architecture

```
web/src/
├── app/
│   └── canvas/[id]/page.tsx          # Canvas workspace page
├── components/
│   └── canvas/
│       ├── canvas-workspace.tsx       # Main ReactFlow wrapper
│       ├── canvas-toolbar.tsx         # Toolbar (add nodes, zoom, etc.)
│       ├── nodes/
│       │   ├── index.ts              # nodeTypes registry object
│       │   ├── text-input-node.tsx    # Text/source input
│       │   ├── llm-node.tsx          # LLM generation node
│       │   ├── extract-node.tsx      # Extraction (characters/scenes)
│       │   ├── image-gen-node.tsx    # Image generation
│       │   └── output-node.tsx       # Result display
│       ├── edges/
│       │   └── custom-edge.tsx
│       └── hooks/
│           ├── use-canvas-state.ts   # Canvas zustand store
│           └── use-node-execution.ts # Skill invoke + poll
├── lib/
│   ├── api.ts                        # Add canvas + billing API methods
│   ├── node-registry.ts              # Node type → Skill mapping
│   └── connection-rules.ts           # isValidConnection rules
└── stores/
    └── canvas-store.ts               # Canvas app state (zustand)
```

### Frontend: Node Types (5 Core)

Based on restructuring plan Section 七 (节点与 Skill 的关系):

| Node Type | Purpose | Skill(s) | Handles |
|-----------|---------|-----------|---------|
| `text-input` | Source text / prompt input | N/A (passive) | Output: text |
| `llm-generate` | LLM text generation | `text.llm_generate` | Input: text, Output: text |
| `extract` | Character/Scene extraction | `extract.characters`, `extract.scenes` | Input: text, Output: JSON |
| `image-gen` | AI image generation | `visual.generate_image` | Input: text (prompt), Output: image |
| `output` | Display final results | N/A (passive) | Input: any |

### Frontend: Connection Rules

```typescript
// connection-rules.ts
type HandleType = 'text' | 'json' | 'image' | 'any';

const COMPATIBILITY: Record<string, HandleType[]> = {
  'text-input': { outputs: ['text'] },
  'llm-generate': { inputs: ['text'], outputs: ['text'] },
  'extract': { inputs: ['text'], outputs: ['json'] },
  'image-gen': { inputs: ['text'], outputs: ['image'] },
  'output': { inputs: ['text', 'json', 'image'] },
};
```

Use `isValidConnection` on ReactFlow component to enforce type compatibility.

### Frontend: Node Execution Flow

```
User clicks "Execute" on node
  → Read input from connected source nodes
  → Call skillsApi.invoke({ skill_name, params, canvas_id, node_id })
  → If sync: show result immediately
  → If async: poll with skillsApi.poll(task_id) every 3s
  → Update node data with result
```

### Anti-Patterns to Avoid
- **Don't put business logic in node components**: Nodes are UI shells, all execution goes through SkillRegistry
- **Don't create separate Celery tasks per Skill**: Use the generic `run_skill_task` for everything
- **Don't hard-code provider selection in Skills**: Use ProviderManager for credential/provider resolution
- **Don't mutate xyflow state directly**: Use `useNodesState`/`useEdgesState` hooks or zustand

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph editor | Custom canvas/SVG | @xyflow/react | Already in deps, handles drag/zoom/layout |
| Node state management | Custom state machine | xyflow hooks + zustand | Built-in state management with change callbacks |
| Token counting | Manual char estimation | Provider response `usage` field | Gemini/OpenAI APIs return exact token counts |
| Decimal arithmetic | float for costs | Python `Decimal` | Already used in AICallLog model, avoids float precision issues |
| Connection validation | Custom graph traversal | xyflow `isValidConnection` | Built into Handle/ReactFlow components |
| Async polling | Custom setInterval | React Query with `refetchInterval` | Automatic cleanup, error handling |

## Common Pitfalls

### Pitfall 1: xyflow nodeTypes Object Re-Creation
**What goes wrong:** Defining `nodeTypes` inside a component causes infinite re-renders
**Why it happens:** React Flow checks referential equality on nodeTypes
**How to avoid:** Define `nodeTypes` as a module-level constant or useMemo
**Warning signs:** Console warnings about nodeTypes, performance degradation

### Pitfall 2: Celery Worker Missing Skill Registrations
**What goes wrong:** Celery worker can't find Skills when processing tasks
**Why it happens:** Worker process doesn't call `register_all_skills()` at startup
**How to avoid:** Ensure `register_all_skills()` is called in both FastAPI lifespan AND Celery worker initialization (via `worker_init` signal or in `skill_task.py` imports)
**Warning signs:** "Skill 'X' not found in registry" errors in worker logs

### Pitfall 3: Event Loop in Celery Worker
**What goes wrong:** `asyncio.run()` or event loop conflicts in Celery tasks
**Why it happens:** Celery workers use sync context, Skills are async
**How to avoid:** The existing `_get_or_create_event_loop()` pattern in `skill_task.py` handles this, but must be used consistently
**Warning signs:** RuntimeError about event loops

### Pitfall 4: Provider Credentials Not Available
**What goes wrong:** Skills fail because API keys aren't configured
**Why it happens:** Env vars not set, or provider not registered
**How to avoid:** Validate provider availability at Skill invocation time, return clear error messages
**Warning signs:** 401/403 from provider APIs, empty API key errors

### Pitfall 5: AICallLog Write Path Not Connected
**What goes wrong:** AICallLog table exists but no records written
**Why it happens:** Provider base class wrapper writes to old `ai_generation_logs`, not new `ai_call_logs`
**How to avoid:** Replace the `auto_log_generation` wrapper with one that writes to `AICallLog`
**Warning signs:** AICallLog table always empty, ai_call_stats returns all zeros

### Pitfall 6: Decimal Cost Precision
**What goes wrong:** Cost calculations produce unexpected results
**Why it happens:** Mixing float and Decimal in Python
**How to avoid:** Always use `Decimal` for all cost arithmetic; use `Numeric(12, 6)` in DB
**Warning signs:** Tiny fractional differences in cost totals

### Pitfall 7: Next.js 16 Breaking Changes
**What goes wrong:** Code patterns from Next.js 14/15 training data don't work
**Why it happens:** Next.js 16 has breaking changes (per web/AGENTS.md)
**How to avoid:** Read `node_modules/next/dist/docs/` before writing Next.js code
**Warning signs:** Build errors, runtime errors in App Router pages

## Code Examples

### Skill Handler with Real LLM Integration
```python
# api/app/skills/text/refine.py
async def handle_refine(params: dict, ctx: SkillContext) -> SkillResult:
    content = params.get("content", "")
    if not content:
        return SkillResult.failed("content 不能为空")

    from app.services.ai.provider_manager import get_provider
    provider = await get_provider("gemini")  # or auto-select

    messages = [
        Message(role="system", content="你是专业的文本润色编辑..."),
        Message(role="user", content=content),
    ]
    result_text = await provider.generate(messages, temperature=0.7)

    return SkillResult(
        status="completed",
        data={"text": result_text},
        message=f"文本润色完成 ({len(result_text)} 字)",
    )
```

### Canvas Workspace Component
```tsx
// web/src/components/canvas/canvas-workspace.tsx
"use client";
import { ReactFlow, useNodesState, useEdgesState, addEdge, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./nodes";
import { isValidConnection } from "@/lib/connection-rules";

export function CanvasWorkspace({ canvasId }: { canvasId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback((connection) => {
    setEdges((eds) => addEdge(connection, eds));
  }, [setEdges]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

### Custom Node Component
```tsx
// web/src/components/canvas/nodes/llm-node.tsx
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { skillsApi } from "@/lib/api";

export function LLMGenerateNode({ id, data }: NodeProps) {
  const [output, setOutput] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);

  const execute = async () => {
    setIsRunning(true);
    const res = await skillsApi.invoke({
      skill_name: "text.llm_generate",
      params: { prompt: data.input || "" },
      canvas_id: data.canvasId,
      node_id: id,
    });
    if (res.data.status === "running") {
      // Poll for async result
      const pollInterval = setInterval(async () => {
        const poll = await skillsApi.poll(res.data.task_id);
        if (poll.data.status === "completed") {
          setOutput(poll.data.data.text);
          setIsRunning(false);
          clearInterval(pollInterval);
        }
      }, 3000);
    } else {
      setOutput(res.data.data.text);
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm min-w-[200px]">
      <Handle type="target" position={Position.Left} />
      <div className="text-sm font-medium">LLM 生成</div>
      <button onClick={execute} disabled={isRunning}>
        {isRunning ? "执行中..." : "执行"}
      </button>
      {output && <div className="mt-2 text-xs">{output.slice(0, 100)}...</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

### ModelPricing Table
```python
# api/app/models/model_pricing.py
class ModelPricing(Base):
    __tablename__ = "model_pricing"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    model_type: Mapped[str] = mapped_column(String(20), nullable=False)  # llm/image/video/audio
    pricing_model: Mapped[str] = mapped_column(String(20), nullable=False)  # per_token/per_image/per_second/per_request

    input_price_per_1k: Mapped[Decimal | None] = mapped_column(Numeric(12, 8), nullable=True)
    output_price_per_1k: Mapped[Decimal | None] = mapped_column(Numeric(12, 8), nullable=True)
    price_per_image: Mapped[Decimal | None] = mapped_column(Numeric(12, 8), nullable=True)
    price_per_second: Mapped[Decimal | None] = mapped_column(Numeric(12, 8), nullable=True)
    price_per_request: Mapped[Decimal | None] = mapped_column(Numeric(12, 8), nullable=True)

    effective_from: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
```

### AICallLog Write Path (Provider Base Class)
```python
# In LLMProviderBase wrapper — write to AICallLog instead of legacy table
async def _log_ai_call(
    trace_id: str,
    skill_execution_id: str | None,
    user_id: str,
    team_id: str | None,
    project_id: str | None,
    provider: str,
    model: str,
    model_type: str,
    input_tokens: int | None,
    output_tokens: int | None,
    duration_ms: int,
    status: str,
    cost: Decimal | None = None,
):
    from app.core.database import AsyncSessionLocal
    from app.models.ai_call_log import AICallLog
    log = AICallLog(
        trace_id=trace_id,
        skill_execution_id=skill_execution_id,
        user_id=user_id,
        team_id=team_id,
        project_id=project_id,
        provider=provider,
        model=model,
        model_type=model_type,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        duration_ms=duration_ms,
        status=status,
        cost=cost,
    )
    async with AsyncSessionLocal() as session:
        session.add(log)
        await session.commit()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `reactflow` package | `@xyflow/react` | v12 (2024) | Import path changed, already using new package |
| Placeholder Skill handlers | Real LLM-integrated handlers | Phase 2 | Core business value delivery |
| AICallLog schema exists but empty | Write path in provider wrapper | Phase 2 | Enables billing baseline |
| No canvas UI | @xyflow/react canvas | Phase 2 | First visual workflow interface |

## Open Questions

1. **PromptTemplate migration scope**
   - What we know: Parent repo uses DB-stored prompt templates with render_by_slug()
   - What's unclear: How many templates are essential for Phase 2 Skills?
   - Recommendation: Hardcode essential prompts in Skill handlers; defer full template system

2. **Provider credential scope for Phase 2**
   - What we know: Parent repo has 3-tier credential fallback (team → global → env)
   - What's unclear: Is team-scoped credential lookup needed in Phase 2?
   - Recommendation: Env vars only for Phase 2; add team-scoped credentials later

3. **Canvas persistence**
   - What we know: Phase 2 needs a canvas UI, but no Canvas model exists in Canvex yet
   - What's unclear: Should canvas state persist to DB or be session-only?
   - Recommendation: Add Canvas + CanvasNode + CanvasEdge models (from parent repo pattern) for persistence

4. **Style/image provider integration**
   - What we know: `visual.generate_image` Skill needs an image provider
   - What's unclear: Which image providers to port (Gemini Imagen, DALL-E, Grok)?
   - Recommendation: Port one image provider (Gemini Imagen) as proof of concept; add others in Phase 4

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis | Celery broker/backend | ✓ (via docker-compose) | 7-alpine | — |
| PostgreSQL | Production DB | ✓ (via docker-compose) | 16-alpine | SQLite (USE_SQLITE=true) |
| Node.js/npm | Frontend build | ✓ | Required by Next.js 16 | — |
| Python 3.13+ | Backend | ✓ | Specified in pyproject.toml | — |
| Gemini API key | LLM Skills | Configurable via .env | — | OpenAI as fallback |
| OpenAI API key | LLM/Image Skills | Configurable via .env | — | Gemini as fallback |

**Missing dependencies with no fallback:** None — all infrastructure is already in docker-compose.yml

**Missing dependencies with fallback:**
- AI API keys: Need at least one LLM provider key configured for Skill testing

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (backend), Vitest (frontend — not yet configured) |
| Config file | api/pyproject.toml [project.optional-dependencies.dev] |
| Quick run command | `cd api && uv run pytest -x` |
| Full suite command | `cd api && uv run pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-03 | Skill registration completeness | unit | `uv run pytest tests/test_skill_registration.py -x` | ❌ Wave 0 |
| REQ-03 | Skill handler returns valid SkillResult | unit | `uv run pytest tests/test_skill_handlers.py -x` | ❌ Wave 0 |
| REQ-04 | Canvas API endpoints exist | integration | `uv run pytest tests/test_canvas_api.py -x` | ❌ Wave 0 |
| REQ-04 | Node execution invokes SkillRegistry | integration | `uv run pytest tests/test_node_execution.py -x` | ❌ Wave 0 |
| Billing | ModelPricing CRUD works | unit | `uv run pytest tests/test_model_pricing.py -x` | ❌ Wave 0 |
| Billing | AICallLog write path populates cost | unit | `uv run pytest tests/test_ai_call_log.py -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd api && uv run pytest -x --timeout=30`
- **Per wave merge:** `cd api && uv run pytest`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `api/tests/test_skill_registration.py` — verify all new Skills register and list correctly
- [ ] `api/tests/test_skill_handlers.py` — test each Skill handler with mock LLM provider
- [ ] `api/tests/test_model_pricing.py` — CRUD for ModelPricing table
- [ ] `api/tests/test_ai_call_log.py` — verify write path populates tokens + cost
- [ ] `api/tests/conftest.py` — shared fixtures (async DB session, mock provider, auth user)
- [ ] Framework setup: `uv run pytest` must work (already installed in dev deps)

## Sources

### Primary (HIGH confidence)
- Canvex codebase: `api/app/skills/` — existing Skill framework (registry, descriptor, executor, context)
- Canvex codebase: `api/app/models/` — AICallLog, SkillExecutionLog schemas
- Canvex codebase: `api/app/tasks/skill_task.py` — Celery task pattern
- Parent repo: `api/app/services/ai/business/` — TextWorkshopService, CharacterService, SceneService, StoryToScriptService, ScriptToStoryboardService, StyleGenerationService
- Parent repo: `api/app/services/ai/model_providers/__base/llm_provider.py` — LLMProviderBase auto-logging pattern
- Restructuring plan: `canvas_studio_重构方案_v2` — complete Skill list, billing model, canvas design

### Secondary (MEDIUM confidence)
- reactflow.dev — Custom nodes, nodeTypes, Handle, isValidConnection docs
- @xyflow/react npm — v12.10.1 confirmed in package.json
- Next.js 16 — web/AGENTS.md warns of breaking changes

### Tertiary (LOW confidence)
- None — all findings verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in package.json/pyproject.toml
- Architecture: HIGH — follows established Phase 1 patterns + restructuring plan
- Pitfalls: HIGH — identified from codebase inspection (event loop, nodeTypes, provider registration)
- Billing model: HIGH — specified in detail in restructuring plan Section 九

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable stack, 30-day validity)
