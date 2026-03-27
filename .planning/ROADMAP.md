# Roadmap: Canvas Studio

## Canvex Roadmap v2.0: Skill + Celery Refactor

- [x] **Phase 01: Foundation + SkillRegistry + Celery + Logging**
- [ ] **Phase 02: Full Skill Migration + Base Canvas + Billing Baseline**
- [ ] **Phase 03: Agent System + Tool Calling + Pipeline Orchestration**
- [ ] **Phase 04: Media/Slash Skills + Quota Controls**
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
**Plans:** 9 plans

Plans:
- [ ] 02-01-PLAN.md — LLM Provider Infrastructure + AICallLog (retry/fail-open/ContextVar)
- [ ] 02-02-PLAN.md — Canvas Backend Models + API (project-scoped auth)
- [ ] 02-03-PLAN.md — Skill Migration: TEXT + EXTRACT (structured output)
- [ ] 02-04-PLAN.md — Skill Migration: SCRIPT + STORYBOARD
- [ ] 02-05-PLAN.md — Canvas Frontend Shell: Page + Workspace + Toolbar
- [ ] 02-06-PLAN.md — Billing Baseline: ModelPricing + Cost API (admin auth)
- [ ] 02-07-PLAN.md — Skill Migration: VISUAL (character_prompt + scene_prompt + generate_image)
- [ ] 02-08-PLAN.md — Canvas Frontend: 5 Node Types + Execution Hook (backoff)
- [ ] 02-09-PLAN.md — Integration Acceptance Test Gate

**Success Criteria**:
1. Core service domains are exposed as skills.
2. Base canvas and core nodes execute via skills.
3. Billing baseline entities and APIs are created.

### Phase 03: Agent System + Tool Calling + Pipeline Orchestration
**Goal**: Deliver agent orchestration loop over registry-discovered skills.
**Depends on**: Phase 02
**UI hint**: yes
**Success Criteria**:
1. Agent tool-calling loop invokes skills reliably.
2. Chat sidebar displays tool calls and execution progress.
3. Pipeline orchestration supports multi-step skill chains.

### Phase 04: Media/Slash Skills + Quota Controls
**Goal**: Add media-heavy workflows and enforce quota constraints.
**Depends on**: Phase 03
**UI hint**: yes
**Success Criteria**:
1. Media/slash skill set is available and callable.
2. Usage aggregation and quota checks are enforced.
3. Exceeding quotas returns deterministic policy outcomes.

### Phase 05: Canvas/Video Experience + Billing Dashboard
**Goal**: Improve creator UX and expose billing operations in product UI.
**Depends on**: Phase 04
**UI hint**: yes
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
