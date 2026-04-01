# Canvas Studio

## What This Is

Canvas Studio is an AI-assisted short-film creation workbench with Skill-based execution, Celery async orchestration, agent-driven canvas workflows, multi-tenant collaboration, and Obsidian Lens UI. The platform supports teams, groups, AI provider management, billing, and quota controls.

## Core Value

A single, reliable Skill execution backbone that both canvas nodes and AI agents can use consistently.

## Current Milestone: v2.1 Admin Console

**Goal:** 为系统管理员提供统一的管理控制台，覆盖用户、配额、定价、Provider、监控和团队的全面管理能力。

**Target features:**
- 用户管理 — 用户列表/搜索、禁用/启用、管理员提权/撤权
- 配额管理 — 查看/设置用户和团队配额上限（对接已有后端 API）
- 定价管理 — 模型定价 CRUD（对接已有后端 API）
- 系统级 AI Provider 管理 — 与普通用户 AI Console 权限隔离
- 全站监控 — 任务日志、AI 调用日志、计费统计的管理员全局视图
- 团队概览 — 全站团队列表与成员情况一览

## Requirements

### Validated

- ✓ v2.0 Phase 1 foundation — SkillRegistry + Celery + logging skeleton
- ✓ v2.0 Phase 2 skill migration + canvas baseline + billing baseline
- ✓ v2.0 Phase 3 agent tool-calling orchestration + SSE chat
- ✓ v2.0 Phase 3.1 agent chat + canvas quality fix (12 issues)
- ✓ v2.0 Phase 4 media/slash skills + quota controls
- ✓ v2.0 Phase 5 canvas/video experience + billing dashboard
- ✓ v2.0 Phase 6 collaboration + OAuth + Obsidian Lens UI
- ✓ v2.1 Phase 7 admin API foundation — audit model, user management, log scope lifts, dashboard
- ✓ v2.1 Phase 8 admin frontend shell — layout, sidebar, routing, dashboard page
- ✓ v2.1 Phase 9 user & team management UI — Users table (ban/enable, admin grant/revoke, search/filter/sort) + Teams read-only directory

### Active

- [ ] Admin Console Frontend — quota/pricing/provider/monitoring UI (Phases 10–11)

### Out of Scope

- Legacy monolith service extension — replaced by skillized architecture.
- Full production SLA hardening — deferred beyond admin console.
- Mobile app — web-first admin experience.

## Context

- Backend: FastAPI + SQLAlchemy async + Celery + Redis + PostgreSQL/SQLite.
- Frontend: Next.js 16 App Router + React 19 + Zustand + Axios.
- UI: Obsidian Lens design system (--ob-* tokens, Space Grotesk + Manrope).
- Auth: JWT HS256 + Google/GitHub OAuth, `User.is_admin` boolean for system admin.
- Existing admin backend: `require_admin` guard, quota CRUD API, pricing CRUD API, system-level AI Provider config.
- Admin frontend: shell + dashboard (Phase 08), user management + team overview (Phase 09) complete. Quota/pricing/provider/monitoring UI pending (Phases 10–11).
- Admin backend: complete — user management, audit trail, dashboard, log scope lifts, team overview API (Phase 07).

## Constraints

- **Architecture**: SkillRegistry + Celery remains the core invocation path.
- **UI consistency**: Admin pages must use Obsidian Lens design system (--ob-* tokens).
- **Permission isolation**: Admin routes must be `require_admin`-guarded; frontend must hide/block admin UI for non-admins.
- **Backward compatibility**: Existing team/personal AI Console must continue working independently.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use GSD planning artifacts for audit baseline | Enables standardized cross-phase auditing and verification | ✓ Good |
| Treat current status as Phase 1 complete, Phase 2+ pending | Matches repository state and stated progress | ✓ Good |
| Obsidian Lens as unified design system | Consistent visual identity across all pages | ✓ Good |
| User.is_admin boolean for system admin | Simple, sufficient for current scale | ✓ Good |

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
*Last updated: 2026-04-01 — Phase 10 Quota & Pricing & Provider Management UI complete*
