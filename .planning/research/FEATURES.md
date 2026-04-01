# Feature Landscape

**Domain:** AI Agent System Upgrade for Short-Film Creation Workbench  
**Researched:** 2026-04-02  
**Existing platform:** Canvex — PydanticAI agent + 14 Skills + SkillRegistry/Celery + SSE chat + 7-stage creation pipeline  
**Focus:** Agent engine upgrade, AI call convergence, business skill expansion, canvas-chat driven workflow orchestration

---

## Table Stakes

Features users/operators **expect** in a production agent-driven creative platform. Missing = system feels broken or toy-grade.

### 1. Unified AI Call Path (AI Call Convergence)

| Aspect | Detail |
|--------|--------|
| **Why Expected** | 3 separate AI call stacks (PydanticAI+settings, ProviderManager sync, raw Gemini env key) is a maintenance/security liability. Every production agent system routes through a single provider abstraction. |
| **Complexity** | Medium — refactoring existing call sites, not greenfield |
| **Dependencies** | Existing `ProviderManager`, `LLMProviderBase`, `create_pydantic_model()` in `agent_service.py`. Dead-code `get_provider` DB async path needs resurrection. |
| **What "done" looks like** | Single `ProviderManager.resolve()` async path used by Agent, text skills, image/video skills. DB key chain (team→personal→system→env) active in runtime, not dead code. PydanticAI agent uses resolved credentials, not `settings.GEMINI_API_KEY` directly. |
| **Industry pattern** | PydanticAI Gateway offers unified multi-provider routing with FallbackModel chains. LangChain/LiteLLM similarly abstract provider selection behind a single interface. This is *the* most basic architectural hygiene. |

**Confidence: HIGH** — PydanticAI docs confirm `FallbackModel` + provider abstraction as first-class. Every serious agent platform converges on single-path provider resolution.

