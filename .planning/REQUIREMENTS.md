# Requirements: Canvas Studio v3.0

**Defined:** 2026-04-02
**Core Value:** A single, reliable Skill execution backbone that both canvas nodes and AI agents can use consistently.
**Design references:** Claude Code (engine layer) + FireRed-OpenStoryline (domain layer patterns)

## v3.0 Requirements

Requirements for Agent System Upgrade milestone. Each maps to roadmap phases.

### AI Call Convergence

- [x] **CONV-01**: All LLM skill invocations resolve API keys through unified ProviderManager async path (team → personal → system → env fallback)
- [x] **CONV-02**: PydanticAI Agent model construction uses unified ProviderManager instead of direct settings/env reads
- [x] **CONV-03**: Image generation skills (visual.generate_image) resolve credentials through unified ProviderManager
- [x] **CONV-04**: Video generation skills (video.generate_video) resolve credentials through unified ProviderManager
- [x] **CONV-05**: Dead code path `ProviderManager.get_provider()` (async DB key chain) is activated and tested as the single runtime entry point
- [x] **CONV-06**: Existing 14 skills continue working without behavior changes after convergence (regression-safe)
- [x] **CONV-07**: KeyRotator round-robin activated — same provider with multiple keys distributes requests evenly
- [x] **CONV-08**: KeyRotator error feedback closed-loop — 429/5xx triggers `report_error`, increments `error_count`, updates `last_used_at`; unhealthy keys auto-skipped
- [x] **CONV-09**: Auto-retry on key failure — when current key returns 429/5xx, transparently retry with next healthy key from rotation pool
- [x] **CONV-10**: Admin API supports per-key management — enable/disable individual keys, reset error_count, configure rate_limit_rpm
- [x] **CONV-11**: Admin provider page shows per-key health status (last_used_at, error_count, is_active) and supports key-level operations

### QueryEngine

- [ ] **QENG-01**: Agent loop wrapped with configurable token budget (max tokens per session turn)
- [ ] **QENG-02**: Agent loop enforces configurable turn limit (max tool-call rounds per message)
- [ ] **QENG-03**: Diminishing returns detection terminates agent loop when consecutive low-increment turns detected
- [ ] **QENG-04**: Complex multi-step tasks trigger "plan first, confirm, then execute" mode via system prompt strategy
- [ ] **QENG-05**: Simple single-step tasks bypass planning and execute tools directly
- [ ] **QENG-06**: Agent reports tool result summary and next-step intent after each tool call (Claude Code pattern)
- [ ] **QENG-07**: QueryEngine integrates with PydanticAI native UsageLimits API (not wrapping agent.iter() externally)

### Cost Tracking

- [ ] **COST-01**: Token usage (input/output/total) tracked per agent session turn
- [ ] **COST-02**: Cost computed per turn using model-specific pricing (genai-prices or equivalent)
- [ ] **COST-03**: SSE `done` event includes usage summary (tokens, estimated cost)
- [ ] **COST-04**: SSE `tool_progress` event emitted during async skill execution with status updates
- [ ] **COST-05**: Frontend displays cumulative token usage and cost in chat UI
- [ ] **COST-06**: Frontend displays tool execution progress indicator during async operations

### ArtifactStore + ToolInterceptor

- [ ] **ARTS-01**: Session-scoped artifact store persists skill execution results (keyed by session_id + skill_name)
- [ ] **ARTS-02**: Artifacts stored as structured data with metadata (artifact_id, skill_kind, summary, timestamp)
- [ ] **ARTS-03**: ToolInterceptor before-hook auto-injects upstream dependency artifacts into skill parameters
- [ ] **ARTS-04**: ToolInterceptor after-hook auto-persists skill results to ArtifactStore
- [ ] **ARTS-05**: Agent no longer needs to pass large JSON blobs between tool calls (interceptor handles data flow)
- [ ] **ARTS-06**: ArtifactStore uses PostgreSQL/SQLAlchemy (agent_artifacts table), not file system

### SkillDescriptor Enhancement

