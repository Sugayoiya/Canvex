# Research Summary — Admin Console (v2.1)

## Stack Additions

- **`@tanstack/react-table` (^8.21)** — Server pagination, sort, column visibility, row actions; stays headless with Obsidian Lens styling.
- **`react-hook-form` + `zod` + `@hookform/resolvers`** — Quota/pricing/provider forms with validation; add `zod` as a direct dependency.
- **Defer unless needed:** `@tanstack/react-virtual` (large log tables), `papaparse` (only if CSV export needs robust escaping).
- **Prefer built-ins:** `Intl` for dates; **no** new real-time transport (poll + React Query; SSE already exists for agents).
- **Do not add:** Heavy grids (AG Grid/MUI), full shadcn wholesale, WebSockets for admin, second chart library, admin micro-frontend, GraphQL/tRPC, browser OpenTelemetry for v2.1.

## Feature Scope

### Table Stakes (must-have)

- **Users:** Searchable paginated directory; disable/enable; grant/revoke `is_admin` with last-admin/self safeguards; read-only identity (OAuth, timestamps, activity); confirmations + attributable mutations.
- **Quotas:** Per-user and per-team caps vs usage aligned with runtime enforcement; adjust limits without restart; clear which limit and reset window on block.
- **Pricing:** Model-level CRUD tied to provider/model + unit; active vs inactive; fail-closed saves; separated from tenant billing UX.
- **AI providers (system):** Global credentials vs team/env fallback visible in UI; masked secrets, rotate/replace; system-wide enablement aligned with pricing.
- **Monitoring & audit:** Cross-tenant task views; AI/skill logs and cost rollups consistent with billing; admin action audit (structured); enough to answer “what failed for this user when?”
- **Teams:** All-teams directory with counts/dates; drill to members and high-level usage/quota; matches real RBAC boundaries.

### Differentiators (nice-to-have)

- Quota threshold alerts; provider health (errors, rate limits); user/team drill-down pages; cost by team/project; bulk quota templates; CSV/JSON export; pricing change history; job-centric views (pipeline state, artifacts).

### Avoid

- Fine-grained admin RBAC before scale; **login-as-user** impersonation without enterprise audit; raw SQL/doc editors in browser; fully customizable admin dashboards; SCIM/LDAP pre-revenue; production secrets/flags bypassing deploy review; WebSocket fanout for all admin entities; multi-currency tax-grade pricing in UI for credit/single-region scope.

## Architecture Approach

- **Backend:** Keep FastAPI + `require_admin` on every admin list/mutation; register new surfaces via `router.py` (`/admin/...` prefix **or** resource paths with clear OpenAPI grouping). **Exists today:** quota PUT/GET (admin), billing pricing write + admin-global usage/stats, system `owner_type` AI providers, partial global task logs. **Gaps:** admin user list/PATCH, admin team list, global skill/AI-call/trace queries (extend `logs.py` or add `/admin/logs/*` to avoid breaking current clients).
- **Frontend:** App Router `src/app/admin/*` with `AdminGuard` (`user.is_admin` from auth store; refetch `/auth/me` on entry or after role changes). **Not** a third “space” — sidebar entry gated on `is_admin`; optional secondary admin nav; clarify global vs space context. Extend `api.ts` (`quotaApi`, pricing writes, admin log params; optional `adminApi`). React Query keys prefixed `['admin', ...]`. Reuse Recharts for dashboard cards.
- **Coexistence:** `/settings/ai` stays space-scoped; `/admin/providers` focuses system rows only.

## Build Order

1. Backend: admin users (list + status/`is_admin` PATCH) and, in parallel design, logs global scope for skills/AI/trace.
2. Frontend: `/admin/layout` + `AdminGuard` + sidebar + topbar breadcrumb for `admin`.
3. API client: `quotaApi`, billing pricing mutations, extended `logsApi`/`taskApi` matching backend.
4. Vertical slices: quotas → pricing → system providers → monitoring (tasks first; expand when logs ready) → teams overview.
5. Polish: 403/empty states, Lens consistency, optional layout convergence with legacy billing page.

## Key Risks & Mitigations

1. **UI-only admin “security”** — Enforce `require_admin` on every admin endpoint; derive admin from DB `is_admin`, never query params; test non-admin → 403.
2. **Last-admin / self-demotion lockout** — Validate promotions/demotions; block removing last admin and unsafe self-demotion; consider operational policy for break-glass.
3. **Concurrent pricing + cache** — Version/ETag or merge flow; invalidate pricing caches on write; define when cost is fixed (enqueue vs complete).
4. **Quota misconfig & lazy-reset races** — Confirm destructive limits; atomic/idempotent period resets; UI/docs for user **and** team quota interaction.
5. **Unbounded audit/logs & heavy lists** — Retention/partitioning strategy; aggregate dashboard payload or materialized rollups; avoid N+1 on team/user lists; stream/paginate exports.

## Downstream Notes

- Complexity tiers: **simple** — guard, layout, wiring existing quota/pricing/system provider APIs, team list aggregates; **medium** — dashboard KPIs, lifted log scopes, user/team drill-downs, dedicated admin audit API if not unified; **defer** — full impersonation, ML anomaly detection, legal-grade immutable pricing replay.
- Pitfalls to carry into requirements: masked provider keys; consistent list error shapes (enumeration); SQLite vs PostgreSQL date bucketing in one tested path; Celery/workers must use same scope rules as HTTP when logs go global; soft-disable over hard delete where possible for pricing/users/teams.
