# Canvas Studio

## What This Is

Canvas Studio is an AI-assisted short-film creation workbench with Skill-based execution, Celery async orchestration, agent-driven canvas workflows, multi-tenant collaboration, admin console, and Obsidian Lens UI. The platform supports teams, groups, AI provider management, billing, quota controls, and full admin monitoring/management capabilities.

## Core Value

A single, reliable Skill execution backbone that both canvas nodes and AI agents can use consistently.

## Current State

Shipped v2.1 Admin Console (2026-04-02). The platform now has a production-grade admin console covering user management, quota/pricing/provider configuration, and cross-user monitoring with actionable dashboards.

**Next focus:** Agent system upgrade — QueryEngine, ArtifactStore, SkillDescriptor enhancements.

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

### Active

(To be defined in next milestone)

### Out of Scope

- Legacy monolith service extension — replaced by skillized architecture.
- Full production SLA hardening — deferred beyond admin console.
- Mobile app — web-first experience.
- Fine-grained admin RBAC (super-admin/billing-admin) — `is_admin` boolean sufficient at current scale.
- Login-as-user impersonation — high security/audit risk without enterprise-grade isolation.
- SCIM/LDAP provisioning — no enterprise customer demand yet.

## Context

- Backend: FastAPI + SQLAlchemy async + Celery + Redis + PostgreSQL/SQLite. ~11.5K LOC Python.
- Frontend: Next.js 16 App Router + React 19 + Zustand + Axios + TanStack Table + Sonner. ~92K LOC TypeScript.
- UI: Obsidian Lens design system (--ob-* tokens, Space Grotesk + Manrope).
- Auth: JWT HS256 + Google/GitHub OAuth, `User.is_admin` boolean for system admin.
- Admin console: 7 pages (Dashboard, Users, Teams, Quotas, Pricing, Providers, Monitoring) with AdminErrorBoundary, loading skeletons, empty states.
- Admin backend: user management, audit trail (append-only AdminAuditLog), dashboard KPIs, log scope lifts, team overview.
- Agent system: PydanticAI + SkillToolset + context_tools + pipeline_tools + SSE chat sidebar.

## Constraints

- **Architecture**: SkillRegistry + Celery remains the core invocation path.
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
*Last updated: 2026-04-02 after v2.1 milestone*
