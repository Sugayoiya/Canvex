# Roadmap: Canvas Studio

## Canvex Roadmap v2.1: Admin Console

- [x] **Phase 07: Admin API Foundation** — Admin user endpoints, audit log model, log scope lifts, dashboard stats, team overview API (completed 2026-04-01)
- [x] **Phase 08: Admin Frontend Shell** — AdminGuard, admin layout/sidebar, new deps, adminApi/quotaApi client, Toaster setup (completed 2026-04-01)
- [ ] **Phase 09: User & Team Management UI** — TanStack Table user directory, status/admin toggles, team overview table, confirmation modals
- [ ] **Phase 10: Quota & Pricing & Provider Management UI** — Quota editor, pricing CRUD table, system AI Provider management
- [ ] **Phase 11: Monitoring Dashboard & Polish** — Admin dashboard KPIs, global task/AI/skill logs, billing reuse, empty/error states, design consistency

### Phase 07: Admin API Foundation
**Goal**: Build all backend admin endpoints and data models needed by the admin console — user management, audit trail, log scope lifts, team overview, and dashboard aggregation.
**Depends on**: Phase 06
**UI hint**: no
**Requirements:** [REQ-13, REQ-14, REQ-15, REQ-16]
**Plans:** 4/4 plans complete

Plans:
- [x] 07-01-PLAN.md — [W1] AdminAuditLog model + record_admin_audit service + schemas + unit tests
- [x] 07-02-PLAN.md — [W2] Admin user management endpoints (list/status/admin toggles) + nullslast sort + tests
- [x] 07-03-PLAN.md — [W3] Admin observability: /logs/* scope lifts (all 6 endpoints) + paginated /admin/teams + /admin/dashboard + tests
- [x] 07-04-PLAN.md — [W2] Audit wiring: record_admin_audit into quota/billing/AI-provider admin endpoints + tests

**Success Criteria**:
1. `GET /admin/users` returns paginated user list with search/filter/sort; response excludes `password_hash` and `refresh_token`.
2. `PATCH /admin/users/{id}/status` toggles user status (active/banned) and invalidates refresh token on ban.
3. `PATCH /admin/users/{id}/admin` toggles `is_admin` with last-admin and self-demotion safeguards.
4. `AdminAuditLog` model exists; all admin mutations emit audit events (user, quota, billing pricing, AI provider system-scope).
5. `/logs/skills`, `/logs/ai-calls`, `/logs/ai-calls/stats`, `/logs/tasks`, `/logs/tasks/counts`, `/logs/trace/{trace_id}` support admin cross-user queries including team_id filter.
6. `GET /admin/teams` returns paginated teams with aggregate member counts.
7. `GET /admin/dashboard` returns aggregate KPIs (user count, team count, task stats, cost, system-scope provider status) with 24h/7d/30d windows.
8. All `/admin/*` endpoints return 403 for non-admin tokens (automated test).

### Phase 08: Admin Frontend Shell
**Goal**: Establish the admin frontend foundation — route guard, layout, navigation, API client extensions, and new dependencies.
**Depends on**: Phase 07
**UI hint**: yes
**Requirements:** [REQ-17, REQ-18]
**Plans:** 2/2 plans complete

Plans:
- [x] 08-01-PLAN.md — [W1] Install deps (@tanstack/react-table + sonner) + add --cv4-btn-secondary-border token + fix Manrope 700 + adminApi/quotaApi namespaces in api.ts
- [x] 08-02-PLAN.md — [W2] AdminShell/AdminSidebar/AdminTopbar components + admin layout + 7 placeholder pages + main sidebar Admin Console entry

**Success Criteria**:
1. `AdminGuard` blocks non-admin users from `/admin/*` routes; redirects to `/projects`.
2. `AdminShell` layout with `AdminSidebar` (Dashboard/Users/Quotas/Pricing/Providers/Monitoring/Teams + "Back to App") renders correctly.
3. `adminApi` and `quotaApi` namespaces added to `api.ts` with all admin endpoint methods.
4. `@tanstack/react-table` and `sonner` installed; `<Toaster>` mounted in admin layout with Obsidian Lens theming.
5. Admin pages are code-split (dynamic imports); non-admin bundles don't include admin components.
6. Sidebar gains conditional "Admin Console" link when `user.is_admin`.
7. Admin route entry re-validates `user.is_admin` via `/auth/me` fetch.

### Phase 09: User & Team Management UI
**Goal**: Build the admin user directory and team overview pages with full CRUD interactions.
**Depends on**: Phase 08
**UI hint**: yes
**Requirements:** [REQ-19, REQ-20]
**Plans:** 3 plans

Plans:
- [ ] 09-01-PLAN.md — [W1] Backend extensions (teams field, admin_count, owner_name) + AdminDataTable/AdminPagination/FilterToolbar reusable components
- [ ] 09-02-PLAN.md — [W2] StatusBadge/AdminBadge/RowDropdownMenu/ConfirmationModal + Users page full implementation
- [ ] 09-03-PLAN.md — [W2] Teams overview page (read-only table with search + pagination)

**Success Criteria**:
1. User management page: paginated TanStack Table with server-side sort, search (debounced 300ms), status filter; columns: name, email, status, admin flag, teams, last login, created.
2. Status toggle (enable/disable) with confirmation modal and toast feedback.
3. Admin role toggle (grant/revoke) with confirmation modal and toast feedback; UI shows "last admin" warning when applicable.
4. Team overview page: all-teams table with name, member count, owner, created date.
5. Both tables handle loading states (skeletons), error states (retry), and empty states (contextual message + CTA).
6. All data flows through React Query with `['admin', ...]` query keys.

### Phase 10: Quota & Pricing & Provider Management UI
**Goal**: Wire existing backend quota/pricing/provider APIs into admin management pages.
**Depends on**: Phase 08
**UI hint**: yes
**Requirements:** [REQ-21, REQ-22, REQ-23]

**Success Criteria**:
1. Quota management page: user/team picker with search; displays current quota vs usage; inline edit form to set limits via existing PUT endpoints; toast on success.
2. Pricing management page: TanStack Table listing model pricing rules (provider, model, unit, rate, status); create/edit form; deactivate with confirmation; wired to existing POST/PATCH/DELETE billing/pricing endpoints.
3. System AI Provider page: list system-scope providers; create/edit/delete provider configs; key management (add/remove, masked display); isolated from team/personal console.
4. All forms validate inputs before submission; error feedback via toast or inline messages.
5. Obsidian Lens design tokens used consistently (--ob-* variables, Space Grotesk + Manrope fonts).

### Phase 11: Monitoring Dashboard & Polish
**Goal**: Build the admin dashboard landing page and global monitoring views; polish all admin pages for production quality.
**Depends on**: Phase 09, Phase 10
**UI hint**: yes
**Requirements:** [REQ-24, REQ-25]

**Success Criteria**:
1. Admin dashboard: 4-6 KPI cards (total users, total teams, active tasks, failed tasks last 24h, total cost, providers with errors); actionable items above fold; links to sub-pages.
2. Global monitoring: task list (admin scope), AI call logs, skill execution logs with cross-user filtering and pagination.
3. Usage/cost time-series and breakdowns reusing billing components with admin-global data.
4. All admin pages have consistent Obsidian Lens styling, loading skeletons, error boundaries, and empty states.
5. Admin actions have sonner toast feedback.
6. Admin dashboard fits in one viewport without scrolling; actionable items prioritized.
7. Bundle analysis confirms admin chunks are not loaded for non-admin users.

---

## Canvex Roadmap v2.0: Skill + Celery Refactor

- [x] **Phase 01: Foundation + SkillRegistry + Celery + Logging**
- [x] **Phase 02: Full Skill Migration + Base Canvas + Billing Baseline** (completed 2026-03-27)
- [x] **Phase 03: Agent System + Tool Calling + Pipeline Orchestration** (completed 2026-03-28)
- [x] **Phase 04: Media/Slash Skills + Quota Controls** (completed 2026-03-29)
- [x] **Phase 05: Canvas/Video Experience + Billing Dashboard** (completed 2026-03-30)
- [x] **Phase 06: Collaboration + Versioning + Production Hardening** (completed 2026-03-30)

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
**Plans:** 6/6 plans complete

Plans:
- [x] 05-01-PLAN.md — [W1] Backend APIs: batch execution (topo sort) + billing timeseries + task monitoring + node history
- [x] 05-02-PLAN.md — [W1] Frontend Infra: npm deps + CSS --cv5-* tokens + NodeShell V5 + PanelHost V5 routing
- [x] 05-03-PLAN.md — [W2] V5 Node Toolbars (Image/Video/Audio) + AudioNode WaveSurfer rewrite
- [x] 05-04-PLAN.md — [W2] Batch Execution Frontend: useBatchExecution + BatchExecutionBar + workspace integration
- [x] 05-05-PLAN.md — [W2] Billing Dashboard: KPI cards + Recharts charts + usage table + project view
- [x] 05-06-PLAN.md — [W2] Task Monitoring Page + Node Execution History popover

**Success Criteria**:
1. Canvas interactions and video composition flow are usable.
2. Billing dashboard shows usage/cost summaries.
3. Operational visibility includes task monitoring readiness.

### Phase 06: Collaboration + Versioning + Production Hardening
**Goal**: Deliver multi-tenant collaboration (Global Admin → Team → Group), AI Provider DB management with multi-key routing, project/canvas CRUD with ownership, and authentication enhancements (OAuth + AuthGuard).
**Depends on**: Phase 05
**UI hint**: yes
**Requirements:** [REQ-11, REQ-12]
**Plans:** 7/7 plans complete

Plans:
- [x] 06-01-PLAN.md — [W1] Backend Models: Org hierarchy (Group/GroupMember/GroupProject) + OAuthAccount + AI Provider DB models + deps extension
- [x] 06-02-PLAN.md — [W2] ProviderManager DB rewrite (KeyRotator, credential chain, env seeding) + AICallLog dimension enrichment
- [x] 06-03-PLAN.md — [W1] Frontend Infra: Obsidian Lens tokens + AuthGuard + auth-store extension + API client
- [x] 06-04-PLAN.md — [W2] Backend API: OAuth (Google+GitHub) + Team/Group/Invitation CRUD + schemas
- [x] 06-05-PLAN.md — [W3] Backend API: Project CRUD + User search + AI Provider admin + route registration
- [x] 06-06-PLAN.md — [W2] Frontend: Login page (Obsidian Lens+OAuth) + AppShell layout (Sidebar+Topbar)
- [x] 06-07-PLAN.md — [W4] Frontend: Project Dashboard + Team Management + AI Console + Invite Acceptance

**Success Criteria**:
1. Multi-role collaboration and version history are available.
2. Production deployment and periodic jobs are stable.
3. Audit/log retention and export pathways are defined.