- [ ] **DESC-01**: SkillDescriptor supports `skill_kind` field (artifact category: "script", "storyboard", "character", etc.)
- [ ] **DESC-02**: SkillDescriptor supports `require_prior_kind` field (list of upstream artifact dependencies for auto mode)
- [ ] **DESC-03**: SkillDescriptor supports `default_require_prior_kind` field (dependencies for default/skip mode)
- [ ] **DESC-04**: SkillDescriptor supports `supports_skip` boolean (whether skill can be skipped by user)
- [ ] **DESC-05**: SkillDescriptor supports Claude Code-style metadata: `is_read_only`, `is_destructive`, `timeout`, `max_result_size_chars`
- [ ] **DESC-06**: SkillDescriptor supports `skill_tier` field with 3-tier classification: workflow / capability / meta
- [ ] **DESC-07**: Existing 14 skills annotated with new descriptor fields (backward-compatible defaults for missing fields)
- [ ] **DESC-08**: SkillToolset dynamically filters skills exposed to Agent based on session context (max ~10 tools per context)

### Pipeline Fix

- [ ] **PIPE-01**: pipeline_tools.py parameter names aligned with actual skill handler field names (text→story, clips→clip_content, shot_plan→shots)
- [ ] **PIPE-02**: Pipeline properly handles Celery async skills with poll loop (not treating async returns as sync results)
- [ ] **PIPE-03**: Pipeline chain passes results through ArtifactStore instead of _chain_params hard-coding
- [ ] **PIPE-04**: Pipeline reports per-step progress via SSE events

### Provider & Model Preset Management

- [ ] **PROV-01**: 系统启动时自动种子 Gemini/OpenAI/DeepSeek 预置 Provider（is_preset=True 不可删），每个含 icon/description/default_base_url
- [ ] **PROV-02**: 预置常用模型（≥7 个 LLM + Image 模型）写入 AIModelConfig（is_preset=True），并通过 ModelPricing 关联到对应 Provider
- [ ] **PROV-03**: ModelPricing 同时作为 Provider-Model 关联表和定价表，AIModelProviderMapping 删除
- [ ] **PROV-04**: Provider 配置弹窗简化为只需填 API Key + 可选 Base URL
- [ ] **PROV-05**: Provider 卡片内可展开模型列表，显示名称/类型/context_size/定价/启用状态
- [ ] **PROV-06**: 用户可手动添加自定义模型并关联到指定 Provider
- [ ] **PROV-07**: base_url 字段正确传递到 resolve_langchain_llm，支持 OpenAI 兼容类 Provider 自定义端点

### Admin Skill Management

- [ ] **ADMN-01**: Admin API endpoint lists all registered skills with descriptor metadata
- [ ] **ADMN-02**: Admin API endpoint enables/disables individual skills at runtime
- [ ] **ADMN-03**: Admin API endpoint shows skill execution statistics (invocation count, success rate, avg duration)
- [ ] **ADMN-04**: Admin frontend skill management page with skill list table (name, category, tier, status, stats)
- [ ] **ADMN-05**: Admin frontend supports toggling skill enabled/disabled with confirmation
- [ ] **ADMN-06**: Admin skill management page uses Obsidian Lens design system and AdminShell layout

## v3.1 Requirements

Deferred to next milestone. Tracked but not in current roadmap.

### Business Skill Expansion

- **SKIL-01**: 7-stage creation pipeline business methods wrapped as Skills (14 → 30+ skills)
- **SKIL-02**: Context Tools expanded to 10+ including write operations (create Episode, persist Shot, modify canvas nodes)
- **SKIL-03**: Write operation permission control (ask/auto/bypass modes via SSE permission_request)
- **SKIL-04**: Canvas-Chat integration — agent can orchestrate full episode creation workflow through chat

### Advanced Agent Capabilities

- **ADVN-01**: SubAgentTool — main Agent spawns independent sub-tasks with separate tool sets and token budgets
- **ADVN-02**: Workflow Skill persistence — save multi-step creation flows as Markdown templates for reuse
- **ADVN-03**: Cross-session Agent memory — user/project-level preference persistence and retrieval-augmented context

