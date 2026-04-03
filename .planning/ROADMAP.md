# Roadmap: Canvas Studio

## Milestones

- ✅ **v2.0 Skill + Celery Refactor** — Phases 01-06 (shipped 2026-03-30)
- ✅ **v2.1 Admin Console** — Phases 07-11 (shipped 2026-04-02)
- 🚧 **v3.0 Agent System Upgrade** — Phases 12-16 + 12.1, 12.2 inserted (in progress)

## Phases

<details>
<summary>✅ v2.0 Skill + Celery Refactor (Phases 01-06) — SHIPPED 2026-03-30</summary>

- [x] Phase 01: Foundation + SkillRegistry + Celery + Logging
- [x] Phase 02: Full Skill Migration + Base Canvas + Billing Baseline (9 plans)
- [x] Phase 03: Agent System + Tool Calling + Pipeline Orchestration (5 plans)
- [x] Phase 03.1: Agent Chat + Canvas Quality Fix (4 plans, inserted)
- [x] Phase 04: Media/Slash Skills + Quota Controls (7 plans)
- [x] Phase 05: Canvas/Video Experience + Billing Dashboard (6 plans)
- [x] Phase 06: Collaboration + Versioning + Production Hardening (7 plans)

See: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.1 Admin Console (Phases 07-11) — SHIPPED 2026-04-02</summary>

- [x] Phase 07: Admin API Foundation (4 plans) — completed 2026-04-01
- [x] Phase 08: Admin Frontend Shell (2 plans) — completed 2026-04-01
- [x] Phase 09: User & Team Management UI (3 plans) — completed 2026-04-01
- [x] Phase 10: Quota & Pricing & Provider Management UI (4 plans) — completed 2026-04-01
- [x] Phase 11: Monitoring Dashboard & Polish (4 plans) — completed 2026-04-01

See: `.planning/milestones/v2.1-ROADMAP.md`

</details>

### 🚧 v3.0 Agent System Upgrade (In Progress)

**Milestone Goal:** 统一 AI 调用路径、增强 Agent 引擎层（QueryEngine / ArtifactStore / ToolInterceptor / SkillDescriptor），修复 Pipeline，建立成本跟踪和 Admin 技能管理——为后续 30+ 业务 Skill 扩展奠定坚实基础。

- [x] **Phase 12: AI Call Convergence** — 收敛 3 条割裂 AI 调用栈为统一 ProviderManager 路径，激活 DB 级异步密钥链 + KeyRotator (completed 2026-04-02)
- [x] **Phase 12.1: Agent-First Architecture: LangChain + Anthropic Skills** — (INSERTED) LangChain 替代 PydanticAI，Anthropic SKILL.md 三级加载，多供应商 LLM 切换，LangSmith 追踪 (completed 2026-04-02)
- [ ] **Phase 12.2: Provider & Model Preset Management** — (INSERTED) Provider 系统预置 + 用户填 Key/BaseURL，Model 预置常用模型，ModelPricing 兼任关联表+定价表，模型列表嵌入 Provider 卡片（Dify 风格）
- [ ] **Phase 13: SkillDescriptor Enhancement + Pipeline Fix** — 增强 Skill 元数据（依赖声明/分类/安全标注），修复 Pipeline 参数对齐和 Celery 异步衔接
- [ ] **Phase 14: ArtifactStore + ToolInterceptor** — 会话级产物自动存储/注入，替代内联大 JSON 传递和硬编码参数链
- [ ] **Phase 15: QueryEngine + Cost Tracking** — Token 预算/轮次限制/递减检测/"先计划再执行"模式 + 成本跟踪与前端展示
- [ ] **Phase 16: Admin Skill Management** — Admin 技能管理页面（列表/统计/启停控制）

## Phase Details

