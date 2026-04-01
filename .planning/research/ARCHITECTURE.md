# Architecture Patterns

**Domain:** AI Agent System Upgrade for Short-Film Creation Workbench  
**Researched:** 2026-04-02  
**Confidence:** HIGH (based on direct codebase analysis + verified library APIs)

## Current Architecture Snapshot

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 16 + React 19)                                   │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────┐                     │
│  │ Chat UI  │ │ Canvas Flow  │ │ Skill Admin │                     │
│  │ (SSE)    │ │ (React Flow) │ │ (TanStack)  │                     │
│  └────┬─────┘ └──────┬───────┘ └──────┬──────┘                     │
└───────┼──────────────┼────────────────┼─────────────────────────────┘
        │              │                │
────────┼──────────────┼────────────────┼──── HTTP / SSE ─────────────
        │              │                │
┌───────┼──────────────┼────────────────┼─────────────────────────────┐
│  FastAPI Backend                                                     │
│       │              │                │                              │
│  ┌────▼────┐   ┌─────▼──────┐   ┌────▼──────┐                      │
│  │ agent.py│   │ canvas.py  │   │ admin.py  │  ← API Layer         │
│  │ (SSE)   │   │ (batch)    │   │ (CRUD)    │                      │
│  └────┬────┘   └─────┬──────┘   └───────────┘                      │
│       │              │                                              │
│  ┌────▼──────────────┤                                              │
│  │ AgentService      │  ← PydanticAI Agent + agent.iter()          │
│  │ ┌──────────────┐  │                                              │
│  │ │ SkillToolset │  │  ← AbstractToolset bridge                   │
│  │ │ PipelineTools│  │  ← FunctionToolset (deterministic chain)    │
│  │ │ ContextTools │  │  ← FunctionToolset (read-only queries)      │
│  │ └──────┬───────┘  │                                              │
│  └────────┼──────────┘                                              │
│           │                                                         │
│  ┌────────▼──────────┐                                              │
│  │  SkillRegistry    │  ← Central invocation hub                   │
│  │  (singleton)      │                                              │
│  │  14 skills reg'd  │                                              │
│  └──┬────────────┬───┘                                              │
│     │sync        │async_celery                                      │
│     ▼            ▼                                                  │
│  handler()   Celery task                                            │
│              run_skill_task                                          │
│              └→ handler()                                           │
│                                                                     │
│  AI Call Paths (3 SEPARATE STACKS):                                 │
│  (A) PydanticAI: create_pydantic_model() → env key → Agent LLM     │
│  (B) ProviderManager: get_provider_sync() → env key → LLM skills   │
│  (C) Raw Provider: GeminiImageProvider/VideoProvider → env key      │
│                                                                     │
│  ProviderManager.get_provider() [async, DB chain] → DEAD CODE      │
└─────────────────────────────────────────────────────────────────────┘
```

## Recommended Architecture (v3.0 Target)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend                                                           │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────┐                     │
│  │ Chat UI  │ │ Canvas Flow  │ │ Admin Panel │                     │
│  │ (SSE)    │ │ +Chat Panel  │ │ +Skill Mgmt │                     │
│  └────┬─────┘ └──────┬───────┘ └──────┬──────┘                     │
└───────┼──────────────┼────────────────┼─────────────────────────────┘
        │              │                │
────────┼──────────────┼────────────────┼──── HTTP / SSE ─────────────
        │              │                │
┌───────┼──────────────┼────────────────┼─────────────────────────────┐
│  FastAPI Backend                                                     │
│       │              │                │                              │
│  ┌────▼────┐   ┌─────▼──────┐   ┌────▼──────┐                      │
│  │ agent.py│   │ canvas.py  │   │ admin/    │  ← API Layer         │
│  │ (SSE)   │   │ (+chat)    │   │ skills.py │                      │
│  └────┬────┘   └─────┬──────┘   └───────────┘                      │
│       │              │                                              │
│  ┌────▼──────────────▼─────────────────────────────────────┐        │
│  │  AgentService (ENHANCED)                                 │        │
│  │  ┌─────────────┐ ┌──────────────┐ ┌────────────────┐   │        │
│  │  │ QueryEngine │ │ ArtifactStore│ │ ToolInterceptor│   │        │
│  │  │ (budget,    │ │ (session KV) │ │ (inject/persist│   │        │
│  │  │  rounds,    │ │              │ │  artifacts)    │   │        │
│  │  │  plan mode) │ │              │ │                │   │        │
│  │  └──────┬──────┘ └──────┬───────┘ └───────┬────────┘   │        │
│  │         │               │                 │             │        │
│  │  ┌──────▼───────────────▼─────────────────▼──────────┐  │        │
│  │  │ Toolsets                                           │  │        │
│  │  │ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐│  │        │
│  │  │ │ SkillToolset │ │ PipelineTools│ │ ContextTools ││  │        │
│  │  │ │ (enhanced)   │ │ (fixed)      │ │ (+write ops) ││  │        │
│  │  │ ├──────────────┤ ├──────────────┤ ├─────────────┤│  │        │
│  │  │ │SubAgentTool  │ │              │ │             ││  │        │
│  │  │ └──────────────┘ └──────────────┘ └─────────────┘│  │        │
│  │  └──────────────────────┬────────────────────────────┘  │        │
│  └─────────────────────────┼───────────────────────────────┘        │
│                            │                                        │
│  ┌─────────────────────────▼────────────────────────────────┐       │
│  │  UnifiedProviderResolver (NEW)                            │       │
│  │  Replaces 3 call paths → single async DB credential chain │       │
│  │  team → personal → system → env                           │       │
│  │  Wraps: LLM / Image / Video provider instantiation        │       │
│  └─────────────────────────┬─────────────────────────────────┘       │
│                            │                                        │
│  ┌─────────────────────────▼────────────────────────────────┐       │
│  │  SkillRegistry (EXISTING, minor changes)                  │       │
│  │  + SkillDescriptor enhancements (deps, mode, tier)        │       │
│  │  14 existing + 30+ new business skills                    │       │
│  └──┬────────────┬──────────────────────────────────────────┘       │
│     │sync        │async_celery                                      │
│     ▼            ▼                                                  │
│  handler()   Celery run_skill_task                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Boundaries

### Existing Components (MODIFY)

| Component | File(s) | Current Role | v3.0 Changes |
|-----------|---------|-------------|--------------|
| **AgentService** | `agent/agent_service.py` | Agent factory + session CRUD | + QueryEngine integration, + ArtifactStore per-session, + model resolution via UnifiedProviderResolver |
| **SkillDescriptor** | `skills/descriptor.py` | `@dataclass` with name/category/schema/mode | + `dependencies: list[str]`, + `mode: str` (generate/transform/query), + `tier: str` (foundation/business/workflow), + `cost_estimate` |
| **SkillToolset** | `agent/skill_toolset.py` | AbstractToolset bridge to SkillRegistry | + ToolInterceptor hooks in `call_tool()`, + artifact injection pre-call, + artifact persistence post-call |
| **SkillRegistry** | `skills/registry.py` | Central registry + invoke/poll | + dependency validation on register, + discover by tier/mode, + admin list/toggle API |
| **SkillContext** | `skills/context.py` | Serializable identity bag | + `artifact_store_id: str`, + `parent_session_id: str` (for sub-agents) |
| **ProviderManager** | `services/ai/provider_manager.py` | DB credential chain (async dead code) | Activate `get_provider()` async path, integrate Image/Video providers into registry |
| **pipeline_tools.py** | `agent/pipeline_tools.py` | Deterministic 4-step chain | Fix `_chain_params` field mismatches, add Celery-aware async step execution, expand to 7-stage pipeline |
| **context_tools.py** | `agent/context_tools.py` | 4 read-only query tools | + write tools (update_character, update_scene, save_script), + permission checking via SkillContext |
| **agent.py** (API) | `api/v1/agent.py` | SSE chat endpoint | + QueryEngine wrapping `agent.iter()`, + SSE progress events for tool execution, + cost tracking in response |
| **skill_task.py** | `tasks/skill_task.py` | Celery task wrapper | + pass UnifiedProviderResolver context, + structured cost reporting back to SkillExecutionLog |

### New Components (CREATE)

| Component | Proposed Location | Purpose | Depends On |
|-----------|------------------|---------|-----------|
| **QueryEngine** | `agent/query_engine.py` | Token budget enforcement, round limits, diminishing-returns detection, plan-then-execute interaction mode | AgentService, PydanticAI `usage()` API |
| **ArtifactStore** | `agent/artifact_store.py` | Session-scoped KV store for intermediate results (clips, screenplay, shot plans, generated images) | Redis (hot) + DB (cold), AgentSession FK |
| **ToolInterceptor** | `agent/tool_interceptor.py` | Pre/post hooks on tool calls: inject artifacts into params, persist outputs as artifacts, log cost | ArtifactStore, SkillToolset.call_tool() |
| **UnifiedProviderResolver** | `services/ai/unified_resolver.py` | Single entry point for all AI provider instantiation (LLM + Image + Video), replacing 3 call paths | ProviderManager (async path), GeminiImageProvider, GeminiVideoProvider |
| **SubAgentTool** | `agent/sub_agent_tool.py` | PydanticAI FunctionToolset tool that spawns child Agent with scoped ArtifactStore and QueryEngine | AgentService, ArtifactStore, QueryEngine |
| **Business Skills (30+)** | `skills/story/`, `skills/import_ops/`, `skills/asset_extract/`, `skills/screenplay/`, `skills/storyboard_pipeline/`, `skills/dialogue/`, `skills/video_gen/` | 7-stage creation pipeline as discrete skills | UnifiedProviderResolver, SkillDescriptor (enhanced) |
| **WorkflowSkill** | `skills/workflow/` | Persistent workflow definitions (Markdown templates) that chain multiple skills with conditional branching | SkillRegistry, ArtifactStore |
| **AgentMemory** | `agent/memory.py` | Cross-session agent memory (summarized context, user preferences, project learnings) | AgentSession, DB table `agent_memories` |
| **Admin Skills API** | `api/v1/admin/skills.py` | CRUD for skill enable/disable, category browsing, execution stats | SkillRegistry, SkillExecutionLog |

## Detailed Component Designs

### 1. UnifiedProviderResolver — AI Call Convergence

**Problem:** Three disconnected call paths create credential duplication and prevent DB-level key management.

| Path | Current Code | Key Source | Used By |
|------|-------------|-----------|---------|
| (A) PydanticAI | `create_pydantic_model()` in `agent_service.py` | `settings.OPENAI_API_KEY` etc. | Agent chat LLM |
| (B) ProviderManager sync | `get_provider_sync()` in `provider_manager.py` | `settings.*_API_KEY` | Text skills (LLM) |
| (C) Raw providers | Direct `GeminiImageProvider(api_key=...)` in skill handlers | `settings.GEMINI_API_KEY` | Image/video skills |

**Solution:** `UnifiedProviderResolver` wraps `ProviderManager.get_provider()` (the async DB chain) and adds Image/Video provider instantiation.

```python
class UnifiedProviderResolver:
    """Single entry for all AI provider resolution — LLM, Image, Video."""

    async def resolve_llm(
        self, provider: str, model: str, *,
        team_id: str | None, user_id: str | None, db: AsyncSession,
    ) -> AIProviderBase:
        """For text/LLM skills via ProviderManager async chain."""

    async def resolve_pydantic_model(
        self, provider: str, model: str, *,
        team_id: str | None, user_id: str | None, db: AsyncSession,
    ) -> pydantic_ai.models.Model:
        """For PydanticAI Agent — creates OpenAIModel/GoogleModel with DB-resolved key."""

    async def resolve_image(
        self, provider: str, model: str, *,
        team_id: str | None, user_id: str | None, db: AsyncSession,
    ) -> GeminiImageProvider:
        """For image generation skills."""

    async def resolve_video(
        self, provider: str, model: str, *,
        team_id: str | None, user_id: str | None, db: AsyncSession,
    ) -> GeminiVideoProvider:
        """For video generation skills."""
