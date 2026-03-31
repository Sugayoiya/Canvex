# Features Research — Admin Console

**Context:** Subsequent milestone (v2.1) for Canvas Studio — an AI-assisted short-film workbench with multi-tenant teams, AI Canvas, agent chat (SSE + tools), billing/usage dashboards, task monitoring, quota enforcement, 3-tier AI Provider credentials, and OAuth + JWT. Research question: how SaaS admin consoles typically behave, what is table stakes vs differentiation for an **AI creative** platform, and expected behavior for user/quota/pricing/monitoring.

---

## Table Stakes

These are what operators and internal admins expect before the console feels “real.” Omitting them creates support friction and undermines trust in enforcement (quotas, pricing, access).

### User Management

- **Searchable directory**: Paginated list with search (email, display name), filters (status, admin flag, created date), sort by recency or activity where available.
- **Account lifecycle**: Disable/enable (or suspend/active) with immediate effect on login and API; clear visual state so support does not guess.
- **Role elevation**: Grant/revoke system-admin capability with safeguards (e.g., cannot remove the last admin, cannot demote self without another admin).
- **Read-only identity context**: OAuth-linked accounts, created_at, last activity if tracked — enough to resolve “cannot log in” tickets without database access.
- **No silent mutations**: Destructive or security-sensitive actions require confirmation and should be attributable (who changed what).

### Quota Management

- **View limits and consumption**: Per user and per team — current period usage vs cap (credits, calls, tokens, or whatever the product’s unit is), aligned with the same rules the runtime enforces (fail-closed, lazy reset).
- **Set and adjust limits**: CRUD or upsert of caps with validation; changes should apply consistently to new requests without requiring app restart.
- **Consistency with product UX**: Admins see the same numbers users see (or clearly labeled “admin view”) to avoid disputes.
- **Operational clarity**: When a user hits a limit, support can see *which* limit and *when* the window resets.

### Pricing Management

- **Model-level rules**: Create/read/update/deactivate pricing tied to provider + model (or SKU), including the unit of charge (per token, per image, per run, etc.) as the product defines it.
- **Effective dating (lightweight)**: At minimum, know what is “active” now; ideally avoid editing history in place without leaving a trace (even a simple `updated_at` helps).
- **Safe defaults**: Deactivated rules do not bill; ambiguous rules should fail closed or be blocked at save time.
- **Separation from end-user billing UI**: Operators manage catalog/rates; tenants still see usage and invoices/credits in the normal billing surface.

### AI Provider Management

- **System/global credentials**: Configure platform-owned keys and endpoints distinct from team-scoped and user-scoped consoles — same 3-tier fallback (team → global → env) visible in docs and UI labels.
- **Key hygiene**: Mask secrets in UI, rotate/replace flows, optional labels per key; surface last-used or error counts if the backend tracks them.
- **Provider enablement**: Which models or providers are available system-wide vs gated — aligned with pricing and feature flags if any.

### Monitoring & Audit

- **Cross-tenant operational views**: Task/skill execution logs, AI call logs, errors, latency/cost aggregates — filterable by user, team, project, status, time range (admins see what individual users see, plus global scope).
- **Usage and cost rollups**: Time-series and totals consistent with the billing dashboard; platform-wide slice for admins.
- **Audit for admin actions**: Who changed quotas, pricing, provider config, user status, admin flags — stored as structured events, not only application logs.
- **Support-oriented traceability**: Enough to answer “what failed for this user at 14:32?” without SSH.

### Team Overview

- **Directory of tenants**: All teams with name, id, member count, created date, optional owner/admin contact.
- **Drill path**: Link or path from team → members and high-level usage/quota (even if v1 is read-only aggregates).
- **Alignment with collaboration model**: Reflects real boundaries (team vs personal) the product already enforces in RBAC.

---

## Differentiators

Nice-to-have capabilities that stand out for **AI creative** workloads (heavy async jobs, variable cost, provider flakiness):

- **Quota proximity alerts**: Threshold warnings (e.g., 80%/100%) before hard blocks; optional in-app banners for admins scanning many accounts.
- **Provider health dashboard**: Error rates, rate-limit signals, last success — keyed off existing key metadata if available.
- **User/team drill-down pages**: Single place for “this user’s teams, recent tasks, spend, quota” — reduces tab-hopping across logs and billing.
- **Cost attribution by team/project**: Which tenants drive margin pressure; supports packaging and sales without a separate warehouse.
- **Bulk quota templates**: New-default for signups, batch apply to segments (e.g., all teams on plan X).
- **Export (CSV/JSON)**: Users, teams, usage, task samples — for finance, incident review, or ML on support tickets.
- **Pricing change history**: Immutable log or versioning when rates change — critical when reconciling invoices or debugging “why did this job cost more?”
- **Job-centric admin view**: Creative tools generate long-running tasks — admin views that emphasize **pipeline state** (queued/running/failed) and artifact links, not only HTTP request logs.

---

## Anti-Features (Avoid)

Features that look useful but often add security, compliance, or maintenance cost disproportionate to value at this stage:

- **Fine-grained admin RBAC** (super-admin vs billing-admin vs support-admin) when the team has a handful of operators — `is_admin` + careful API review is enough until scale demands it.
- **“Login as user” impersonation** without enterprise-grade audit, session isolation, and legal review — high risk; prefer read-only impersonation-style detail pages.
- **Raw SQL or document editors in the browser** — bypasses validation and audit; all changes should go through APIs.
- **Fully customizable admin dashboards** (widget marketplace, drag-and-drop) — large frontend cost; fixed IA with good filters wins faster.
- **SCIM/LDAP/HR provisioning** before there is enterprise revenue — defer until a committed customer needs it.
- **Admin-editable production secrets / feature flags** that bypass deployment review — use env + pipeline until there is robust approval workflow.
- **Real-time push everywhere** — polling or existing SSE patterns are enough for admin refresh rates; WebSocket fanout for all entities is heavy.
- **Multi-currency tax-grade pricing** inside the admin UI when the product is credit-based and single-region — adds accounting scope creep.

---

## Complexity Notes

**Relatively simple (mostly UI + thin endpoints):**

- Admin route guard, layout, and navigation gated on `is_admin`.
- Wiring existing quota and pricing CRUD APIs to tables and forms.
- System AI Provider list/edit using existing `owner_type=system` (or equivalent) APIs.
- Team list with member counts — standard aggregate query + pagination.
- Reusing billing usage/timeseries endpoints that already return admin-global data.

**Medium (new aggregates, joins, or scope lifts):**

- Dashboard “at a glance” KPIs combining users, teams, tasks, cost — multiple queries or one aggregate endpoint.
- Lifting user-scoped log filters to admin-global with the same pagination and safety (no PII leaks in URLs).
- User detail and team drill-down pages joining teams, quota usage, recent tasks, spend.
- Dedicated **admin action audit** stream if not already unified (beyond quota-only logs).

**Higher complexity (defer or phase):**

- Full impersonation, enterprise SSO admin roles, or hierarchical approval for pricing changes.
- Automated anomaly detection on usage (ML/alerting pipelines).
- Immutable pricing versioning with legal-grade audit and replay of historical charges.

---

*Research synthesized for Canvas Studio v2.1 Admin Console milestone; aligned with `.planning/PROJECT.md` (2026-03-31).*