### Phase 12: AI Call Convergence
**Goal**: All AI invocations (LLM, image, video) resolve credentials through a single unified ProviderManager async path, with active KeyRotator and per-key health management
**Depends on**: Nothing (first phase of v3.0; builds on v2.0/v2.1 infrastructure)
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-07, CONV-08, CONV-09, CONV-10, CONV-11
**Success Criteria** (what must be TRUE):
  1. Any LLM skill invocation resolves API keys via ProviderManager async DB chain (team → personal → system → error), not via direct settings/env reads (no env fallback at runtime; env vars are seed-only)
  2. Image and video generation skills use the same unified credential resolution path as LLM skills
  3. PydanticAI Agent model instances are created with DB-resolved credentials; existing 14 skills work without behavior changes
  4. KeyRotator distributes requests across multiple keys for the same provider, auto-skipping unhealthy keys on 429/5xx with transparent retry
  5. Admin provider page shows per-key health status (last_used_at, error_count, is_active) and supports key-level enable/disable and error reset
**Plans**: 4 plans

Plans:
- [x] 12-01-PLAN.md — Redis modules: KeyHealthManager (atomic ops, degraded fallback, error redaction), CredentialCache (metadata-only, single-flight lock)
- [x] 12-02-PLAN.md — ProviderManager refactor: contextvars key tracking, Redis integration, lifecycle hooks, unit tests
- [x] 12-03-PLAN.md — Call site migration: 13 call sites to unified async path, remove get_provider_sync, drop SQLite, static verification
- [x] 12-04-PLAN.md — Admin health UI: batch health endpoint, per-key health badges/toggle/reset/sparkline

**UI hint**: yes

### Phase 12.1: Agent-First Architecture: LangChain + Anthropic Skills (INSERTED)

**Goal:** 将 Canvex AI 架构从 PydanticAI + Skill-Centric 模式重构为 LangChain + Anthropic Agent Skills 模式。Agent 成为唯一 LLM 推理者；Skill 变为声明式 SKILL.md 目录（三级渐进加载）；Tools 变为 @tool 纯函数；支持多供应商 LLM 切换（Gemini/OpenAI/DeepSeek）；集成 LangSmith 全链路追踪。
**Depends on:** Phase 12 (unified ProviderManager credential path)
**Requirements**: AGENT-01 (LangChain @tool 纯函数工具集), AGENT-02 (Anthropic SKILL.md 三级加载), AGENT-03 (LangChain Agent 多供应商切换), AGENT-04 (前端全部走 Agent Chat), AGENT-05 (清理 PydanticAI + 旧 skill handlers)
**Success Criteria** (what must be TRUE):
  1. All 14+ tools (read/write/AI) defined as LangChain `@tool` pure functions, no embedded LLM reasoning
  2. 10 SKILL.md directories created following Anthropic spec (YAML name+description, <500 lines body)
  3. SkillLoader implements three-level progressive disclosure (metadata at startup, instructions on trigger, resources on demand)
  4. LangChain `create_react_agent` replaces PydanticAI agent loop; `resolve_langchain_llm()` supports Gemini/OpenAI/DeepSeek switching
  5. LangSmith tracing enabled, all agent reasoning chains visible
  6. Frontend all AI operations go through `POST /agent/chat` SSE; `POST /skills/invoke` deprecated
  7. PydanticAI dependency removed; old reasoning skill Python handlers deleted
**Plans**: 5 plans (Phase 0-4 from plan)

Plans:
- [x] 12.1-01-PLAN.md — LangChain @tool 纯函数工具集: 17 tools + tool gating (≤14/context) + timeout middleware + contextvars 安全传播
- [x] 12.1-02-PLAN.md — Anthropic SKILL.md 10 个目录 + SkillLoader 三级渐进加载 + mtime 缓存失效 + 递归深度守卫
- [x] 12.1-03-PLAN.md — LangChain Agent: create_agent (非已废弃 create_react_agent) + resolve_langchain_llm + SSE 流式回退矩阵 + LangSmith
- [x] 12.1-04-PLAN.md — 前端适配: 废弃 skillsApi.invoke, agentApi.listSkills, feature-flag adapter 渐进式 canvas 迁移 + 遥测
- [x] 12.1-05-PLAN.md — 清理: 删除 13 文件 + E2E 验证门控 + 保留显式 provider deps + 迁移兼容性测试矩阵

### Phase 12.2: Provider & Model Preset Management (INSERTED)