```

**Integration points:**
- `agent_service.py`: Replace `create_pydantic_model()` with `resolver.resolve_pydantic_model()`
- `skills/visual/generate_image.py`: Replace `settings.GEMINI_API_KEY` → `resolver.resolve_image()`
- `skills/video/generate_video.py`: Replace `settings.GEMINI_API_KEY` → `resolver.resolve_video()`
- All text skills using `get_provider_sync()` → `resolver.resolve_llm()`
- `SkillContext`: Add `team_id` + `user_id` already present; resolver reads these

**Celery complication:** Celery workers run in separate processes without access to the request's `AsyncSession`. The resolver must create its own session internally when `db=None`, matching the existing pattern in `ProviderManager._resolve_key()`.

### 2. QueryEngine — Budget & Interaction Control

**Purpose:** Wrap `agent.iter()` with guardrails: token budget, round limits, diminishing-returns detection, and "plan first, then execute" interaction mode.

```python
@dataclass
class QueryEngineConfig:
    max_tokens: int = 100_000          # total budget (input + output)
    max_rounds: int = 15               # max LLM round-trips
    diminishing_threshold: float = 0.3  # stop if output novelty < 30%
    plan_mode: bool = False            # require plan approval before tool execution

class QueryEngine:
    """Wraps agent.iter() with budget enforcement and interaction modes."""

    def __init__(self, agent: Agent, config: QueryEngineConfig, artifact_store: ArtifactStore):
        self.agent = agent
        self.config = config
        self.artifact_store = artifact_store
        self._round_count = 0
        self._total_tokens = 0

    async def run(self, prompt: str, deps: AgentDeps, ...) -> AsyncGenerator[SSEEvent]:
        """Main entry — yields SSE events while enforcing budget."""
