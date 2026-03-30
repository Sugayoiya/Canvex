# Roadmap: Canvas Studio

## Canvex Roadmap v2.0: Skill + Celery Refactor

- [x] **Phase 01: Foundation + SkillRegistry + Celery + Logging**
- [x] **Phase 02: Full Skill Migration + Base Canvas + Billing Baseline** (completed 2026-03-27)
- [x] **Phase 03: Agent System + Tool Calling + Pipeline Orchestration** (completed 2026-03-28)
- [x] **Phase 04: Media/Slash Skills + Quota Controls** (completed 2026-03-29)
- [ ] **Phase 05: Canvas/Video Experience + Billing Dashboard**
- [ ] **Phase 06: Collaboration + Versioning + Production Hardening**

### Phase 01: Foundation + SkillRegistry + Celery + Logging
**Goal**: Establish skeleton architecture and complete the first end-to-end invocation backbone.
**Depends on**: none
**UI hint**: no
**Success Criteria**:
1. FastAPI + Next.js project structure is operational.
2. SkillRegistry/Executor/Celery path is callable through API.
3. Auth baseline and structured tracing/log tables exist.

### Phase 02: Full Skill Migration + Base Canvas + Billing Baseline
**Goal**: Migrate key business capabilities into skills and connect first canvas execution flow.
**Depends on**: Phase 01
**UI hint**: yes
**Requirements:** [REQ-03, REQ-04]
**Plans:** 9/9 plans complete

Plans:
- [x] 02-01-PLAN.md — [W1] LLM Provider Infrastructure + fail-open AICallLog + ContextVar rehydration
- [x] 02-02-PLAN.md — [W1] Canvas Backend Models + project-scoped CRUD API
- [x] 02-03-PLAN.md — [W2] Skill Migration: TEXT (llm_generate, refine) + EXTRACT (characters, scenes) + shared JSON parser
- [x] 02-05-PLAN.md — [W2] Canvas Frontend Shell: page + workspace + toolbar + API client
- [x] 02-06-PLAN.md — [W2] Billing Baseline: ModelPricing + admin CRUD + cost auto-calc + usage stats
- [x] 02-07-PLAN.md — [W2] Skill Migration: VISUAL (character_prompt, scene_prompt, generate_image) + GeminiImageProvider
- [x] 02-04-PLAN.md — [W3] Skill Migration: SCRIPT (split_clips, convert_screenplay) + STORYBOARD (plan, detail)
- [x] 02-08-PLAN.md — [W3] Canvas 5 Node Types + useNodeExecution hook (polling backoff)
- [x] 02-09-PLAN.md — [W4] Integration Acceptance Test Gate

**Success Criteria**:
1. Core service domains are exposed as skills.
2. Base canvas and core nodes execute via skills.
3. Billing baseline entities and APIs are created.

### Phase 03: Agent System + Tool Calling + Pipeline Orchestration
**Goal**: Deliver PydanticAI-based agent orchestration loop over registry-discovered skills with SSE streaming chat sidebar.
**Depends on**: Phase 02
**UI hint**: yes
**Requirements:** [REQ-05, REQ-06]
**Plans:** 5/5 plans complete

Plans:
- [x] 03-01-PLAN.md — [W1] Backend Foundation: deps + AgentSession/Message models + schemas + SSE protocol
- [x] 03-02-PLAN.md — [W1] SkillToolset adapter (AbstractToolset) + AgentService + ContextBuilder
- [x] 03-03-PLAN.md — [W2] Agent API endpoints (SSE chat + session CRUD) + Pipeline Tool + tests
- [x] 03-04-PLAN.md — [W2] Chat Frontend: Zustand store + agentApi + useAgentChat SSE hook
- [x] 03-05-PLAN.md — [W3] Chat Sidebar UI components + canvas page integration

**Success Criteria**:
1. Agent tool-calling loop invokes skills reliably.
2. Chat sidebar displays tool calls and execution progress.
3. Pipeline orchestration supports multi-step skill chains.

### Phase 03.1: Agent Chat + Canvas Quality Fix (INSERTED)

**Goal:** Fix 12 quality issues across Agent Chat (pipeline toolset, context injection, session history, suggestion chips, heartbeat cleanup) and Canvas (upstream data flow, node persistence, edge deletion sync, execution result writeback, output node aggregation).
**Requirements**: None (inserted bugfix phase)
**Depends on:** Phase 03
**Plans:** 4/4 plans complete

