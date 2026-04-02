# Canvas Studio

## What This Is

Canvas Studio is an AI-assisted short-film creation workbench with Skill-based execution, Celery async orchestration, agent-driven canvas workflows, multi-tenant collaboration, admin console, and Obsidian Lens UI. The platform supports teams, groups, AI provider management, billing, quota controls, and full admin monitoring/management capabilities.

## Core Value

A single, reliable Skill execution backbone that both canvas nodes and AI agents can use consistently.

## Current Milestone: v3.0 Agent System Upgrade

**Goal:** 全面升级 Agent 系统——统一 AI 调用路径、将 7 阶段剧集创作流程全部 Skill 化、增强 Agent 引擎层，最终让画布 Chat 面板能通过对话驱动完整的剧集创作工作流。

**Target features:**
- AI 调用收敛 + 模型管理统一（3 条割裂栈收敛为统一路径，激活 DB 级异步密钥链）
- QueryEngine（Token 预算、轮次限制、递减检测、"先计划再执行"交互模式）
- ArtifactStore + ToolInterceptor（会话级产物存储、工具调用前后自动注入/持久化）
- SkillDescriptor 增强（NodeMeta 式依赖声明、mode 参数、Skill 三层分类）
- 7 阶段剧集创作流程全面 Skill 化（原文→剧本→分镜→视频，覆盖 30+ Skills）
- Pipeline 修复 + Context Tools 扩充（含写操作 + 权限控制）
- Admin 技能管理页面
- 上下文压缩 + 统一重试策略 + 成本跟踪 + SSE 工具进度
- SubAgentTool 子代理架构
- Workflow Skill 持久化 + 跨会话 Agent 记忆

## Requirements

### Validated

- ✓ v2.0 Phase 1 foundation — SkillRegistry + Celery + logging skeleton
- ✓ v2.0 Phase 2 skill migration + canvas baseline + billing baseline
- ✓ v2.0 Phase 3 agent tool-calling orchestration + SSE chat
- ✓ v2.0 Phase 3.1 agent chat + canvas quality fix (12 issues)
- ✓ v2.0 Phase 4 media/slash skills + quota controls
- ✓ v2.0 Phase 5 canvas/video experience + billing dashboard
- ✓ v2.0 Phase 6 collaboration + OAuth + Obsidian Lens UI
- ✓ v2.1 Phase 7 admin API foundation — audit model, user management, log scope lifts, dashboard stats
- ✓ v2.1 Phase 8 admin frontend shell — AdminGuard, layout, sidebar, routing, Sonner toast
- ✓ v2.1 Phase 9 user & team management UI — TanStack Table user directory + Teams overview
- ✓ v2.1 Phase 10 quota/pricing/provider management — dual-tab quota editor, pricing CRUD, provider key management
- ✓ v2.1 Phase 11 monitoring dashboard & polish — KPI cards, 4-tab logs, AdminErrorBoundary on all pages
- ✓ v3.0 Phase 12 AI call convergence — 3 stacks unified to ProviderManager async path, Redis key health, credential cache, SQLite dropped
- ✓ v3.0 Phase 12.1 Agent-First Architecture — LangChain 替代 PydanticAI，17 @tool 纯函数工具集，10 Anthropic SKILL.md 三级加载，多供应商 LLM 切换（Gemini/OpenAI/DeepSeek），LangGraph SSE 流式

### Active
- [ ] QueryEngine——Token 预算、轮次限制、递减检测、"先计划再执行"模式
- [ ] ArtifactStore + ToolInterceptor——会话级产物自动注入/持久化
- [ ] SkillDescriptor 增强——依赖声明、mode 参数、三层分类
- [ ] Admin 技能管理页面
- [ ] 成本跟踪 + SSE 工具进度事件
- [ ] Canvas 完整 Agent 化（AGENT_CHAT_FOR_CANVAS flag 翻转 + canvas 节点走 agent chat 路径）

### Out of Scope

- Legacy monolith service extension — replaced by skillized architecture.
- Full production SLA hardening — deferred beyond admin console.
- Mobile app — web-first experience.
- Fine-grained admin RBAC (super-admin/billing-admin) — `is_admin` boolean sufficient at current scale.
- Login-as-user impersonation — high security/audit risk without enterprise-grade isolation.
- SCIM/LDAP provisioning — no enterprise customer demand yet.

## Context

- Backend: FastAPI + SQLAlchemy async + Celery + Redis + PostgreSQL. ~11.5K LOC Python.
- Frontend: Next.js 16 App Router + React 19 + Zustand + Axios + TanStack Table + Sonner. ~92K LOC TypeScript.
- UI: Obsidian Lens design system (--ob-* tokens, Space Grotesk + Manrope).
- Auth: JWT HS256 + Google/GitHub OAuth, `User.is_admin` boolean for system admin.
- Admin console: 7 pages (Dashboard, Users, Teams, Quotas, Pricing, Providers, Monitoring).
- Agent system: LangChain/LangGraph Agent (create_agent) + 17 @tool pure functions + SkillLoader 三级加载 (10 SKILL.md) + SSE streaming chat.
- Skills: 4 registered SkillRegistry skills (VISUAL×1, VIDEO×1, CANVAS×1, ASSET×1) + 10 Agent SKILL.md skills.
- AI call paths: Unified — all 13 call sites (10 LLM skills, Agent, Image, Video) use ProviderManager.get_provider() async DB chain (team→personal→system). Redis-backed KeyHealthManager + CredentialCache. No env fallback at runtime.
- 7-stage creation pipeline: Story Workshop → Import Episodes → Asset Extraction → Story-to-Script → Storyboard → Voice Analysis → Video Generation. Documented in `docs/framework/story-to-storyboard-dataflow.md`.
- Pipeline bugs: pipeline_tools.py has field name mismatches with skill handlers; Celery async return not properly awaited in chain.

## Constraints

- **Architecture**: SkillRegistry + Celery remains the core invocation path.
- **Database**: PostgreSQL only — SQLite support dropped. Redis required (Celery + key health cache).
- **UI consistency**: All pages must use Obsidian Lens design system (--ob-* tokens).
- **Permission isolation**: Admin routes `require_admin`-guarded; frontend hides admin UI for non-admins.
- **Backward compatibility**: Existing team/personal AI Console continues working independently.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Obsidian Lens as unified design system | Consistent visual identity across all pages | ✓ Good |
| User.is_admin boolean for system admin | Simple, sufficient for current scale | ✓ Good |
| Append-only AdminAuditLog model | Immutable audit trail, no update/delete | ✓ Good |
| Independent AdminShell (not extending AppShell) | Complete admin visual isolation | ✓ Good |
| TanStack Table for admin data tables | Server-side sort/filter/pagination with rich interactions | ✓ Good |
| Pricing DELETE as soft-deactivate | Preserves audit trail and historical data | ✓ Good |
| Fail-silent alerts query on dashboard | Badges omitted on API error, no user-visible error | ✓ Good |
| AdminErrorBoundary with setState remount | Clean error recovery with query invalidation | ✓ Good |
| Shared useAdminLogTable hook | Eliminates duplication across 3 log tab components | ✓ Good |
| PostgreSQL only, drop SQLite | Redis already required; no dual-DB maintenance overhead | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-03 after Phase 12.1 Agent-First Architecture complete*