```

**Integration point:** `agent.py` chat endpoint replaces direct `agent.iter()` with `QueryEngine.run()`. The QueryEngine internally calls `agent.iter()` but intercepts each node to:
1. Check token budget via `run.usage()` after each model request
2. Increment round counter
3. Detect diminishing returns (compare last output length/novelty)
4. In plan mode: after first model response, yield a `sse_plan` event and pause until user confirms

**PydanticAI compatibility:** QueryEngine does NOT subclass PydanticAI's Agent — it composes around `agent.iter()`. PydanticAI's `UsageLimits` can be passed to `agent.iter(usage_limits=...)` for hard limits; QueryEngine adds soft limits and interaction modes on top.

### 3. ArtifactStore — Session State Management

**Purpose:** Session-scoped key-value store for intermediate creation artifacts (clip segments, screenplay text, shot plans, generated image URLs, video URLs).

```python
class ArtifactStore:
    """Session-scoped artifact storage with Redis hot layer + DB cold persistence."""

    def __init__(self, session_id: str, redis: Redis | None = None):
        self.session_id = session_id

    async def put(self, key: str, value: Any, *, ttl: int = 3600) -> None:
        """Store artifact. Redis for hot access, DB for persistence."""

    async def get(self, key: str) -> Any | None:
        """Retrieve artifact. Check Redis first, fall back to DB."""

    async def list_keys(self, prefix: str = "") -> list[str]:
        """List artifact keys with optional prefix filter."""

    async def snapshot(self) -> dict[str, Any]:
        """Return compact summary of all artifacts (for context injection)."""
