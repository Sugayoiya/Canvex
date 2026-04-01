# Technology Stack — v3.0 Agent System Upgrade

**Project:** Canvas Studio (Canvex)
**Researched:** 2026-04-02
**Scope:** Stack additions for Agent engine upgrade, AI call convergence, business skill expansion, canvas-chat workflow orchestration

## Baseline (DO NOT change)

Already validated and running. Listed for integration context only.

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| Runtime | Python | ≥3.13 | Backend runtime |
| API | FastAPI | ≥0.115 | HTTP/SSE endpoints |
| ORM | SQLAlchemy (async) | ≥2.0.46 | Database layer |
| Queue | Celery + Redis | ≥5.4 | Async skill execution |
| Agent | pydantic-ai-slim[google,openai,xai] | ≥1.73 | Agent orchestration |
| AI SDKs | google-genai ≥1.14, openai ≥2.16 | — | Provider clients |
| SSE | sse-starlette | ≥3.3 | Server-sent events |
| Logging | structlog | ≥24.4 | Structured logging |
| Frontend | Next.js 16, React 19, Zustand, TanStack Table | — | UI layer |

---

## Recommended Stack Additions

### 1. PydanticAI Upgrade: 1.73 → ≥1.75

**Why:** v1.71 introduced the **Capabilities API** — composable, reusable units bundling tools + hooks + instructions + model settings. This is the canonical pattern for QueryEngine (usage limits), SubAgentTool (delegation), and context compression (history processors). v1.75 is the latest stable (2026-03-31).

**What changes:**
- `UsageLimits(request_limit=N, total_tokens_limit=N, tool_calls_limit=N)` — native token budget enforcement for QueryEngine, no external library needed
- `history_processors=[...]` — native hook point for context compression
- `capabilities=[...]` — composable agent behavior units
- Agent delegation via `@parent.tool` + `ctx.usage` passthrough — native SubAgentTool pattern

**Action:** Bump `pyproject.toml` from `>=1.73.0` to `>=1.75.0`.

```toml
"pydantic-ai-slim[google,openai,xai]>=1.75.0",
```

| Confidence | HIGH |
|------------|------|
| Source | Official PydanticAI docs + GitHub releases v1.71–v1.75 |

---

### 2. Context Compression: `summarization-pydantic-ai`

**Why:** Long conversations in the chat sidebar currently truncate at `max_messages=20` (hard cutoff in `load_message_history`). This loses context. The project needs intelligent summarization that preserves intent while reducing tokens.

**Package:** `summarization-pydantic-ai>=0.1.2`

**Why this over alternatives:**
| Library | Verdict | Reason |
|---------|---------|--------|
| **summarization-pydantic-ai** | ✅ USE | Built specifically for PydanticAI. Uses Capabilities API (`ContextManagerCapability`) or `history_processors`. Handles tool-call pair safety, sliding window + LLM summarization, real-time token tracking. Zero integration friction. |
| kompact | ❌ SKIP | HTTP proxy approach — overkill for our architecture. We don't need a transparent proxy; we control the agent directly. |
| context-compress (cctx) | ❌ SKIP | General-purpose compression. Doesn't understand PydanticAI message types or tool-call pairing. Would require manual adapter code. |
| compresr | ❌ SKIP | External SaaS service. Adds network dependency and data-residency concerns. |

**Integration pattern:**
```python
from summarization_pydantic_ai import ContextManagerCapability

agent = Agent(
    model,
    deps_type=AgentDeps,
    capabilities=[
        ContextManagerCapability(max_tokens=100_000),
    ],
)
```

Or lower-level for custom trigger:
```python
from summarization_pydantic_ai import create_summarization_processor

processor = create_summarization_processor(
    trigger=("tokens", 120_000),
    keep=("messages", 20),
)
agent = Agent(model, history_processors=[processor])
```

**Optional extra:** `pip install summarization-pydantic-ai[tiktoken]` for accurate token counting (vs. character-based estimation).

```toml
"summarization-pydantic-ai[tiktoken]>=0.1.2",
```

| Confidence | MEDIUM |
|------------|--------|
| Source | PyPI v0.1.2 + Vstorm OSS docs. Library is young (Feb 2026) but from the same team as subagents-pydantic-ai which is actively maintained. |

---

### 3. Cost Tracking: `genai-prices`

**Why:** PydanticAI tracks token counts (`result.usage()` → `input_tokens`, `output_tokens`) but explicitly does NOT compute monetary cost. The project needs cost aggregation for the Admin dashboard and user billing.

