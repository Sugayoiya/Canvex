# Pitfalls Research — Admin Console

**Domain:** Admin console on an existing multi-tenant SaaS (Canvas Studio v2.1 follow-on milestone)  
**Researched:** 2026-03-31  
**Sources:** OWASP multi-tenant guidance, common SaaS authorization/data-isolation patterns, audit-log scaling literature, billing idempotency patterns, plus alignment with this repo’s auth, quota, billing, AI provider, and UI stack.

---

## Security Pitfalls

**Privilege escalation and admin identity**

- **Trusting UI-only gates:** Hiding `/admin` in the sidebar or redirecting non-admins in Next.js is necessary UX but **not** security. Every admin mutation and list endpoint must enforce `require_admin` (or equivalent) server-side; otherwise JWT forgery, stale tokens, or direct API calls bypass the console.
- **Boolean `is_admin` without lifecycle policy:** A single global flag is simple but risky if promotion/demotion lacks **two-person review**, **break-glass** procedure, or **last-admin** protection. Pitfalls: locking out all admins, or leaving dormant ex-employee accounts as admins.
- **Self-demotion / last admin:** Allowing an admin to revoke their own `is_admin` without validation can strand the platform. Same for disabling the last active admin user.
- **JWT scope confusion:** Admin endpoints must not “widen” what the token implies (e.g. treating any authenticated user as admin if a query param says `admin=true`). Admin capability should be **derived only** from verified server-side user record (`is_admin`), not client hints.
- **IDOR on admin-scoped resources:** Admin APIs that accept `user_id`, `team_id`, or `project_id` must still **authorize the action as admin**, not reuse team-member checks that fail open for “any logged-in user with a guessable ID.”

**Admin route and surface exposure**

- **Predictable URLs:** `/admin` is fine if guarded; exposing **debug** or **internal** paths without the same dependency chain is a common mistake. Keep admin API under a clear prefix (e.g. `/api/v1/admin/...`) with consistent dependency injection.
- **Information leakage in errors:** Stack traces, SQL fragments, or “user not found” vs “forbidden” timing differences can aid enumeration. Admin list endpoints should return **consistent 404/403** policy where product policy requires it.
- **CORS and credentials:** Admin actions from the SPA must use the same cookie/header rules as the rest of the app; misconfigured CORS on admin-only routes sometimes ends up **more permissive** than general API routes.

**Credential leaks (AI Provider, encryption)**

- **Decrypting keys for admin UI “preview”:** Showing partial API keys in the browser increases XSS blast radius. Prefer **masked display** + rotate; never send full plaintext keys to the client if avoidable.
- **3-tier chain (team → global → env) vs admin edits:** System/global provider config is powerful. Pitfalls: **accidentally overwriting** team keys when “fixing” global config; logging decrypted keys in application logs; returning encrypted blobs in responses that clients echo back unvalidated.
- **Fernet / encryption at rest:** Key rotation and **versioned ciphertext** must be documented; admins rotating server secrets without re-encrypting rows causes **silent decryption failures** or fallback to env keys in confusing ways.

**Audit and accountability**

- **Admin actions without actor attribution:** If automated jobs use the same service account as human admins, audit trails become useless. Separate **system** vs **human** actor IDs in logs.

---

## Data Integrity Pitfalls

**Race conditions in pricing updates**

- **Lost updates:** Two admins editing the same `ModelPricing` row can overwrite each other (last-write-wins). Mitigations: optimistic locking (`version` column), ETag/`If-Match`, or explicit “edit” flow with merge UI.
- **In-flight usage vs new rates:** Requests started under old pricing may complete under new rates if cost attribution is computed **at the wrong time**. Define whether cost is locked at **enqueue**, **start**, or **completion** of a skill/AI call.
- **Partial application:** Updating DB pricing without invalidating caches (Redis, in-process) yields **split-brain** billing until TTL expires. Any cache keyed by model/provider must be invalidated or versioned with the pricing row.

**Quota edge cases (fail-closed, lazy reset)**

- **Fail-closed + admin misconfiguration:** Setting limit to `0` or NULL handling bugs can **deny all traffic** platform-wide if defaults are wrong. Admins need guardrails and confirmation for destructive limits.
- **Lazy reset races:** Period boundaries (monthly/daily) combined with lazy reset can produce **double consumption** or **skipped reset** if two workers reset concurrently without atomicity. Ensure reset and check are **transactional** or idempotent per period key.
- **Per-user vs per-team quotas:** A user in multiple teams may consume **both** scopes; admin UI that only shows one dimension causes **false “under limit”** readings. Document precedence (user cap vs team cap vs both enforced).
- **Admin-set quota vs usage log consistency:** If `QuotaUsageLog` and live counters diverge, support will trust the wrong number. Reconciliation jobs or single source of truth for “current period usage” reduce confusion.

**Cascading deletes and tenancy**

- **Disabling users vs team ownership:** Banning a user who is sole **team owner** can orphan teams or break billing attribution. Define behavior: transfer ownership, block ban until resolved, or cascade rules.
- **Admin deletion of teams/projects:** Hard deletes break **audit** and **billing history**; soft delete with retention is usually safer. Foreign keys and Celery tasks referencing deleted rows need **graceful failure** or cleanup queues.