```

**Data model:** New `SessionArtifact` table:

```python
class SessionArtifact(Base):
    __tablename__ = "session_artifacts"
    id: str (PK)
    session_id: str (FK → agent_sessions.id)
    key: str            # e.g. "clips", "screenplay", "shot_plan.ep1"
    value_json: Text    # JSON-serialized value
    artifact_type: str  # "text" | "structured" | "media_ref"
    created_at: datetime
    updated_at: datetime
```

**Integration:** ArtifactStore instance is created per-session in `agent.py` chat endpoint and passed into QueryEngine. Skills access it via ToolInterceptor (automatic) or explicitly via SkillContext (manual).

### 4. ToolInterceptor — Automatic Artifact Injection/Persistence

**Purpose:** Pre/post hooks on every tool call to automatically:
- **Pre-call:** Inject relevant artifacts into tool params (e.g., inject `clips` from ArtifactStore into `script.convert_screenplay` params)
- **Post-call:** Persist tool output artifacts (e.g., save `screenplay` result into ArtifactStore)
- **Always:** Log cost data from the tool execution

```python
class ToolInterceptor:
    """Wraps SkillToolset.call_tool() with artifact injection and persistence."""

    def __init__(self, artifact_store: ArtifactStore, rules: list[InterceptRule]):
        self.store = artifact_store
        self.rules = rules

    async def before_call(self, tool_name: str, args: dict) -> dict:
        """Inject artifacts into args based on rules."""

    async def after_call(self, tool_name: str, args: dict, result: SkillResult) -> SkillResult:
        """Persist result artifacts based on rules."""