**Goal:** 将 Provider 管理从"用户手动创建"改为"系统预置 + 用户填写 Key/BaseURL"模式，预置常用 Model，用 ModelPricing 作为 Provider-Model 关联兼定价表，模型列表嵌入 Provider 卡片内展示（Dify 风格）
**Depends on:** Phase 12.1 (resolve_langchain_llm + base_url 传递依赖 Provider 预置数据)
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07
**Success Criteria** (what must be TRUE):
  1. 系统启动时自动种子 Gemini/OpenAI/DeepSeek 预置 Provider（is_preset=True 不可删），每个含 icon/description/default_base_url
  2. 预置常用模型（≥7 个 LLM + Image 模型）写入 AIModelConfig（is_preset=True），并通过 ModelPricing 关联到对应 Provider
  3. ModelPricing 同时作为 Provider-Model 关联表和定价表，AIModelProviderMapping 删除
  4. Provider 配置弹窗简化为只需填 API Key + 可选 Base URL
  5. Provider 卡片内可展开模型列表，显示名称/类型/context_size/定价/启用状态
  6. 用户可手动添加自定义模型并关联到指定 Provider
  7. base_url 字段正确传递到 resolve_langchain_llm，支持 OpenAI 兼容类 Provider 自定义端点
**Plans**: 3 plans

Plans:
- [ ] 12.2-01-PLAN.md — Backend data model extensions + PROVIDER_META + preset seed logic
- [ ] 12.2-02-PLAN.md — resolve_langchain_llm DB-backed base_url + model CRUD endpoints + preset protection
- [ ] 12.2-03-PLAN.md — Frontend restructure: ProviderIcon, group separation, simplified modal, model list

**UI hint**: yes

Canonical refs:
- `api/app/models/ai_provider_config.py` — AIProviderConfig + AIProviderKey + AIModelProviderMapping 模型
- `api/app/models/model_pricing.py` — ModelPricing 模型
- `api/app/schemas/ai_provider.py` — Provider schemas
- `api/app/api/v1/ai_providers.py` — Provider API 端点
- `api/app/services/ai/provider_manager.py` — ProviderManager + resolve_langchain_llm
- `web/src/app/admin/providers/page.tsx` — Admin Provider 页面
- `web/src/components/admin/provider-card.tsx` — Provider 卡片组件
- `web/src/components/admin/provider-form-modal.tsx` — Provider 配置弹窗

### Phase 13: SkillDescriptor Enhancement + Pipeline Fix
**Goal**: Skill metadata system supports dependency declarations, tiered classification, and safety metadata; pipeline parameter mismatches fixed and Celery async chain repaired
**Depends on**: Phase 12 (unified credential path must be stable before expanding skill metadata)
**Requirements**: DESC-01, DESC-02, DESC-03, DESC-04, DESC-05, DESC-06, DESC-07, DESC-08, PIPE-01, PIPE-02, PIPE-04
**Success Criteria** (what must be TRUE):
  1. Every registered skill has a complete descriptor with skill_kind, require_prior_kind, supports_skip, skill_tier, and Claude Code-style safety metadata (backward-compatible defaults for unannotated skills)
  2. SkillToolset dynamically filters skills exposed to Agent based on session context, keeping ≤10 tools per context window
  3. Pipeline chain executes multi-step workflows with correctly aligned parameter names between pipeline_tools and skill handlers
  4. Pipeline properly handles Celery async skill results with poll loop and reports per-step progress via SSE events
**Plans**: TBD

### Phase 14: ArtifactStore + ToolInterceptor
**Goal**: Session-scoped artifact persistence with automatic injection/persistence hooks replaces inline data passing between tool calls
**Depends on**: Phase 13 (ToolInterceptor rules declared in enhanced SkillDescriptor metadata)
**Requirements**: ARTS-01, ARTS-02, ARTS-03, ARTS-04, ARTS-05, ARTS-06, PIPE-03
**Success Criteria** (what must be TRUE):
  1. Skill execution results persist to ArtifactStore (PostgreSQL agent_artifacts table) keyed by session_id + skill_name, with structured metadata (artifact_id, skill_kind, summary, timestamp)
  2. ToolInterceptor before-hook auto-injects upstream dependency artifacts into skill parameters based on SkillDescriptor declarations
  3. ToolInterceptor after-hook auto-persists skill results to ArtifactStore without explicit handler code
  4. Agent no longer passes large JSON blobs between tool calls — data flows through artifact references
  5. Pipeline chain passes results through ArtifactStore references instead of _chain_params hard-coding
