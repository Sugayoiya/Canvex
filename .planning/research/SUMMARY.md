# Project Research Summary

**Project:** Canvas Studio (Canvex) — v3.0 Agent System Upgrade
**Domain:** AI Agent Engine for Short-Film Creation Workbench
**Researched:** 2026-04-02
**Confidence:** HIGH

## Executive Summary

Canvex v3.0 is an agent engine upgrade on top of a mature creative production platform (14 skills, PydanticAI agent, Celery async, SSE chat, 11.5K LOC backend, 92K LOC frontend). The upgrade has three core objectives: (1) converge 3 disconnected AI call stacks into a single provider resolution path, (2) expand the 14-skill set to 30+ business skills covering the full 7-stage creation pipeline, and (3) add engine-level capabilities (token budgets, artifact persistence, plan-then-execute mode, sub-agent delegation) that transform the agent from a chat assistant into a production orchestrator. Research across all four domains converges on one conclusion: **the foundation is solid, and the upgrade is primarily an integration and wrapping exercise — not a greenfield build.**

The recommended approach is conservative on dependencies (only 3 new Python packages) and aggressive on PydanticAI-native patterns. All four research files independently identified AI Call Convergence as the critical first step — the 3-stack problem (PydanticAI env-key, ProviderManager sync, raw Gemini SDK) is both the biggest technical debt and the gating dependency for everything else. The architecture pattern is "compose around `agent.iter()`, don't subclass" — QueryEngine, ArtifactStore, and ToolInterceptor all wrap the existing iteration protocol rather than extending PydanticAI internals.