Plans:
- [x] 03.1-01-PLAN.md — [W1] Agent Backend: mount pipeline toolset + context injection + context query tools + schema fix + heartbeat cleanup
- [x] 03.1-02-PLAN.md — [W1] Canvas Hooks: useUpstreamData (typed data flow) + useNodePersistence (debounce save) + edge deletion sync
- [x] 03.1-03-PLAN.md — [W1] Chat Frontend: session history loading + suggestion chips fix + sendMessage verification
- [x] 03.1-04-PLAN.md — [W2] Canvas Node Integration: wire hooks into all 5 node types + execution result writeback

### Phase 04: Media/Slash Skills + Quota Controls
**Goal**: Replace 5 functional-type canvas nodes with 4 material-type nodes (text/image/video/audio), add focus-panel interaction system, template-driven workflows, asset library, video generation skill, and enforce quota constraints.
**Depends on**: Phase 03
**UI hint**: yes
**Requirements:** [REQ-07, REQ-08]
**Plans:** 7/7 plans complete

Plans:
- [x] 04-01-PLAN.md — [W1] Frontend Infra: CSS --cv4-* tokens, connection-rules rewrite (4 types only), toFlowNode bug fix, NodeShell + StatusIndicator, DB migration script
- [x] 04-02-PLAN.md — [W1] Backend Quota: UserQuota/TeamQuota models, fail-closed QuotaService with atomic locks, SkillExecutor enforcement, admin API with authz+audit
- [x] 04-03-PLAN.md — [W1] Backend Video: Provider "auto" fix, GeminiVideoProvider (Veo), video.generate_video skill
- [x] 04-04-PLAN.md — [W2] Material Nodes: useNodeFocus + usePromptBuilder hooks, 4 node components, nodeTypes registry (NO legacy compat)
- [x] 04-05-PLAN.md — [W3] Focus Panels + Menus: PanelHost, AIGeneratePanel, TextToolbar, TemplateMenu, LeftFloatingMenu, NodeCreationMenu
- [x] 04-06-PLAN.md — [W3] Asset Library: CanvasAsset model + CRUD API (authz, pagination, PATCH, JSON limits), AssetPanel, SaveAssetDialog
- [x] 04-07-PLAN.md — [W4] Incremental Integration + Templates: canvas-workspace targeted edits, template system with graph validation (cycle + IO check)

**Success Criteria**:
1. Media/slash skill set is available and callable.
2. Usage aggregation and quota checks are enforced.
3. Exceeding quotas returns deterministic policy outcomes.

### Phase 05: Canvas/Video Experience + Billing Dashboard
**Goal**: Improve creator UX and expose billing operations in product UI.
**Depends on**: Phase 04
**UI hint**: yes
**Requirements:** [REQ-09, REQ-10]
**Plans:** 2/6 plans executed

Plans:
- [x] 05-01-PLAN.md — [W1] Backend APIs: batch execution (topo sort) + billing timeseries + task monitoring + node history
- [x] 05-02-PLAN.md — [W1] Frontend Infra: npm deps + CSS --cv5-* tokens + NodeShell V5 + PanelHost V5 routing
- [ ] 05-03-PLAN.md — [W2] V5 Node Toolbars (Image/Video/Audio) + AudioNode WaveSurfer rewrite
- [ ] 05-04-PLAN.md — [W2] Batch Execution Frontend: useBatchExecution + BatchExecutionBar + workspace integration
- [ ] 05-05-PLAN.md — [W2] Billing Dashboard: KPI cards + Recharts charts + usage table + project view
- [ ] 05-06-PLAN.md — [W2] Task Monitoring Page + Node Execution History popover

**Success Criteria**:
1. Canvas interactions and video composition flow are usable.
2. Billing dashboard shows usage/cost summaries.
3. Operational visibility includes task monitoring readiness.

### Phase 06: Collaboration + Versioning + Production Hardening
**Goal**: Complete collaboration model and production operations baseline.
**Depends on**: Phase 05
**UI hint**: yes
**Success Criteria**:
1. Multi-role collaboration and version history are available.
2. Production deployment and periodic jobs are stable.
3. Audit/log retention and export pathways are defined.