**Package:** `genai-prices>=0.0.56`

**Why this over alternatives:**
| Library | Verdict | Reason |
|---------|---------|--------|
| **genai-prices** | ✅ USE | Maintained by Pydantic team. PydanticAI is migrating to use it internally (`RequestUsage.extract()`). Covers 30+ providers / 1600+ models. Handles historic pricing, tiered pricing (Gemini large context), variable pricing (DeepSeek off-peak). |
| llm-tokencost | ❌ SKIP | Third-party; overlapping coverage. genai-prices is the PydanticAI ecosystem choice. |
| tokenr / llmwatch | ❌ SKIP | Auto-instrumentation approach (monkey-patching SDKs). Conflicts with our explicit PydanticAI provider flow. |

**Integration pattern:**
```python
from genai_prices import Usage, calc_price

usage = result.usage()
price = calc_price(
    Usage(input_tokens=usage.input_tokens, output_tokens=usage.output_tokens),
    model_ref=model_name,      # e.g. "gemini-2.5-flash"
    provider_id=provider_slug,  # e.g. "google"
)
# price.total → Decimal cost in USD
```

Store `price.total` alongside existing `input_tokens`/`output_tokens` in `AgentMessage` and `AgentSession`.

```toml
"genai-prices>=0.0.56",
```

| Confidence | HIGH |
|------------|------|
| Source | Official Pydantic repo (github.com/pydantic/genai-prices), PyPI, PydanticAI issue #1443 + #4818 |

---

### 4. Token Counting: `tiktoken`

**Why:** QueryEngine token budget enforcement needs fast, accurate pre-call token counting to decide "can I fit this in context?" before sending to the LLM. `tiktoken` is 3-6x faster than alternatives and is the de facto standard.

**Package:** `tiktoken>=0.12.0`

**Note:** Also pulled in by `summarization-pydantic-ai[tiktoken]` extra. Listing explicitly because QueryEngine needs it independently for budget checks.

**Scope:** OpenAI/DeepSeek tokenization uses `cl100k_base`/`o200k_base` encodings natively. For Gemini models, tiktoken gives an approximation (within ~5%), which is sufficient for budget enforcement — the exact count comes back in `result.usage()` anyway.

```toml
"tiktoken>=0.12.0",
```

| Confidence | HIGH |
|------------|------|
| Source | Official OpenAI repo, 17.7K GitHub stars, v0.12.0 March 2026 |

---

### 5. SubAgentTool: Native PydanticAI Delegation (NO new library)

**Why:** PydanticAI v1.71+ has first-class agent delegation. A parent agent calls a delegate agent from within a `@tool` function, passing `ctx.usage` for unified tracking. This is exactly what SubAgentTool needs — no external framework required.

**Why NOT `subagents-pydantic-ai`:**
| Option | Verdict | Reason |
|--------|---------|--------|
| Native PydanticAI delegation | ✅ USE | Zero dependencies. `ctx.usage` passthrough. `UsageLimits` enforce total budget. Proven pattern in official docs. |
| subagents-pydantic-ai | ❌ SKIP | Adds unnecessary abstraction layer. Its "SubAgentCapability" auto-registers delegation tools and injects system prompts — we need explicit control over which skills a sub-agent gets. Our SkillToolset already bridges skills to tools; wrapping it in another framework adds indirection. |

**Implementation pattern:**
```python
specialist_agent = Agent(
    model,
    deps_type=AgentDeps,
    instructions="You are a storyboard specialist...",
    toolsets=[SkillToolset(registry, context, categories=["STORYBOARD"])],
)

@parent_agent.tool
async def delegate_storyboard(ctx: RunContext[AgentDeps], task: str) -> str:
    result = await specialist_agent.run(task, deps=ctx.deps, usage=ctx.usage)
    return result.output
```

| Confidence | HIGH |
|------------|------|
| Source | Official PydanticAI multi-agent docs, verified pattern |

---

### 6. ArtifactStore: PostgreSQL JSON + SQLAlchemy (NO new library)

**Why:** Session-level artifacts (generated scripts, storyboards, images) need persistence across tool calls within a session and optional cross-session access. The existing `AgentMessage.tool_results_json` partially does this but lacks structured querying and lifecycle management.

**Approach: New SQLAlchemy model, not a separate store.**

The existing stack (PostgreSQL + SQLAlchemy async + JSON columns) already handles this. Adding a dedicated `AgentArtifact` model with proper indexes is simpler and more maintainable than introducing a document store.