### Resilience

- **RESL-01**: Unified 4-level retry strategy (foreground interactive / background async / model fallback / persistent retry)
- **RESL-02**: Context compression — long conversation auto-summarization for token window management

## Out of Scope

| Feature | Reason |
|---------|--------|
| LangChain/LangGraph framework migration | PydanticAI already deeply integrated; native APIs cover all needed capabilities |
| MCP protocol support | Not needed — SkillRegistry + SkillToolset serves same purpose with tighter integration |
| Autonomous multi-agent swarms | 41-87% failure rate in production; single agent + skill DAG covers 80% of use cases |
| Real-time multi-user agent chat | No collaborative editing requirement at current scale |
| Custom model fine-tuning | Off-the-shelf models sufficient; prompt engineering preferred |
| Full production SLA hardening | Deferred beyond agent upgrade |
| Mobile app | Web-first experience |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONV-01 | Phase 12 | Complete |
| CONV-02 | Phase 12 | Complete |
| CONV-03 | Phase 12 | Complete |
| CONV-04 | Phase 12 | Complete |
| CONV-05 | Phase 12 | Complete |
| CONV-06 | Phase 12 | Complete |
| CONV-07 | Phase 12 | Complete |
| CONV-08 | Phase 12 | Complete |
| CONV-09 | Phase 12 | Complete |
| CONV-10 | Phase 12 | Complete |
| CONV-11 | Phase 12 | Complete |
| PROV-01 | Phase 12.2 | Pending |
| PROV-02 | Phase 12.2 | Pending |
| PROV-03 | Phase 12.2 | Pending |
| PROV-04 | Phase 12.2 | Pending |
| PROV-05 | Phase 12.2 | Pending |
| PROV-06 | Phase 12.2 | Pending |
| PROV-07 | Phase 12.2 | Pending |
| DESC-01 | Phase 13 | Pending |
| DESC-02 | Phase 13 | Pending |
| DESC-03 | Phase 13 | Pending |
| DESC-04 | Phase 13 | Pending |
| DESC-05 | Phase 13 | Pending |
| DESC-06 | Phase 13 | Pending |
| DESC-07 | Phase 13 | Pending |
| DESC-08 | Phase 13 | Pending |
| PIPE-01 | Phase 13 | Pending |
| PIPE-02 | Phase 13 | Pending |
| PIPE-04 | Phase 13 | Pending |
| ARTS-01 | Phase 14 | Pending |
| ARTS-02 | Phase 14 | Pending |
| ARTS-03 | Phase 14 | Pending |
| ARTS-04 | Phase 14 | Pending |
| ARTS-05 | Phase 14 | Pending |
| ARTS-06 | Phase 14 | Pending |
| PIPE-03 | Phase 14 | Pending |
| QENG-01 | Phase 15 | Pending |
| QENG-02 | Phase 15 | Pending |
| QENG-03 | Phase 15 | Pending |
| QENG-04 | Phase 15 | Pending |
| QENG-05 | Phase 15 | Pending |
| QENG-06 | Phase 15 | Pending |
| QENG-07 | Phase 15 | Pending |
| COST-01 | Phase 15 | Pending |
| COST-02 | Phase 15 | Pending |
| COST-03 | Phase 15 | Pending |
| COST-04 | Phase 15 | Pending |
| COST-05 | Phase 15 | Pending |
| COST-06 | Phase 15 | Pending |
| ADMN-01 | Phase 16 | Pending |
| ADMN-02 | Phase 16 | Pending |
| ADMN-03 | Phase 16 | Pending |
| ADMN-04 | Phase 16 | Pending |
| ADMN-05 | Phase 16 | Pending |
| ADMN-06 | Phase 16 | Pending |

**Coverage:**
- v3.0 requirements: 55 total
- Mapped to phases: 55 ✓
- Unmapped: 0

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after roadmap creation*