```

**Integration:** Modify `SkillToolset.call_tool()` to call `interceptor.before_call()` and `interceptor.after_call()` around the existing invocation. Rules are declarative — each SkillDescriptor can declare its artifact dependencies and outputs via the enhanced descriptor fields.

### 5. SkillDescriptor Enhancement

**Current fields:** name, display_name, description, category, input_schema, output_schema, triggers, execution_mode, celery_queue, estimated_duration, requires_canvas, requires_project.

**New fields:**

```python
@dataclass
class SkillDescriptor:
    # ... existing fields ...

    # NEW: Dependency declarations (NodeMeta-style)
    dependencies: list[str] = field(default_factory=list)
    # e.g. ["script.split_clips"] — skills that must run before this one

    # NEW: Execution mode semantics
    mode: str = "generate"
    # "generate" — creates new content
    # "transform" — modifies existing content
    # "query" — reads without side effects
    # "composite" — orchestrates multiple skills

    # NEW: Three-tier classification
    tier: str = "foundation"
    # "foundation" — generic capabilities (text gen, image gen)
    # "business" — domain-specific (script splitting, storyboard planning)
    # "workflow" — multi-skill orchestration (episode pipeline)

    # NEW: Artifact contract
    artifact_inputs: list[str] = field(default_factory=list)
    # Keys this skill reads from ArtifactStore, e.g. ["clips"]

    artifact_outputs: list[str] = field(default_factory=list)
    # Keys this skill writes to ArtifactStore, e.g. ["screenplay"]

    # NEW: Cost estimation
    cost_estimate: str = "low"
    # "low" (<$0.01) | "medium" ($0.01-$0.10) | "high" (>$0.10)

    # NEW: Admin toggleable
    enabled: bool = True
```

**Backward compatible:** All new fields have defaults, existing 14 skills continue working without changes. New fields are additive.

### 6. SubAgentTool — Child Agent Spawning

**Purpose:** Allow the main agent to spawn specialized child agents for complex subtasks (e.g., "create a full storyboard" spawns a storyboard specialist agent with focused tools and context).

```python
async def spawn_sub_agent(
    ctx: RunContext[AgentDeps],
    task_description: str,
    specialist_type: str,  # "storyboard" | "screenplay" | "visual"
    context_keys: list[str] | None = None,
) -> str:
    """Spawn a child agent for a specialized subtask.

    The child agent:
    - Gets a focused system prompt for its specialty
    - Has access to a scoped subset of tools (by category)
    - Shares the parent's ArtifactStore (reads parent artifacts, writes its own)
    - Has its own QueryEngine with a sub-budget
    - Returns result as a string summary + artifacts in store
    """
```

**Architecture:** NOT using the third-party `subagents-pydantic-ai` library — too early/unstable (v0.2.0 as of March 2026). Instead, implement as a simple PydanticAI `FunctionToolset` tool that:
1. Creates a new `Agent` via `AgentService` with filtered toolsets
2. Runs it with a child `QueryEngine` (sub-budget from parent)
3. Shares the parent's `ArtifactStore` (child writes go to `sub/{specialist_type}/` prefix)
4. Returns the child's final output as the tool result

**Integration:** Registered as a tool in a new `SubAgentToolset` (FunctionToolset), passed alongside SkillToolset/PipelineTools/ContextTools in `agent.iter()`.

### 7. Business Skill Expansion (7-Stage Pipeline)

The 7-stage creation pipeline maps to new skill packages:

| Stage | New Package | Skills | Tier |
|-------|------------|--------|------|
| 1. Story Workshop | `skills/story/` | `story.wash_text`, `story.split_segments`, `story.extract_climax`, `story.extract_themes` | business |
| 2. Import Episodes | `skills/import_ops/` | `import.create_episode`, `import.bulk_create_clips`, `import.assign_segments` | business |
| 3. Asset Extraction | `skills/asset_extract/` | `asset.extract_characters`, `asset.extract_scenes`, `asset.extract_props`, `asset.link_to_episode` | business |
| 4. Story-to-Script | `skills/screenplay/` | `screenplay.convert`, `screenplay.format_screenplay`, `screenplay.validate` | business |
| 5. Storyboard | `skills/storyboard_pipeline/` | `storyboard.plan_shots`, `storyboard.detail_shots`, `storyboard.generate_shot_images`, `storyboard.compose_board` | business |
| 6. Dialogue/Narration | `skills/dialogue/` | `dialogue.extract_lines`, `dialogue.assign_voice`, `dialogue.generate_tts` | business |
| 7. Video Generation | `skills/video_gen/` | `video.generate_clip`, `video.composite_episode`, `video.add_subtitles` | business |

Each skill follows the existing handler pattern: `async def handler(params: dict, ctx: SkillContext) -> SkillResult`. The key difference is they all use `UnifiedProviderResolver` instead of direct env key access.

### 8. Canvas-Chat Integration

**Current state:** Canvas (`BatchExecutionService`) and Chat (`agent.py` SSE) are separate systems with no cross-communication.

**Target:** Canvas chat panel can drive canvas operations through the agent, and the agent can read/modify canvas state.

**Implementation:**
1. Context tools already include `get_canvas_state` — extend with write tools:
   - `update_canvas_node(node_id, data)` — update node result/status
   - `add_canvas_node(type, position, data)` — create new node
   - `trigger_canvas_batch(node_ids)` — kick off batch execution
2. Agent session already has `canvas_id` — use it to scope canvas operations
3. Frontend: Canvas chat panel sends messages to the same `/api/v1/agent/chat/{session_id}` endpoint where the session's `canvas_id` is set
4. SSE events already support `tool_call` / `tool_result` — frontend can react to canvas-specific tool results to update the React Flow graph in real time

## Data Flow Changes

### Before (v2.x): Chat → Skill Flow

```
User message
  → agent.py SSE endpoint
    → AgentService.create_agent() [env key]
      → PydanticAI agent.iter()
        → SkillToolset.call_tool()
          → SkillRegistry.invoke()
            → sync: handler() [env key via get_provider_sync]
            → async: Celery run_skill_task → handler() [env key]
        → Return result to LLM
      → Stream text to client via SSE