**Plans**: TBD

### Phase 15: QueryEngine + Cost Tracking
**Goal**: Agent loop has token budget controls, smart termination, plan-then-execute mode, and full cost visibility in both backend and frontend
**Depends on**: Phase 14 (QueryEngine uses ArtifactStore for state tracking; cost tracking needs stable unified call path)
**Requirements**: QENG-01, QENG-02, QENG-03, QENG-04, QENG-05, QENG-06, QENG-07, COST-01, COST-02, COST-03, COST-04, COST-05, COST-06
**Success Criteria** (what must be TRUE):
  1. Agent session enforces configurable token budget and turn limits via PydanticAI native UsageLimits, terminating gracefully when exceeded
  2. Diminishing returns detection stops agent loop when consecutive turns produce minimal new output
  3. Complex multi-step tasks trigger "plan first, confirm, then execute" mode; simple single-step tasks bypass planning and execute directly
  4. Token usage and estimated cost tracked per turn, displayed in frontend chat UI with cumulative session totals
  5. SSE events include tool progress during async skill execution and usage summary (tokens, estimated cost) on completion
**Plans**: TBD
**UI hint**: yes

### Phase 16: Admin Skill Management
**Goal**: System administrators can monitor, manage, and control the complete skill system through a dedicated admin page
**Depends on**: Phase 13 (enhanced descriptors), Phase 14 (execution data from ArtifactStore)
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05, ADMN-06
**Success Criteria** (what must be TRUE):
  1. Admin API provides complete skill registry listing with descriptor metadata (name, category, tier, kind, dependencies) and execution statistics (invocation count, success rate, avg duration)
  2. Admin can enable/disable individual skills at runtime with immediate effect on agent tool availability
  3. Admin skill management page displays skill list table with sortable columns, category/tier filters, and inline execution stats
  4. Admin page uses Obsidian Lens design system (--ob-* tokens) and integrates with existing AdminShell layout, following TanStack Table patterns from v2.1
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 12 → **12.1 (INSERTED)** → **12.2 (INSERTED)** → 13 → 14 → 15 → 16

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 01. Foundation | v2.0 | — | Complete | 2026-03-27 |
| 02. Skill Migration | v2.0 | 9/9 | Complete | 2026-03-27 |
| 03. Agent System | v2.0 | 5/5 | Complete | 2026-03-28 |
| 03.1. Quality Fix | v2.0 | 4/4 | Complete | 2026-03-28 |
| 04. Media/Quota | v2.0 | 7/7 | Complete | 2026-03-29 |
| 05. Canvas/Billing | v2.0 | 6/6 | Complete | 2026-03-30 |
| 06. Collaboration | v2.0 | 7/7 | Complete | 2026-03-30 |
| 07. Admin API | v2.1 | 4/4 | Complete | 2026-04-01 |
| 08. Admin Shell | v2.1 | 2/2 | Complete | 2026-04-01 |
| 09. User/Team UI | v2.1 | 3/3 | Complete | 2026-04-01 |
| 10. Quota/Pricing/Provider | v2.1 | 4/4 | Complete | 2026-04-01 |
| 11. Dashboard/Polish | v2.1 | 4/4 | Complete | 2026-04-01 |
| 12. AI Call Convergence | v3.0 | 4/4 | Complete | 2026-04-02 |
| **12.1. Agent-First (INSERTED)** | **v3.0** | **5/5** | **Complete** | **2026-04-02** |
| **12.2. Provider Preset (INSERTED)** | **v3.0** | **0/3** | **Planned** | **-** |
| 13. Descriptor + Pipeline | v3.0 | 0/TBD | Not started | - |
| 14. ArtifactStore | v3.0 | 0/TBD | Not started | - |
| 15. QueryEngine + Cost | v3.0 | 0/TBD | Not started | - |
| 16. Admin Skills | v3.0 | 0/TBD | Not started | - |