**Why NOT external stores:**
| Option | Verdict | Reason |
|--------|---------|--------|
| New SQLAlchemy model | ✅ USE | Consistent with existing patterns. Transactional with session data. No new infrastructure. JSON column for flexible artifact data. |
| Redis (artifact cache) | ❌ SKIP | Redis is already in the stack for Celery broker. Using it as artifact store mixes concerns and adds data-loss risk (eviction). Artifacts need persistence. |
| MongoDB / S3 | ❌ SKIP | Over-engineering. Artifact payloads (JSON dicts, text) fit comfortably in PostgreSQL JSON columns. Binary artifacts (images) are already handled by the file upload system. |

**Schema sketch:**
```python
class AgentArtifact(Base):
    __tablename__ = "agent_artifacts"
    id: Mapped[str]            # UUID PK
    session_id: Mapped[str]    # FK → agent_sessions
    artifact_type: Mapped[str] # "script" | "storyboard" | "character_sheet" | ...
    artifact_key: Mapped[str]  # Unique within session, e.g. "episode_3_script"
    data: Mapped[dict]         # JSON payload
    metadata: Mapped[dict]     # Source skill, version, dependencies
    created_at: Mapped[datetime]
```

**ToolInterceptor** is a wrapper around `SkillToolset.call()` that auto-persists `SkillResult.artifacts` into `AgentArtifact` and auto-injects prior artifacts into context. This is pure application code — no library needed.

| Confidence | HIGH |
|------------|------|
| Source | Architecture follows existing codebase patterns (AgentSession, AgentMessage) |

---

### 7. Cross-Session Memory: SQLAlchemy + PydanticAI `message_history` (NO new library)