```

### After (v3.0): Chat → QueryEngine → Skill Flow

```
User message
  → agent.py SSE endpoint
    → ArtifactStore(session_id)
    → UnifiedProviderResolver.resolve_pydantic_model() [DB key chain]
    → QueryEngine(agent, config, artifact_store)
      → QueryEngine.run()
        → agent.iter() [with budget limits]
          → ToolInterceptor.before_call() [inject artifacts]
            → SkillToolset.call_tool()
              → SkillRegistry.invoke()
                → handler() uses UnifiedProviderResolver [DB key chain]
          → ToolInterceptor.after_call() [persist artifacts]
          → Budget check after each round
        → Stream text + progress to client via SSE
    → Cost tracking persisted
```

### Canvas-Chat Data Flow (NEW)

```
Canvas Chat message
  → agent.py SSE endpoint (session has canvas_id)
    → QueryEngine.run()
      → Agent uses context tools to read canvas state
      → Agent uses canvas write tools to modify nodes
      → Agent uses skill tools to generate content
      → Agent uses trigger_canvas_batch to execute nodes
    → SSE events include canvas-specific tool results
    → Frontend updates React Flow graph from SSE events
```

## Patterns to Follow

### Pattern 1: Resolver-as-Service (for AI Call Convergence)

**What:** All AI provider instantiation goes through a single async service that implements the credential chain.

**When:** Any code needs an AI provider (LLM, Image, Video).

**Why:** Eliminates credential duplication, enables per-team key isolation, creates single point for cost tracking.

```python
# In skill handler:
async def handle_generate_image(params: dict, ctx: SkillContext) -> SkillResult:
    resolver = get_unified_resolver()
    provider = await resolver.resolve_image(
        "gemini", model, team_id=ctx.team_id, user_id=ctx.user_id, db=None
    )
    result = await provider.generate_image(prompt)
```

### Pattern 2: Artifact Contract via Descriptor

**What:** Each skill declares its artifact inputs/outputs in the SkillDescriptor, enabling automatic wiring by ToolInterceptor.

**When:** Skills that participate in multi-step pipelines.

```python
descriptor = SkillDescriptor(
    name="screenplay.convert",
    artifact_inputs=["clips"],        # reads clips from ArtifactStore
    artifact_outputs=["screenplay"],   # writes screenplay to ArtifactStore
    dependencies=["script.split_clips"],
    tier="business",
    mode="transform",
)
```

### Pattern 3: Compose Around agent.iter(), Don't Subclass

**What:** QueryEngine and other orchestration logic wrap PydanticAI's `agent.iter()` without extending Agent class.

**When:** Adding budget limits, artifact tracking, plan-mode interaction.

**Why:** PydanticAI's internal API changes between versions; composition is resilient.

```python
class QueryEngine:
    async def run(self, prompt, deps, toolsets, history):
        async with self.agent.iter(
            user_prompt=prompt, deps=deps,
            toolsets=toolsets, message_history=history,
            usage_limits=UsageLimits(total_tokens=self.config.max_tokens),
        ) as run:
            async for node in run:
                self._round_count += 1
                if self._round_count > self.config.max_rounds:
                    yield sse_budget_exceeded(...)
                    break
                # ... process node ...