### 2. Token Budget & Turn Limits (QueryEngine Core)

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Without token budgets, a single agent loop can burn $2.80 on a "simple" task (70× variance observed in production agentic systems). Users expect cost-bounded interactions. |
| **Complexity** | Medium — PydanticAI provides `UsageLimits(tool_calls_limit=N)` natively. Token tracking via `UsageBase` dataclass. Per-tool limits landing in 2026-04 milestone (Issue #3352). |
| **Dependencies** | PydanticAI's `usage` module, existing `AgentDeps`, `SkillContext.trace_id`. |
| **What "done" looks like** | Configurable per-session token ceiling; hard turn limit (e.g. 20 iterations); diminishing-returns detection (if last 3 turns produced no new artifacts, suggest stopping); budget remainder visible in SSE stream. |
| **Industry pattern** | LangGraph uses validated Pydantic state with rolling-window compression every 5 steps. `pydantic-ai-tool-budget` community package injects remaining-call counts into system prompt so model plans gracefully. |

**Confidence: HIGH** — PydanticAI native `UsageLimits` confirmed in docs + per-tool limits in active development.

### 3. Unified Retry & Error Classification

| Aspect | Detail |
|--------|--------|
| **Why Expected** | LLM APIs fail 1-5% of the time. Without unified retry, each skill implements its own error handling (or none). Agents achieve only 60% success without resilience engineering. |
| **Complexity** | Low-Medium — error classifier + exponential backoff with jitter + circuit breaker. Standard pattern. |
| **Dependencies** | `ProviderManager`, `SkillRegistry.invoke()`, Celery task error handling. |
| **What "done" looks like** | Error classifier: 429→retry with Retry-After, 500-504→backoff, 400→fail fast, 529→long backoff. Circuit breaker per provider (open after 50% failures in 1min). FallbackModel chain: primary→cheaper→graceful error. All behind `ProviderManager`, invisible to skills. |
| **Industry pattern** | AWS research shows exponential backoff+jitter reduces retry storms by 60-80%. PydanticAI `FallbackModel` supports configurable exception triggers. Every enterprise agent framework (LangGraph, AG2, CrewAI) implements this. |

**Confidence: HIGH** — Thoroughly documented production pattern with PydanticAI native support.

### 4. SSE Tool Progress Events

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Existing SSE chat streams text deltas, but tool execution (especially Celery async skills taking 10s-2min) shows no progress. Users see blank gaps. n8n, Stratus, inference.sh all stream tool progress as standard. |
| **Complexity** | Low-Medium — extend existing `sse_protocol.py` with `tool_call_start`, `tool_call_end`, `tool_progress` event types. Wire Celery status polling into SSE stream. |
| **Dependencies** | Existing `sse_protocol.py`, `SkillResult.progress`, Celery `AsyncResult.state`. |
| **What "done" looks like** | When agent calls a skill: `{event: "tool_call_start", skill: "visual.generate_image"}` → periodic `{event: "tool_progress", progress: 0.6}` → `{event: "tool_call_end", result_summary: "..."}`. Frontend renders live skill execution status. |
| **Industry pattern** | n8n PR #20499 added `node-execute-before`/`node-execute-after` SSE events. Agentend.ai defines typed event protocol. This is now expected UX for any agent with long-running tools. |

**Confidence: HIGH** — Clear pattern, existing SSE infrastructure to extend.

### 5. Cost Tracking & Attribution

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Multi-tenant platform with team billing. A single prompt can trigger 2-30+ LLM calls. Without per-request cost attribution, billing is guesswork. Existing quota system needs actual metering data. |
| **Complexity** | Medium — instrument `ProviderManager` with token counting, attribute to user/team/session/skill. Store in DB, surface in admin dashboard. |
| **Dependencies** | Unified AI call path (Feature #1), existing `QuotaService`, `AdminAuditLog`, `ai_call_logger.py`. |
| **What "done" looks like** | Every AI call logged with: input_tokens, output_tokens, model, provider, cost_usd, user_id, team_id, skill_name, session_id. Aggregated in admin monitoring. User-facing "this session cost $X" in chat sidebar. |
| **Industry pattern** | Grepture, Stripe Token Meter, Meter.dev all provide per-request attribution. State management costs noted as "silent margin killer" often overlooked. |

**Confidence: HIGH** — Existing `ai_call_logger.py` provides foundation. Token counting is well-documented for all major providers.

### 6. Context Tools Write Operations + Permission Control

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Current 4 context tools are read-only (`get_project_characters`, etc.). Agent cannot create/update entities, making it useless for the "chat drives creation" promise. But write tools without permission gates are a security risk. |
| **Complexity** | Medium — add CRUD tools (create_character, update_shot, etc.) with permission enforcement matching existing `deps.py` RBAC (team role checks, project access resolution). |
| **Dependencies** | Existing `context_tools.py`, `deps.py` permission system, SQLAlchemy models. |
| **What "done" looks like** | Write tools: `create_character`, `update_character`, `create_shot`, `update_shot`, `create_scene`, `update_scene`, `import_episode_data`, etc. Each tool enforces: (1) project_id ownership, (2) team role ≥ editor, (3) audit logging. |
| **Industry pattern** | Every production agent with side effects implements tool-level permission gates. PolicyLayer/Intercept blocks tools at transport layer, not via prompts. AG2 uses context-based conditions for deterministic access control. |

**Confidence: HIGH** — Standard CRUD wrapping with existing permission infrastructure.

### 7. Business Skill Expansion (7-Stage Pipeline → 30+ Skills)

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Core product value is AI-driven short-film creation. Only 14 of the needed 30+ skills exist. The 7-stage pipeline (Story Workshop → Video Generation) has dedicated services but they're not skillized — agent can't invoke them. |
| **Complexity** | High — each pipeline stage needs 2-5 skill wrappers around existing service methods. Field name mismatches between `pipeline_tools.py` and skill handlers need fixing. Celery async chaining needs repair. |
| **Dependencies** | Existing `TextWorkshopService`, `StoryToScriptService`, `ScriptToStoryboardService`, `VoiceAnalysisService`, `VideoGenerationService`. Pipeline field-name bug documented in PROJECT.md. |
| **What "done" looks like** | All 7 stages fully skillized: text.workshop_refine, text.highlight_extraction, text.story_divide, import.create_episode, extract.characters_v2, extract.scenes_v2, script.story_to_script, storyboard.pipeline, voice.analyze_dialogue, voice.analyze_narration, video.generate_clip, video.compose_episode, etc. Pipeline chain works end-to-end via Celery. |
| **Industry pattern** | SkillOrchestra (2026) models skill-level competence and cost. Glif 2.0 wraps 100+ tools as invokable skills through single chat interface. The pattern is: wrap every business capability as a discoverable, invokable, composable skill. |

**Confidence: HIGH** — Services already exist; this is wrapping + fixing, not invention.

### 8. Pipeline Parameter Alignment + Celery Async Fix

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Documented bug: `pipeline_tools.py` has field name mismatches with skill handlers; Celery async return not properly awaited in chain. Pipeline is broken for multi-step workflows. |
| **Complexity** | Low-Medium — fix parameter mapping in `_chain_params()`, fix Celery chain async awaiting. |
| **Dependencies** | `pipeline_tools.py`, Celery task results, `SkillRegistry.invoke()`. |
| **What "done" looks like** | `run_episode_pipeline` successfully chains all steps. Celery results properly awaited between steps. Output of step N correctly feeds input of step N+1 without field name mismatches. |

**Confidence: HIGH** — Bug is documented and understood; fix is mechanical.

---

## Differentiators

Features that **set Canvex apart** from generic agent platforms. Not expected, but highly valued by creative production teams.

### 9. ArtifactStore + ToolInterceptor

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Session-scoped artifact repository that auto-captures skill outputs (generated images, scripts, character sheets) and auto-injects them into subsequent tool calls. Eliminates "re-explain what you just made" friction. |
| **Complexity** | Medium-High — session-scoped key-value store with typed artifacts (text, image, JSON, file-ref), versioning, interceptor hooks on `SkillRegistry.invoke()` pre/post. |
| **Dependencies** | `SkillResult.artifacts` field (already exists), `SkillContext.agent_session_id`, DB session model. |
| **What "done" looks like** | After `visual.generate_image` completes, the generated image URL is auto-stored as `artifact:session:image:char_alice_01`. Next `storyboard.detail` call auto-receives relevant artifacts in context. ToolInterceptor wraps every `invoke()`: pre-hook injects relevant artifacts, post-hook persists new ones. |
| **Industry pattern** | Google ADK-TS implements named, versioned binary artifact storage scoped to session or user. `InMemoryArtifactService` → `saveArtifact()`/`loadArtifact()` via `CallbackContext`. This is the emerging standard for stateful agent systems. |

**Confidence: MEDIUM** — Pattern well-documented in ADK-TS. Custom implementation needed since PydanticAI doesn't have this natively.

### 10. SkillDescriptor Enhancement (NodeMeta Dependencies + Mode + 3-Tier Classification)

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Skills declare their dependencies (`requires: [extract.characters]`), supported modes (`mode: "quick" | "detailed"`), and 3-tier classification (atomic → composite → workflow). Enables intelligent skill selection, DAG-based orchestration, and admin management. |
| **Complexity** | Low-Medium — extend existing `SkillDescriptor` dataclass with `requires`, `mode_params`, `tier` fields. Update `SkillRegistry.discover()` to support dependency-aware discovery. |
| **Dependencies** | Existing `SkillDescriptor`, `SkillRegistry`. |
| **What "done" looks like** | `SkillDescriptor` gains: `requires: list[str]` (dependency skills), `provides: list[str]` (output artifact types), `modes: dict[str, ModeConfig]`, `tier: "atomic" | "composite" | "workflow"`. Registry can resolve dependency DAG. Agent system prompt auto-describes skill capabilities including dependency info. |
| **Industry pattern** | SkillOrchestra models per-skill competence and cost. OrionOmega uses topological sort for parallel DAG execution. Declarative graph engines define dependencies as JSON. The trend is: skills are nodes in a DAG, not flat lists. |

**Confidence: HIGH** — Extends existing dataclass. DAG topological sort is well-understood.

### 11. "Plan Then Execute" Interaction Mode

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Agent first proposes a plan (which skills in what order, estimated cost/time), user approves/edits, then agent executes. Crucial for expensive creative workflows where a wrong plan wastes $5+ in API calls. |
| **Complexity** | Medium — new agent interaction mode: (1) planning prompt generates structured plan JSON, (2) plan sent to user via SSE for approval, (3) approved plan executed step-by-step with progress. |
| **Dependencies** | QueryEngine token budget (Feature #2), SkillDescriptor dependencies (Feature #10), SSE tool progress (Feature #4). |
| **What "done" looks like** | User says "Create a storyboard for episode 3". Agent responds with plan: "Step 1: extract characters (est. 15s, $0.02) → Step 2: extract scenes (est. 15s, $0.02) → Step 3: story_to_script (est. 30s, $0.05) → Step 4: storyboard.plan (est. 60s, $0.08). Total: ~$0.17, ~2min. Approve?" User clicks approve. Agent executes with live progress. |
| **Industry pattern** | Plan-and-Execute is one of 6 standard agent architecture patterns (2026). Handles 5+ step tasks more reliably than ReAct. LangGraph, Reactive Agents, and OrionOmega all support it. Requires 14B+ parameter models. |

**Confidence: HIGH** — Well-documented pattern. PydanticAI doesn't have it natively but it's straightforward to implement as a custom interaction loop.

### 12. Context Compression (Rolling Summary Memory)

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Long creative sessions easily exceed context windows. Compression keeps agent functional across 50+ turn conversations by summarizing older turns while preserving executable state. |
| **Complexity** | Medium — implement summary memory that compresses history every N steps. Keep last K tool results verbatim, summarize the rest. |
| **Dependencies** | Token budget tracking (Feature #2), existing `AgentSession`/`AgentMessage` models. |
| **What "done" looks like** | After every 5 turns, messages 1..N-3 are compressed into a summary paragraph. Last 3 tool results kept verbatim. Context window stays under configurable limit (e.g. 32K tokens). Compression logged for debugging. |
| **Industry pattern** | LangGraph implements "contextual compaction" — auto-summarize early steps at ~32K token threshold. Four-layer memory architecture (working→short-term→summary→persistent) is the 2026 standard. Google ADK-TS uses tiered memory. |

**Confidence: HIGH** — Standard pattern. LLM-based summarization is reliable for this use case.

### 13. SubAgentTool (Hierarchical Delegation)

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Main agent delegates specialized sub-tasks to focused sub-agents (e.g., "character design agent", "storyboard agent") with their own tool subsets and system prompts. Reduces context pollution and enables parallel execution. |
| **Complexity** | High — sub-agent lifecycle management, context isolation, result aggregation, parent-child session linking. |
| **Dependencies** | Unified AI call path (Feature #1), ArtifactStore (Feature #9) for inter-agent artifact sharing, SSE progress (Feature #4). |
| **What "done" looks like** | Main agent can call `delegate_to_specialist(specialist="storyboard_agent", task="Create detailed shot list for episode 3 scene 2", context_artifacts=["script_ep3", "characters"])`. Sub-agent runs with restricted tool set (storyboard skills only), returns results to parent. Max depth: 2 levels. |
| **Industry pattern** | Hierarchical Manager-Worker is the standard pattern recommended by CrewAI, LangGraph, AutoGen. Reduces coordination complexity from O(n²) to O(n). AG2 implements 4-layer handoff (after-work, tool-based, LLM-based, context-based). Critical caveat: >3-4 review iterations show diminishing returns and 37.6% increase in critical vulnerabilities. |

**Confidence: MEDIUM** — Pattern well-understood but complex to implement safely. Context sharing is the hardest problem (79% of multi-agent failures rooted in specification/coordination issues).

### 14. Workflow Skill Persistence (Markdown Templates)

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Save proven multi-skill workflows as reusable Markdown templates. "Episode creation workflow" becomes a one-click template instead of re-explaining to agent every time. |
| **Complexity** | Medium — Markdown-based workflow definition (steps, parameters, dependencies), persistence to DB or filesystem, template picker UI, parameterized execution. |
| **Dependencies** | SkillDescriptor dependencies (Feature #10), existing `CanvasTemplate` model pattern. |
| **What "done" looks like** | Workflow template format: Markdown with YAML frontmatter (name, description, required_inputs) + ordered skill invocation steps with parameter mappings. User can "save current plan as template" or pick from library. Templates git-trackable. |
| **Industry pattern** | pflow uses `.pflow.md` markdown workflow files. Agentic Workflows Template uses Directives (markdown) + Orchestration + Execution layers. Multiple production systems persist workflows as git-tracked markdown — zero database dependency for template definitions. |

**Confidence: MEDIUM** — Novel combination of markdown persistence + skill DAG. Format design needs iteration.

### 15. Admin Skill Management Page

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Admins can view all registered skills, their categories/tiers/dependencies, enable/disable skills, view execution statistics, and configure skill-level parameters (timeouts, queue routing). |
| **Complexity** | Medium — new admin page using existing AdminShell + TanStack Table patterns. Backend API for skill metadata + execution stats aggregation. |
| **Dependencies** | Existing admin console (7 pages), `SkillRegistry`, SkillDescriptor enhancement (Feature #10), cost tracking (Feature #5). |
| **What "done" looks like** | Admin page showing: skill list with category/tier/status filters, per-skill execution count/success rate/avg duration/avg cost charts, enable/disable toggles, dependency graph visualization. Follows Obsidian Lens design system. |
| **Industry pattern** | Standard admin console feature. Most agent platforms (LangSmith, Weights & Biases, AgentOps) provide skill/tool-level observability dashboards. |

**Confidence: HIGH** — Follows established admin page patterns in existing codebase.

### 16. Cross-Session Agent Memory

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Agent remembers user preferences, past creative decisions, and project-level context across sessions. "Last time you preferred dramatic lighting for this character" without re-explaining. |
| **Complexity** | High — memory extraction (profile/preferences/entities/patterns), structured storage, semantic retrieval, memory lifecycle (expiry, deduplication, conflict resolution). |
| **Dependencies** | ArtifactStore (Feature #9), existing `AgentSession`/`AgentMessage` models, context compression (Feature #12). |
| **What "done" looks like** | After each session, auto-extract: user style preferences, character design decisions, recurring instructions. On new session start, retrieve relevant memories and inject into system prompt. Memory categories: project_facts, user_preferences, creative_decisions, workflow_patterns. Deduplicated and scored by relevance. |
| **Industry pattern** | OpenViking organizes memories into 6 categories (profile, preferences, entities, events, cases, patterns) with automatic extraction and dedup. Four-layer architecture (working→short-term→summary→persistent) is the 2026 standard. LangGraph implements semantic checkpointing for cross-session recovery. |

**Confidence: MEDIUM** — Pattern documented but quality depends heavily on extraction prompts and retrieval strategy. Easy to build, hard to make reliable.

---

## Anti-Features

Features to **explicitly NOT build**. Tempting but harmful for Canvex's use case.

### A1. Autonomous Multi-Agent Swarms

| Anti-Feature | Agent teams that coordinate peer-to-peer without human oversight |
|---|---|
| **Why Avoid** | 41-87% failure rate in production multi-agent systems. 79% of failures from coordination issues. Creative production needs human judgment — autonomous swarms produce garbage at scale. Code subject to 5+ AI iterations shows 37.6% increase in critical vulnerabilities. |
| **What to Do Instead** | Hierarchical Manager-Worker with max 2-level depth. Human approval gates between major stages. SubAgentTool (Feature #13) with explicit delegation, not autonomous coordination. |

### A2. Full Conversation Replay / Lossless History

| Anti-Feature | Storing and replaying every token of every conversation verbatim forever |
|---|---|
| **Why Avoid** | Storage costs scale linearly with usage. A single creative session generates 50K-200K tokens. 1000 sessions/month = 50M-200M tokens of raw history. Diminishing value — compressed summaries serve 95% of use cases. |
| **What to Do Instead** | Summary memory (Feature #12) + structured artifact extraction. Keep last N sessions raw, compress older ones, extract persistent facts into cross-session memory (Feature #16). |

### A3. Custom Agent Training / Fine-Tuning

| Anti-Feature | Platform for users to fine-tune their own agent models |
|---|---|
| **Why Avoid** | Enormous infrastructure complexity (GPU provisioning, training pipelines, model serving). Prompt engineering + tool selection achieves 90%+ of the value at 1% of the cost. No customer demand signal. |
| **What to Do Instead** | Rich system prompts via `context_builder.py`. User-customizable prompt templates (existing). Workflow templates (Feature #14) for behavior customization without model training. |

### A4. Real-Time Multi-User Collaborative Agent Chat

| Anti-Feature | Multiple users simultaneously chatting with the same agent session in real-time |
|---|---|
| **Why Avoid** | Conflict resolution for concurrent tool calls is unsolved. Context window pollution from multiple conversation threads. Engineering complexity far exceeds value for creative production (typically 1 person drives the agent). |
| **What to Do Instead** | Per-user agent sessions with shared artifact visibility. Team members see each other's session results (via ArtifactStore) but don't interfere with active sessions. |

### A5. Generic Plugin/Extension Marketplace

| Anti-Feature | Open plugin system where third parties can add arbitrary agent tools |
|---|---|
| **Why Avoid** | Security nightmare (arbitrary code execution via tools). Quality control impossible. Canvex's value is curated, reliable creative production skills — not a platform for random extensions. |
| **What to Do Instead** | First-party skill expansion (Feature #7). Well-tested, versioned skills registered through `register_all.py`. Admin skill management (Feature #15) for operational control. |

### A6. MCP / A2A Protocol Compliance

| Anti-Feature | Full compliance with Anthropic MCP or Google A2A inter-agent communication protocols |
|---|---|
| **Why Avoid** | Canvex is a self-contained creative workbench, not an agent ecosystem participant. MCP/A2A are for horizontal agent-to-agent communication across platforms. Over-engineering for current scale and use case. |
| **What to Do Instead** | Internal `SkillRegistry` + `SubAgentTool` for all intra-platform orchestration. Monitor MCP/A2A adoption — revisit if/when Canvex needs to interop with external agent systems. |

---

## Feature Dependencies

```
Feature #1 (Unified AI Call Path)
  ├── Feature #2 (Token Budget) — needs unified metering point
  ├── Feature #3 (Unified Retry) — needs single retry layer
  ├── Feature #5 (Cost Tracking) — needs unified logging point
  └── Feature #13 (SubAgentTool) — sub-agents use same provider resolution

Feature #2 (Token Budget)
  └── Feature #12 (Context Compression) — triggered by budget thresholds

Feature #4 (SSE Tool Progress)
  └── Feature #11 (Plan-Then-Execute) — plan approval + execution progress via SSE

Feature #7 (Business Skill Expansion)
  ├── Feature #8 (Pipeline Fix) — prerequisite for multi-step skill chains
  └── Feature #10 (SkillDescriptor) — new skills need enhanced descriptors

Feature #9 (ArtifactStore)
  ├── Feature #13 (SubAgentTool) — inter-agent artifact sharing
  └── Feature #16 (Cross-Session Memory) — persistent artifact references

Feature #10 (SkillDescriptor Enhancement)
  ├── Feature #11 (Plan-Then-Execute) — dependency-aware planning
  ├── Feature #14 (Workflow Templates) — skill dependency graph in templates
  └── Feature #15 (Admin Skill Management) — enhanced metadata for admin UI

Feature #6 (Context Tools Write Ops)
  └── Feature #7 (Business Skill Expansion) — write tools are used by business skills
```

**Critical path:** #1 → #3 → #5 → #8 → #7 → #10 → #11 → #9 → #14

---

## MVP Recommendation

### Phase 1 — Infrastructure (must-do-first)
1. **Unified AI Call Path** (#1) — foundation for everything
2. **Unified Retry** (#3) — immediate reliability improvement
3. **Pipeline Fix** (#8) — unblock existing pipeline
4. **Cost Tracking** (#5) — metering from day 1

### Phase 2 — Agent Engine
5. **Token Budget** (#2) — cost-bounded agent loops
6. **SSE Tool Progress** (#4) — UX improvement for existing chat
7. **Context Tools Write Ops** (#6) — agent can finally create things
8. **SkillDescriptor Enhancement** (#10) — prepare for skill explosion

### Phase 3 — Skill Expansion
9. **Business Skill Expansion** (#7) — 7-stage pipeline fully skillized
10. **Context Compression** (#12) — long creative sessions work

### Phase 4 — Differentiation
11. **Plan-Then-Execute** (#11) — flagship interaction pattern
12. **ArtifactStore + ToolInterceptor** (#9) — session-level artifact magic
13. **Workflow Templates** (#14) — reusable creative workflows
14. **Admin Skill Management** (#15) — operational visibility

### Defer to Next Milestone
15. **SubAgentTool** (#13) — high complexity, can start with single-agent + skill DAG
16. **Cross-Session Memory** (#16) — high value but hard to get right; needs ArtifactStore foundation first

---

## Sources

- PydanticAI docs: `UsageLimits`, `FallbackModel`, `AbstractToolset` — [ai.pydantic.dev](https://ai.pydantic.dev/) — HIGH confidence
- PydanticAI Gateway: unified provider routing — [pydantic.dev/ai-gateway](https://pydantic.dev/ai-gateway) — HIGH confidence
- PydanticAI Issue #3352: per-tool usage limits — [github.com/pydantic/pydantic-ai/issues/3352](https://github.com/pydantic/pydantic-ai/issues/3352) — HIGH confidence
- Google ADK-TS Artifact Service: versioned binary artifact storage — [adk.iqai.com/docs/framework/artifacts](https://adk.iqai.com/docs/framework/artifacts) — HIGH confidence
- PolicyLayer/Intercept: tool-level policy enforcement — [github.com/PolicyLayer/Intercept](https://github.com/PolicyLayer/Intercept) — MEDIUM confidence
- n8n PR #20499: SSE streaming for tool execution events — [github.com/n8n-io/n8n/pull/20499](https://github.com/n8n-io/n8n/pull/20499) — HIGH confidence
- LangGraph production patterns: checkpointing, context compression — multiple sources (dev.to, markaicode.com, phantom-byte.com) — MEDIUM confidence
- SkillOrchestra (arXiv 2602.19672): skill-level competence modeling — [arxiv.org/abs/2602.19672v1](https://arxiv.org/abs/2602.19672v1) — MEDIUM confidence
- Agent delegation patterns: hierarchical Manager-Worker — multiple sources (zylos.ai, fast.io, docs.ag2.ai) — MEDIUM confidence
- AI agent retry patterns: exponential backoff + circuit breaker — multiple sources (getathenic.com, fast.io, ai-agentsplus.com) — HIGH confidence
- Agent billing patterns: per-request cost attribution — multiple sources (medium.com, fast.io, grepture.com) — MEDIUM confidence
- pflow workflow compiler: markdown-based workflow persistence — [docs.pflow.run](https://docs.pflow.run) — MEDIUM confidence
- OpenViking memory extraction: 6-category automatic memory — [docs.bswen.com](https://docs.bswen.com/blog/2026-03-16-openviking-session-memory-extraction) — LOW confidence
- Plan-and-Execute pattern: ReAct vs Plan-Execute comparison — multiple sources (dev.to, aaia.app, docs.reactiveagents.dev) — HIGH confidence
- Multi-agent failure rates: 41-87% production failure — zylos.ai research — MEDIUM confidence