Key risks are well-understood and mitigable: SSE stream breakage when wrapping `agent.iter()` (use PydanticAI's native `UsageLimits` for interruption rather than manual `break`), Celery result bloat from large artifacts (ArtifactStore replaces inline payloads with references), and tool name stability across SkillDescriptor evolution (freeze tool name generation, add alias mapping for history). The 8-pitfall analysis maps cleanly to the 8-phase build order, with each phase addressing its critical pitfall before moving on.

## Key Findings

### Recommended Stack

Only **3 new packages** added, plus 1 version bump. The research explicitly rejected 12 alternatives (LangChain, subagents-pydantic-ai, hindsight-pydantic-ai, vector DBs, LiteLLM, MongoDB, etc.) in favor of PydanticAI-native primitives and existing SQLAlchemy patterns.

**Core additions:**
- **PydanticAI ≥1.75** (upgrade from 1.73): Capabilities API, `UsageLimits`, `history_processors`, native agent delegation via `@tool` + `ctx.usage` passthrough
- **summarization-pydantic-ai[tiktoken] ≥0.1.2**: Context compression via `ContextManagerCapability` or `history_processors` — built for PydanticAI, handles tool-call pair safety
- **genai-prices ≥0.0.56**: Per-request cost calculation (Pydantic team maintained, 30+ providers, 1600+ models, handles tiered/variable pricing)
- **tiktoken ≥0.12.0**: Fast token counting for QueryEngine budget enforcement (3-6x faster than alternatives)

**Not added (critical decisions):**
- SubAgentTool: Native PydanticAI delegation, no framework needed
- ArtifactStore: PostgreSQL JSON + SQLAlchemy, no document store needed
- Cross-session memory: SQLAlchemy queries + system prompt injection, no knowledge graph needed
- QueryEngine: Custom orchestration on PydanticAI primitives (`UsageLimits`, `result.usage()`)

See [STACK.md](./STACK.md) for full comparison tables and integration patterns.

### Expected Features

**Must have (table stakes) — 8 features:**
1. **Unified AI Call Path** — converge 3 stacks into single `UnifiedProviderResolver`, activate DB key chain
2. **Token Budget & Turn Limits** — PydanticAI `UsageLimits` + custom QueryEngine orchestration
3. **Unified Retry & Error Classification** — 429/500/400 classifier, circuit breaker, `FallbackModel` chain
4. **SSE Tool Progress Events** — extend `sse_protocol.py` with `tool_call_start`/`progress`/`end` events
5. **Cost Tracking & Attribution** — per-request cost via `genai-prices`, attributed to user/team/session/skill
6. **Context Tools Write Operations** — CRUD tools with RBAC enforcement, confirmation gates for destructive ops
7. **Business Skill Expansion** — 7-stage pipeline fully skillized (14 → 30+ skills)
8. **Pipeline Parameter Fix** — field name mismatches + Celery async chain repair

**Differentiators — 8 features:**
9. ArtifactStore + ToolInterceptor — session-scoped artifact auto-capture and injection
10. SkillDescriptor Enhancement — dependencies, mode, tier, artifact contract
11. Plan-Then-Execute Mode — structured plan approval before expensive execution
12. Context Compression — rolling summary memory via `summarization-pydantic-ai`
13. SubAgentTool — hierarchical delegation with scoped tools and budget
14. Workflow Skill Persistence — Markdown template-based reusable workflows
15. Admin Skill Management — enable/disable, execution stats, dependency graph
16. Cross-Session Agent Memory — preference/decision extraction across sessions

**Explicitly NOT building (anti-features):**
- Autonomous multi-agent swarms (41-87% failure rate)
- Full conversation replay / lossless history
- Custom agent training / fine-tuning
- Real-time multi-user collaborative agent chat
- Generic plugin marketplace
- MCP/A2A protocol compliance

See [FEATURES.md](./FEATURES.md) for full detail, dependency graph, and critical path analysis.

### Architecture Approach

The v3.0 architecture adds 5 new components (UnifiedProviderResolver, QueryEngine, ArtifactStore, ToolInterceptor, SubAgentTool) that compose around the existing Agent → SkillToolset → SkillRegistry → Celery pipeline. The core pattern is **"wrap, don't replace"**: new capabilities intercept the existing data flow at well-defined points rather than restructuring it.

**Major new components:**
1. **UnifiedProviderResolver** — single entry for all AI provider instantiation (LLM + Image + Video), replaces 3 call paths with DB credential chain (team → personal → system → env)
2. **QueryEngine** — wraps `agent.iter()` with token budget, round limits, diminishing-returns detection, plan-then-execute mode; uses PydanticAI's native `UsageLimits` for hard limits
3. **ArtifactStore + ToolInterceptor** — session-scoped KV store (Redis hot + DB cold) with declarative pre/post hooks on every tool call for automatic artifact injection and persistence
4. **SubAgentTool** — in-process child agent spawning via native PydanticAI delegation, scoped tool subsets, shared ArtifactStore with key prefixes
5. **Business Skills (30+)** — thin wrappers around existing service methods, preserving direct API call paths

**Key architectural patterns:**
- Compose around `agent.iter()`, don't subclass Agent
- Resolver-as-Service for all AI provider instantiation
- Artifact Contract via SkillDescriptor (declarative input/output)
- Celery context propagation via SkillContext serialization

See [ARCHITECTURE.md](./ARCHITECTURE.md) for component designs, data flow diagrams, and integration points.

### Critical Pitfalls

8 pitfalls identified, each mapped to a specific phase with prevention strategies and recovery plans:

1. **AI call path dual-stack race** — during migration, same request uses both old (env-key) and new (DB chain) paths → credential/billing mismatch. **Prevent:** resolve once per session in `SkillContext`, deprecation-warn all direct `settings.*_API_KEY` reads.
2. **QueryEngine breaks SSE streaming** — wrapping `agent.iter()` with try/except/break triggers zombie tool execution and message history loss. **Prevent:** use PydanticAI's `UsageLimits` native interruption, not manual break; track diminishing returns by output token deltas, not node counts.
3. **ArtifactStore + Celery result storage race** — dual-write (Celery result backend + ArtifactStore) causes Redis memory bloat from large AI payloads. **Prevent:** ArtifactStore as sole persistence, Celery results carry only `artifact_id` references.
4. **SkillDescriptor changes break 14 existing skills** — new required fields or changed category enums silently break registration and invalidate historical tool names. **Prevent:** all new fields must have defaults; freeze tool name generation; add alias mapping for history.
5. **Skill-ization removes direct API paths** — wrapping services as skills without preserving original API endpoints breaks non-agent frontend calls. **Prevent:** skill handlers are thin wrappers around services, not replacements; dual-entry architecture.
6. **Write tools cause irreversible data changes** — LLM tool calls are probabilistic; destructive writes without confirmation gates risk data loss. **Prevent:** safe/destructive write classification; confirmation gate via ToolInterceptor; soft delete + versioning.
7. **SubAgent token budget bypass** — child agent token consumption not counted toward parent budget; SSE events lost across delegation boundary. **Prevent:** in-process execution only (no Celery); independent budget with parent reporting; SSE event proxy via asyncio.Queue.
8. **Admin skill config drift** — Web process vs Celery worker registry state diverges after admin toggles. **Prevent:** DB as truth source; per-request skill loading; eventual consistency (60s TTL).

See [PITFALLS.md](./PITFALLS.md) for full analysis including integration gotchas, performance traps, security mistakes, UX pitfalls, and "looks done but isn't" checklist.

## Implications for Roadmap

Based on cross-referenced dependency analysis from all four research files, the upgrade decomposes into **8 phases** with a clear dependency chain. All four files independently converge on the same ordering.

### Phase 1: AI Call Convergence
**Rationale:** Every subsequent phase depends on unified provider resolution. Currently the #1 technical debt item. All 4 research files flag this as the mandatory first step.
**Delivers:** `UnifiedProviderResolver` replacing 3 call paths; activated DB key chain (team → personal → system → env); `create_pydantic_model()` uses DB-resolved credentials; all skill handlers migrated.
**Addresses:** Feature #1 (Unified AI Call Path), Feature #3 (Unified Retry), Feature #5 (Cost Tracking foundation)
**Avoids:** Pitfall #1 (dual-stack credential race)
**Stack:** PydanticAI ≥1.75 upgrade, genai-prices integration point
**Complexity:** Medium — refactoring, not greenfield

### Phase 2: SkillDescriptor Enhancement + Pipeline Fix
**Rationale:** Must prepare the skill metadata system before expanding from 14 to 30+ skills. Pipeline fix unblocks multi-step workflows. Architecture research places this before ArtifactStore because ToolInterceptor rules depend on enhanced descriptor metadata.
**Delivers:** Enhanced `SkillDescriptor` (dependencies, mode, tier, artifact contract); fixed `pipeline_tools.py` field mismatches; Celery async chain repair; dependency validation in registry.
**Addresses:** Feature #10 (SkillDescriptor), Feature #8 (Pipeline Fix)
**Avoids:** Pitfall #4 (registration failure from incompatible descriptor changes)
**Stack:** No new dependencies — dataclass field additions
**Complexity:** Low-Medium

### Phase 3: ArtifactStore + ToolInterceptor
**Rationale:** Session-level artifact management is prerequisite for both QueryEngine (needs state tracking) and business skill expansion (large payloads must not bloat Celery/context). Architecture places this before QueryEngine because QueryEngine uses ArtifactStore for state management.
**Delivers:** `SessionArtifact` DB model; `ArtifactStore` (Redis hot + DB cold); `ToolInterceptor` with declarative pre/post hooks; `SkillToolset.call_tool()` integration.
**Addresses:** Feature #9 (ArtifactStore + ToolInterceptor)
**Avoids:** Pitfall #3 (Celery result storage race / Redis memory bloat)
**Stack:** No new dependencies — PostgreSQL JSON + existing Redis
**Complexity:** Medium-High

### Phase 4: QueryEngine + Context Compression
**Rationale:** Budget controls must be in place before unleashing 30+ skills (unconstrained agent loops can burn $2.80 on a single task). Context compression pairs naturally — both are agent-level wrappers around `agent.iter()`.
**Delivers:** `QueryEngine` (token budget, round limits, diminishing detection, plan-then-execute mode); context compression via `summarization-pydantic-ai`; SSE budget/progress events; `AgentSession.summary` column.
**Addresses:** Feature #2 (Token Budget), Feature #4 (SSE Progress), Feature #12 (Context Compression), Feature #11 (Plan-Then-Execute)
**Avoids:** Pitfall #2 (SSE stream breakage from wrapper)
**Stack:** summarization-pydantic-ai[tiktoken], tiktoken
**Complexity:** Medium — leverages PydanticAI native `UsageLimits`

### Phase 5: Business Skill Expansion (7-Stage Pipeline)
**Rationale:** Core product value — the 7-stage creation pipeline must be agent-invokable. Depends on phases 1-4 (unified credentials, enhanced descriptors, artifact management, budget controls).
**Delivers:** 30+ new skills across 7 stages (Story Workshop → Import → Asset Extraction → Story-to-Script → Storyboard → Dialogue → Video Generation); all using `UnifiedProviderResolver`; dual-entry architecture preserved.
**Addresses:** Feature #7 (Business Skill Expansion)
**Avoids:** Pitfall #5 (losing direct API paths)
**Stack:** No new dependencies — thin wrappers around existing services
**Complexity:** High (volume) but individually straightforward

### Phase 6: Context Tools Write Ops + Canvas-Chat Integration
**Rationale:** Agent can finally create/modify project data (not just read). Canvas-chat integration needs both write tools and business skills. Depends on business skills being available.
**Delivers:** CRUD context tools (create/update character, shot, scene); permission enforcement via RBAC; confirmation gates for destructive writes; canvas write tools; frontend canvas chat panel.
**Addresses:** Feature #6 (Context Tools Write Ops)
**Avoids:** Pitfall #6 (irreversible data changes from agent)
**Complexity:** Medium — CRUD wrapping with existing permission infrastructure

### Phase 7: Admin Skill Management + Cost Dashboard
**Rationale:** Operational visibility over the expanded skill set. Requires stable skill system to manage. Admin page follows existing AdminShell + TanStack Table patterns.
**Delivers:** Admin skill list with filters/stats; enable/disable toggles; execution analytics; cost dashboard; DB-backed skill configs replacing hardcoded registration.
**Addresses:** Feature #15 (Admin Skill Management), Feature #5 (Cost Tracking display)
**Avoids:** Pitfall #8 (config drift between Web and Worker)
**Complexity:** Medium

### Phase 8: SubAgentTool + Workflow Skills + Cross-Session Memory
**Rationale:** Advanced features that build on the stable foundation. SubAgentTool needs all prior infrastructure. Workflow persistence needs mature skill DAG. Cross-session memory needs ArtifactStore + compression.
**Delivers:** `SubAgentTool` (in-process child agents with scoped tools/budget); `WorkflowSkill` (Markdown template-based reusable pipelines); cross-session agent memory (preference extraction + injection); unified retry strategy refinement.
**Addresses:** Feature #13 (SubAgentTool), Feature #14 (Workflow Templates), Feature #16 (Cross-Session Memory)
**Avoids:** Pitfall #7 (SubAgent token bypass / SSE event loss)
**Stack:** No new dependencies — native PydanticAI delegation
**Complexity:** High

### Phase Ordering Rationale

- **Phase 1 → everything:** unified credentials are the single hardest dependency — Agent, text skills, image/video skills all need it
- **Phase 2 before 3:** ToolInterceptor rules are declared in SkillDescriptor metadata; descriptors must be enhanced first
- **Phase 3 before 4:** QueryEngine tracks state via ArtifactStore; ArtifactStore must exist first
- **Phase 4 before 5:** 30+ skills without budget controls = runaway costs; QueryEngine gates this
- **Phase 5 before 6:** canvas-chat needs business skills to drive creation workflows
- **Phase 6 before 7:** admin needs a stable skill set to manage
- **Phase 8 last:** SubAgent/Workflow/Memory are differentiation features that require all foundational layers

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 3 (ArtifactStore):** Redis hot + DB cold dual-layer implementation; ToolInterceptor rule DSL design; artifact lifecycle management (TTL, GC, cross-session references). Custom implementation with no direct library precedent.
- **Phase 4 (QueryEngine):** Diminishing-returns detection algorithm; plan-then-execute interaction protocol over SSE; `summarization-pydantic-ai` integration edge cases (library is young, Feb 2026).
- **Phase 8 (SubAgentTool):** SSE event proxying from child to parent agent (PydanticAI issue #1978 unresolved); child agent streaming; budget accounting across delegation boundary.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (AI Call Convergence):** Well-documented refactoring — PydanticAI provider constructors accept explicit API keys; ProviderManager's async path already exists as dead code.
- **Phase 2 (SkillDescriptor + Pipeline Fix):** Dataclass field additions with defaults; pipeline fix is a documented bug with known solution.
- **Phase 5 (Business Skills):** Thin wrapper pattern over existing services; each skill follows established handler template.
- **Phase 6 (Write Ops):** Standard CRUD + existing permission infrastructure; confirmation gate is a well-documented pattern.
- **Phase 7 (Admin Page):** Follows existing AdminShell + TanStack Table patterns from v2.1 phases 8-11.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Only 3 new packages, all from Pydantic ecosystem or de facto standards. 7/10 items are "no new library." All verified against official docs and PyPI. |
| Features | **HIGH** | 16 features with clear dependency graph and critical path. Table stakes backed by industry patterns (PydanticAI, LangGraph, ADK-TS). Anti-features well-justified. |
| Architecture | **HIGH** | Based on direct codebase analysis. Component designs follow existing patterns. Integration points mapped to specific files. Build order validated against dependency graph. |
| Pitfalls | **HIGH** | 8 pitfalls with concrete prevention strategies, each mapped to a phase. Backed by PydanticAI issue tracker, community experience, and codebase analysis. Recovery strategies included. |

**Overall confidence: HIGH** — This is a well-understood upgrade on a mature codebase with proven patterns. The biggest risk area is not technical but scope management: 30+ new skills across 8 phases is a large surface area.

### Gaps to Address

- **summarization-pydantic-ai maturity:** Library is from Feb 2026 (v0.1.2). If it breaks or is abandoned, fallback is implementing custom `history_processors` on PydanticAI's native hook. Low-risk gap — the library is thin, replaceable.
- **PydanticAI child agent streaming (issue #1978):** No native solution for proxying SSE events from sub-agent to parent. Phase 8 SubAgentTool will need a custom `asyncio.Queue` bridge. Research flags this as the highest-uncertainty technical challenge.
- **Skill count vs LLM accuracy:** Community data suggests >20 tools degrades tool selection accuracy. The mitigation (dynamic skill loading by category) is documented but unvalidated in this codebase. Phase 5 should include empirical testing.
- **Admin config eventual consistency:** 60-second TTL for skill enable/disable propagation is a design trade-off. If operators need instant propagation, will require Redis pub/sub or similar — deferred unless validated by usage.

## Sources

### Primary (HIGH confidence)
- PydanticAI official docs: [ai.pydantic.dev](https://ai.pydantic.dev/) — UsageLimits, FallbackModel, Capabilities API, multi-agent delegation, AbstractToolset
- PydanticAI GitHub releases v1.71–v1.75 — Capabilities API, history_processors
- genai-prices (Pydantic team): [github.com/pydantic/genai-prices](https://github.com/pydantic/genai-prices) — cost calculation
- tiktoken v0.12.0: [github.com/openai/tiktoken](https://github.com/openai/tiktoken) — token counting
- Google ADK-TS: artifact storage pattern — [adk.iqai.com](https://adk.iqai.com/docs/framework/artifacts)
- Direct codebase analysis: agent_service.py, skill_toolset.py, registry.py, provider_manager.py, agent.py, skill_task.py, context_tools.py, pipeline_tools.py, descriptor.py, sse_protocol.py

### Secondary (MEDIUM confidence)
- summarization-pydantic-ai v0.1.2: [PyPI](https://pypi.org/project/summarization-pydantic-ai/) — context compression (young library, Vstorm OSS)
- PydanticAI issue #4773: AbstractMemoryStore RFC (unmerged)
- PydanticAI issue #1978: sub-agent streaming events (open)
- LangGraph production patterns: checkpointing, context compression — multiple community sources
- SkillOrchestra (arXiv 2602.19672): skill-level competence modeling
- Multi-agent failure rates: 41-87% production failure (zylos.ai research)
- Plan-and-Execute agent pattern: comparison with ReAct — multiple sources

### Tertiary (LOW confidence)
- OpenViking memory extraction: 6-category memory architecture — single source (bswen.com)
- pflow workflow compiler: markdown-based workflow persistence — docs.pflow.run

---
*Research completed: 2026-04-02*
*Ready for roadmap: yes*