**Why:** PydanticAI has no built-in cross-session memory (confirmed by RFC #4773, still unmerged). The existing `AgentSession` + `AgentMessage` tables already store message history with `pydantic_ai_messages_json` serialization. Cross-session memory = querying prior session summaries and injecting them as system prompt context.

**Why NOT external memory libraries:**
| Option | Verdict | Reason |
|--------|---------|--------|
| Custom SQLAlchemy query | ✅ USE | We already persist all messages. "Memory" = query recent session summaries + inject into system prompt. Context compression (item #2) generates summaries that serve as memory. |
| hindsight-pydantic-ai | ❌ SKIP | Adds a knowledge graph / entity extraction layer. Impressive but massive overkill for our use case. We need "what happened in prior sessions" not "build a semantic knowledge base." |
| AbstractMemoryStore RFC | ❌ WAIT | Still an open RFC (#4773). Not shipped. When PydanticAI ships it, adopt. Until then, our SQLAlchemy approach is compatible with the proposed interface. |

**Implementation approach:**
1. Context compression generates a summary for each session (stored in `AgentSession.summary` — new column).
2. On new session start, query the N most recent session summaries for the same project.
3. Inject as system prompt prefix: "Previous session context: ..."
4. If/when PydanticAI ships `AbstractMemoryStore`, implement adapter over our `AgentSession` table.

| Confidence | MEDIUM |
|------------|--------|
| Source | PydanticAI RFC #4773 (unmerged), existing codebase patterns |

---

### 8. QueryEngine: Custom Layer on PydanticAI Primitives (NO new library)

**Why:** QueryEngine = token budget + turn limits + diminishing detection + plan-then-execute mode. PydanticAI provides the primitives (`UsageLimits`, `result.usage()`, `history_processors`). The orchestration logic is application-specific.

**Components map to PydanticAI features:**

| QueryEngine Feature | PydanticAI Primitive | Custom Code Needed |
|---------------------|---------------------|-------------------|
| Token budget | `UsageLimits(total_tokens_limit=N)` | Config layer only |
| Turn limits | `UsageLimits(request_limit=N)` | Config layer only |
| Diminishing detection | `result.usage()` per-turn deltas | Custom: track output quality/length trends |
| Plan-then-execute | Two-phase `agent.run()` | Custom: planner agent → executor agent delegation |

**No external library needed.** This is an orchestration class that wraps `agent.run()` calls with budget tracking, turn counting, and early termination logic.

| Confidence | HIGH |
|------------|------|
| Source | PydanticAI UsageLimits API docs |

---

### 9. AI Call Convergence: ProviderManager Refactor (NO new library)

**Why:** Three separate AI call stacks exist today:
- **(A)** PydanticAI agent uses `create_pydantic_model()` with `settings.GEMINI_API_KEY` env var
- **(B)** ProviderManager uses DB-backed credentials with Fernet encryption + round-robin
- **(C)** Gemini Image/Video uses raw `google-genai` SDK with env keys

Convergence = make (A) and (C) use ProviderManager's DB credential chain.

**No new libraries.** This is a refactoring task:
1. `create_pydantic_model()` calls `ProviderManager.get_provider()` instead of reading `settings.*` directly
2. Image/video skills get credentials from ProviderManager instead of env vars
3. Dead code path `get_provider()` in DB becomes the live path

**One integration point:** PydanticAI model constructors (`OpenAIModel`, `GoogleModel`) accept `provider=OpenAIProvider(api_key=key)`. ProviderManager resolves the key → pass it to the PydanticAI provider constructor. Clean seam, no adapter library needed.

| Confidence | HIGH |
|------------|------|
| Source | Existing codebase analysis (agent_service.py, provider_manager.py) |

---

### 10. SkillDescriptor Enhancement: Dataclass Extension (NO new library)

**Why:** Current `SkillDescriptor` lacks dependency declaration, mode parameter, and 3-tier classification. This is a dataclass field addition.

**Changes to existing `SkillDescriptor`:**
```python
@dataclass
class SkillDescriptor:
    # ... existing fields ...

    # NEW: v3.0 enhancements
    dependencies: list[str] = field(default_factory=list)  # Other skill names this depends on
    mode: str = "default"  # "default" | "planning" | "execution" | "analysis"
    tier: str = "standard"  # "core" | "standard" | "experimental"
    input_artifacts: list[str] = field(default_factory=list)   # Artifact types consumed
    output_artifacts: list[str] = field(default_factory=list)  # Artifact types produced
```

Pure dataclass evolution. No library.

| Confidence | HIGH |
|------------|------|
| Source | Existing descriptor.py analysis |

---

## What NOT to Add

| Temptation | Why Skip |
|------------|----------|
| LangChain / LangGraph | PydanticAI already provides agent + tools + delegation + graph. Adding LangChain introduces a competing abstraction with massive dependency tree. |
| subagents-pydantic-ai | Native PydanticAI delegation is sufficient. This library auto-injects behavior we need to control explicitly. |
| hindsight-pydantic-ai | Knowledge graph memory is overkill. Session summaries + system prompt injection covers our cross-session needs. |
| Vector database (Pinecone/Weaviate/Chroma) | No semantic search requirement in scope. Artifact lookup is by session_id + artifact_key, not embedding similarity. |
| LiteLLM | ProviderManager already handles multi-provider routing. LiteLLM would be a competing proxy layer. |
| MongoDB / DynamoDB | PostgreSQL JSON columns handle artifact storage. No need for a document store. |
| Separate caching layer (memcached) | Redis is already available for Celery. If caching needed, use Redis directly — but artifact persistence belongs in PostgreSQL. |
| pydantic-ai-tool-budget | Provides per-tool budget reminders. Nice idea, but our QueryEngine needs session-level budget control, which PydanticAI's `UsageLimits` already handles. |

---

## Final Dependency Diff

Only **3 new packages** added to `pyproject.toml`:

```toml
# In pyproject.toml [project.dependencies]:

# UPGRADE (existing)
"pydantic-ai-slim[google,openai,xai]>=1.75.0",  # was >=1.73.0

# NEW
"summarization-pydantic-ai[tiktoken]>=0.1.2",    # Context compression + token counting
"genai-prices>=0.0.56",                           # Cost calculation per model/provider
"tiktoken>=0.12.0",                               # Fast token counting for budget enforcement
```

**Note:** `tiktoken` is also pulled in by `summarization-pydantic-ai[tiktoken]` extra, but listed explicitly because QueryEngine imports it independently.

### Installation

```bash
cd api
uv add "pydantic-ai-slim[google,openai,xai]>=1.75.0" "summarization-pydantic-ai[tiktoken]>=0.1.2" "genai-prices>=0.0.56" "tiktoken>=0.12.0"
```

---

## Integration Map

How new additions connect to existing stack:

```
┌──────────────────────────────────────────────────┐
│  Frontend (Next.js / React / Zustand)            │
│  - Admin skill management page (new)             │
│  - Cost dashboard (extend existing)              │
│  - SSE tool progress events (extend existing)    │
└─────────────────────┬────────────────────────────┘
                      │ HTTP / SSE
┌─────────────────────▼────────────────────────────┐
│  FastAPI Endpoints                                │
│  - /api/v1/agent/chat (existing, enhanced)       │
│  - /api/v1/admin/skills (new)                    │
└─────────────────────┬────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────┐
│  QueryEngine (NEW — custom class)                │
│  ├─ UsageLimits (PydanticAI native)              │
│  ├─ Turn counter (custom)                        │
│  ├─ Diminishing detector (custom)                │
│  └─ Plan-then-execute mode (agent delegation)    │
└─────────────────────┬────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────┐
│  PydanticAI Agent ≥1.75                          │
│  ├─ SkillToolset (existing, enhanced)            │
│  ├─ ContextManagerCapability (NEW — summarizati… │
│  ├─ SubAgentTool (native delegation via @tool)   │
│  └─ ToolInterceptor → ArtifactStore (custom)     │
└──────┬──────────────┬────────────────────────────┘
       │              │
       │   ┌──────────▼─────────────────────────┐
       │   │  ProviderManager (CONVERGED)        │
       │   │  DB key chain: team→personal→sys→env│
       │   │  ├─ PydanticAI models (path A)      │
       │   │  ├─ LLM skills (path B)             │
       │   │  └─ Image/Video skills (path C)     │
       │   └──────────┬─────────────────────────┘
       │              │
┌──────▼──────────────▼─────────────────────────┐
│  SkillRegistry (existing, enhanced descriptors)│
│  ├─ dependencies: list[str]                    │
│  ├─ mode: planning | execution | analysis      │
│  ├─ tier: core | standard | experimental       │
│  └─ input_artifacts / output_artifacts         │
└──────┬────────────────────────────────────────┘
       │
┌──────▼────────────────────────────────────────┐
│  Celery + Redis (unchanged)                    │
│  Queues: ai_generation | media_processing |    │
│          pipeline | quick                      │
└───────────────────────────────────────────────┘
       │
┌──────▼────────────────────────────────────────┐
│  PostgreSQL / SQLite                           │
│  EXISTING: AgentSession, AgentMessage          │
│  NEW: AgentArtifact (session artifacts)        │
│  NEW: AgentSession.summary (compression output)│
│  NEW: AgentMessage.cost_usd (genai-prices)     │
└───────────────────────────────────────────────┘
```

---

## Database Schema Additions

No new infrastructure. Only new columns/tables in existing PostgreSQL:

| Change | Type | Purpose |
|--------|------|---------|
| `agent_artifacts` table | NEW TABLE | Session-level artifact persistence |
| `agent_sessions.summary` | NEW COLUMN (Text) | Compressed session summary for cross-session memory |
| `agent_messages.cost_usd` | NEW COLUMN (Numeric) | Per-message cost from genai-prices |
| `agent_sessions.total_cost_usd` | NEW COLUMN (Numeric) | Aggregated session cost |

Auto-migrated via existing `_auto_migrate_columns()` pattern. No Alembic needed.

---

## Sources

| Item | Source | Confidence |
|------|--------|------------|
| PydanticAI v1.75 features | [GitHub releases](https://github.com/pydantic/pydantic-ai/releases/tag/v1.75.0) | HIGH |
| PydanticAI UsageLimits | [Official docs](https://ai.pydantic.dev/api/usage) | HIGH |
| PydanticAI multi-agent delegation | [Official docs](https://ai.pydantic.dev/multi-agent-applications/) | HIGH |
| PydanticAI no built-in cost calc | [Issue #1443](https://github.com/pydantic/pydantic-ai/issues/1443) | HIGH |
| PydanticAI AbstractMemoryStore RFC | [Issue #4773](https://github.com/pydantic/pydantic-ai/issues/4773) | MEDIUM (unmerged) |
| genai-prices | [PyPI v0.0.56](https://pypi.org/project/genai-prices/), [GitHub](https://github.com/pydantic/genai-prices) | HIGH |
| summarization-pydantic-ai | [PyPI v0.1.2](https://pypi.org/project/summarization-pydantic-ai/), [Vstorm OSS](https://oss.vstorm.co/projects/summarization-pydantic-ai/) | MEDIUM |
| tiktoken | [PyPI v0.12.0](https://pypi.org/project/tiktoken/), [GitHub](https://github.com/openai/tiktoken) | HIGH |
| subagents-pydantic-ai (rejected) | [GitHub](https://github.com/vstorm-co/pydantic-ai-subagents) | N/A |