```

### Pattern 4: Celery Context Propagation

**What:** Pass UnifiedProviderResolver context (team_id, user_id) through SkillContext serialization so Celery workers can resolve credentials.

**When:** Any async_celery skill needs AI provider access.

```python
# SkillContext already has team_id + user_id
# In Celery worker, UnifiedProviderResolver creates its own AsyncSession
resolver = get_unified_resolver()
provider = await resolver.resolve_llm(
    "gemini", "gemini-2.5-flash",
    team_id=ctx.team_id, user_id=ctx.user_id, db=None  # creates own session
)
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct settings.* Key Access in Skills

**What:** Skills reading `settings.GEMINI_API_KEY` directly to instantiate providers.

**Why bad:** Bypasses DB credential chain, breaks team-level key isolation, makes cost tracking impossible to centralize.

**Instead:** Always go through `UnifiedProviderResolver`. Even for the "simple case" of a single env key, the resolver handles it via the env fallback.

### Anti-Pattern 2: Extending PydanticAI Agent Class

**What:** Subclassing `pydantic_ai.Agent` to add budget/artifact tracking.

**Why bad:** PydanticAI's Agent internal API is evolving rapidly (toolset lifecycle hooks added March 2026). Subclassing creates tight coupling to internals.

**Instead:** Compose around `agent.iter()` — the iteration protocol is stable.

### Anti-Pattern 3: Storing Full Artifacts in LLM Context

**What:** Putting entire screenplay text, all shot details, or image URLs directly in conversation history.

**Why bad:** Context window explosion. A single episode's screenplay can be 10K+ tokens.

**Instead:** Store in ArtifactStore, inject summaries/references into context. Tools access full artifacts via ArtifactStore.get().

### Anti-Pattern 4: Mixing Sync and Async Provider Paths

**What:** Some code uses `get_provider_sync()`, other code uses `get_provider()` async.

**Why bad:** Sync path bypasses DB credential chain entirely. Creates two behavioral modes.

**Instead:** Deprecate `get_provider_sync()`. All paths go through async `UnifiedProviderResolver`. For Celery workers (sync context), use `loop.run_until_complete(resolver.resolve_*())` — matching the existing pattern in `skill_task.py`.

## Integration Points Summary

| # | Integration Point | What Changes | Touches |
|---|-------------------|-------------|---------|
| 1 | **agent_service.py** → UnifiedProviderResolver | `create_pydantic_model()` uses DB key chain | agent_service.py, unified_resolver.py |
| 2 | **agent.py** SSE endpoint → QueryEngine | Wrap `agent.iter()` with budget/round control | agent.py, query_engine.py |
| 3 | **agent.py** → ArtifactStore | Create per-session store, pass to QueryEngine | agent.py, artifact_store.py |
| 4 | **SkillToolset.call_tool()** → ToolInterceptor | Pre/post hooks for artifact injection/persistence | skill_toolset.py, tool_interceptor.py |
| 5 | **Skill handlers** → UnifiedProviderResolver | Replace `settings.*_API_KEY` with resolver calls | All skill handler files (14 existing + new) |
| 6 | **SkillDescriptor** → Enhanced fields | Add deps, mode, tier, artifact contract | descriptor.py, all skill registrations |
| 7 | **SkillContext** → Extended fields | Add artifact_store_id, parent_session_id | context.py, skill_task.py |
| 8 | **context_tools.py** → Write operations | Add update/create tools with permission checks | context_tools.py |
| 9 | **pipeline_tools.py** → Fix + Expand | Fix field mismatches, add 7-stage support | pipeline_tools.py |
| 10 | **agent.py** → SubAgentTool toolset | Add SubAgentToolset to toolsets list | agent.py, sub_agent_tool.py |
| 11 | **Canvas chat** → Agent session with canvas_id | Frontend sends to same chat endpoint | canvas.py (frontend), agent.py |
| 12 | **Admin skills API** → SkillRegistry | New CRUD endpoints for skill management | admin/skills.py, registry.py |
| 13 | **DB models** → SessionArtifact + AgentMemory | New tables for artifacts and memory | models/session_artifact.py, models/agent_memory.py |

## Suggested Build Order