---

## UX Pitfalls

**Hard-to-undo admin actions**

- **Irreversible deletes, key rotations, mass quota changes:** Without confirmation copy, diff preview, or short **undo window**, operators cause incidents. Prefer **soft-disable** (pricing rule off, user banned) over delete where possible.
- **Grant admin by mistake:** One-click promote without typing target email or second factor leads to **wrong-user** incidents. Strong confirmation and display of **full identity** (email + id) reduce error rate.

**Navigation and mental model**

- **Space-switcher (personal / team) vs admin context:** Admins can think they are “in a team” while performing **global** actions. Risk: wrong mental model and accidental cross-tenant assumptions. Use a **distinct admin shell** or clear **“System admin”** mode in the switcher so tenant context is obvious.
- **Information overload:** Dumping raw logs, full JSON, or 50 columns in user tables **slows decisions** and increases mis-clicks. Progressive disclosure (summary → detail drawer) matches how incidents are triaged.

**Dangerous defaults in forms**

- **Empty optional fields** interpreted as “unlimited” or “zero” inconsistently. Labels and placeholders must state the **effective default** after save.

---

## Performance Pitfalls

**Audit log growth**

- **Append-only tables without retention or partition strategy:** Queries for “all admin actions” or “all quota changes” degrade as rows grow; indexes bloat inserts. Plan **time-range queries**, **partitioning or archival** (hot/warm/cold), and **retention policy** aligned with compliance needs—not infinite growth in OLTP.
- **Logging everything synchronously:** Writing audit rows in the request path adds latency; consider **async enqueue** with **durable** fallback if the queue drops messages (trade-off: brief inconsistency vs availability).

**N+1 and heavy admin lists**

- **User/team lists with counts:** Loading members, projects, or usage per row without `joinedload`, subqueries, or aggregate SQL causes **N+1**. Admin pages are especially vulnerable because they **join more dimensions** than normal tenant views.
- **Unbounded exports:** “Download all users” CSV without pagination/streaming can **OOM** the API worker or browser.

**Dashboard and analytics query cost**

- **Recharts + aggregate endpoints:** Each widget firing a separate heavy query multiplies DB load. Prefer **one dashboard payload** or **materialized aggregates** refreshed periodically for admin home.
- **Dual SQLite / PostgreSQL date grouping:** `date_trunc`, `strftime`, and timezone behavior **differ** between engines. Pitfalls: charts that look correct in dev (SQLite) and **wrong buckets** in prod (PG), or off-by-one-day around UTC boundaries. Centralize date-bucketing in **one tested utility** and UAT both backends if both remain supported.

---

## Integration Pitfalls

**Breaking existing flows**

- **Changing global AI provider or pricing** affects **all** tenants immediately. Missing **feature flag**, **staged rollout**, or **read-only preview** causes production incidents. Communicate effective time in UI (“applies from next billing period” vs “immediate”).
- **Stricter admin-only validation** on shared schemas:** If the same Pydantic model is used for user and admin paths, tightening rules for admin can **accidentally break** non-admin endpoints.

**Sidebar and layout**

- **Space-switcher + new admin entry:** Duplicate nav items, or admin links visible under personal context only, confuse users. Align with **one source of truth** for `is_admin` in the client store and **mirror** server refusals.
- **Obsidian Lens (`--ob-*`) and inline styles:** Admin pages built ad hoc without tokens **look alien** and are harder to theme. Inconsistent tokens also make **focus states and contrast** regress (accessibility debt).

**State management**

- **Stale `is_admin` in Zustand after promote/demote:** User must **re-fetch profile** or WS invalidation after admin changes; otherwise UI shows admin chrome while API returns 403 or the reverse.
- **Caching React Query keys:** Admin list queries must use **distinct keys** from tenant-scoped queries so **invalidation** does not leak or wipe wrong caches.

**Celery / async jobs**

- **Jobs assuming user-scoped context:** Lifting filters for admins in HTTP handlers but **not** in workers leads to “works in API test, fails in background.” Shared helpers for **scope resolution** (user vs admin vs system) should be used in both paths.

---

## Summary for Canvas Studio (contextual checklist)

| Area | High-risk pitfall | Directional mitigation |
|------|-------------------|-------------------------|
| Security | Admin API relies on frontend-only checks | `require_admin` on every admin route; tests for non-admin 403 |
| Security | XSS exposes provider keys | Mask secrets; minimize plaintext in responses |
| Data | Concurrent pricing edits | Version column or merge workflow |
| Data | Quota lazy-reset races | Atomic period transitions; document user+team interaction |
| UX | Space-switcher vs global admin | Explicit admin mode in chrome |
| Performance | Audit + log tables unbounded | Retention, indexes for time-range, consider partition/archive |
| Performance | SQLite vs PG date charts | Single bucketing abstraction + dual-DB tests |
| Integration | `is_admin` stale in client | Refetch/invalidate auth profile after role change |

---

*This document is research input for v2.1 Admin Console planning; it does not prescribe implementation tickets.*