The build order is driven by dependency analysis — each phase's outputs are inputs to the next.

```
Phase 1: AI Call Convergence (Foundation — unblocks everything)
├── UnifiedProviderResolver
├── Activate ProviderManager.get_provider() async path
├── Integrate Image/Video providers into resolver
└── Migrate agent_service.py to use resolver

Phase 2: SkillDescriptor Enhancement + Pipeline Fix
├── Add new SkillDescriptor fields (backward compatible)
├── Fix pipeline_tools.py field mismatches
├── Update existing 14 skill registrations with new metadata
└── Dependency validation in SkillRegistry.register()

Phase 3: ArtifactStore + ToolInterceptor
├── SessionArtifact DB model
├── ArtifactStore implementation (Redis hot + DB cold)
├── ToolInterceptor with declarative rules
└── Wire into SkillToolset.call_tool()

Phase 4: QueryEngine
├── QueryEngine implementation (budget, rounds, diminishing returns)
├── Plan-mode interaction
├── Wire into agent.py replacing direct agent.iter()
└── SSE budget/progress events

Phase 5: Business Skill Expansion (7-stage pipeline)
├── Skills for stages 1-3 (Story Workshop → Import → Asset Extract)
├── Skills for stages 4-5 (Screenplay → Storyboard)
├── Skills for stages 6-7 (Dialogue → Video Gen)
└── Updated pipeline_tools.py for full 7-stage chain

Phase 6: Context Tools + Canvas-Chat Integration
├── Write operations in context_tools.py
├── Canvas write tools (update_node, add_node, trigger_batch)
├── Permission checking
└── Frontend canvas chat panel integration

Phase 7: SubAgentTool + Workflow Skills
├── SubAgentTool implementation
├── WorkflowSkill (Markdown template-based pipelines)
├── Cross-session agent memory
└── Admin skill management page

Phase 8: Polish + Cost Tracking
├── Unified retry strategy
├── Context compression
├── Cost tracking aggregation + display
└── SSE tool progress events
```

**Phase ordering rationale:**
- **Phase 1 first** because every subsequent phase (skills, agent, sub-agents) needs the unified credential path
- **Phase 2 before 3** because ToolInterceptor rules depend on enhanced SkillDescriptor metadata
- **Phase 3 before 4** because QueryEngine uses ArtifactStore for state management
- **Phase 4 before 5** because new business skills need the QueryEngine's budget controls when invoked via agent
- **Phase 5 before 6** because canvas-chat needs business skills to drive creation workflows
- **Phase 6 before 7** because SubAgentTool needs write-capable context tools
- **Phase 8 last** because it's polish on top of working features

## Scalability Considerations

| Concern | At 10 users | At 1K users | At 10K users |
|---------|------------|-------------|--------------|
| ArtifactStore | SQLite + in-process dict | Redis + PostgreSQL | Redis cluster + PostgreSQL with partition |
| Celery queue depth | Single worker | 4 workers, 3 queues | Auto-scaling workers, priority queues |
| Agent sessions | In-memory history | DB-backed with 20-msg window | DB + Redis cache, aggressive summarization |
| Provider keys | 1 system key per provider | Team-level keys, rotation | Key pools with rate-limit tracking |
| Cost tracking | Log-level only | Per-session aggregation | Real-time budget enforcement + alerts |

## Sources

- Direct codebase analysis of Canvex repository (2026-04-02)
- [PydanticAI Toolsets documentation](https://ai.pydantic.dev/toolsets/) — AbstractToolset, for_run/for_run_step lifecycle hooks (HIGH confidence)
- [PydanticAI Usage API](https://ai.pydantic.dev/api/usage) — UsageBase, token tracking (HIGH confidence)
- [pydantic-ai-tool-budget package](https://pypi.org/project/pydantic-ai-tool-budget/) — third-party tool budget tracking (MEDIUM confidence)
- [Artifact Pattern for AI Agents](https://www.yess.ai/post/context-is-not-a-storage-unit) — artifact store pattern rationale (HIGH confidence)
- [subagents-pydantic-ai v0.2.0](https://github.com/vstorm-co/pydantic-ai-subagents) — evaluated but not recommended (too early, v0.2.0) (MEDIUM confidence)
- [Redis for Distributed Agent State](https://zylos.ai/research/2026-03-04-redis-session-stores-distributed-ai-agents) — Redis session store patterns (MEDIUM confidence)
