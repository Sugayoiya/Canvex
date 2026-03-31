# Pitfalls Research

**Domain:** SaaS admin console for AI creative tool platform
**Researched:** 2026-03-31
**Confidence:** HIGH

---

## Critical Pitfalls

### 1. Implicit Admin Scope Bypass via Shared Endpoints

**What goes wrong:** Endpoints like `/logs/tasks`, `/billing/usage-timeseries`, and `/billing/usage-stats` use inline `if not is_admin` checks to conditionally drop user_id filters. A subtle bug (e.g., a new endpoint forgetting the check, or a query path not applying the filter) silently exposes all users' data to admins — or worse, to non-admins if the condition is inverted.

**Why it happens:** The codebase has two admin authorization patterns: (a) explicit `require_admin(user)` that raises 403 — used in quota.py, billing.py pricing CRUD, and ai_providers.py system scope; (b) implicit `getattr(user, "is_admin", False)` inline in query construction — used in logs.py and billing.py aggregates. Pattern (b) is error-prone because forgetting the check or misplacing it fails open (shows all data) instead of failing closed.

**How to avoid:**
- Standardize on a single pattern: either a `require_admin` guard at the top of admin-only routes, or a dedicated `get_admin_user` dependency that returns a user guaranteed to be admin.
- For dual-scope endpoints (user sees own data, admin sees all), extract a `scope_to_user(stmt, user)` helper that uniformly applies `where(user_id == ...)` for non-admins — one place to get right, one place to audit.

**Warning signs:** New admin endpoints that don't call `require_admin` or use the shared scoping helper; test suite doesn't have a non-admin test case hitting each dual-scope endpoint.

**Phase to address:** Phase 1 (API foundation) — establish conventions before building new endpoints.

---

### 2. Admin Self-Demotion / Last-Admin Removal

**What goes wrong:** An admin removes their own `is_admin` flag, or removes the last admin, leaving the system with no admin capable of managing anything. Recovery requires direct database access.

**Why it happens:** The `User.is_admin` field is a simple boolean with no business logic protecting it. The system has `DEFAULT_ADMIN_EMAIL` seed on startup, but no runtime guard against a "toggle admin" endpoint removing the last admin or an admin demoting themselves.

**How to avoid:**
- Before toggling `is_admin = False`, count remaining admins (`SELECT COUNT(*) WHERE is_admin = true AND id != target_user_id`). Reject if count < 1.
- Disallow self-demotion — admins cannot change their own `is_admin` flag; another admin must do it.

**Warning signs:** No test case for "last admin demotion attempt."

**Phase to address:** Phase 1 (user management API).

---

### 3. JWT Does Not Carry `is_admin` Claim — Stale Permission Window

**What goes wrong:** An admin is demoted, but their existing JWT (up to 30 minutes TTL) still passes `get_current_user`, and `is_admin` is fetched from the database on every request. This is actually correct — but the frontend `auth-store.ts` caches `user.is_admin` in localStorage via Zustand `persist`. If the store is not re-validated after admin status changes, the UI shows admin navigation even after demotion.

**Why it happens:** Backend correctly checks DB on each request (good). But the frontend stores `is_admin` at login time and never re-fetches until next login or page refresh that triggers `/users/me`. Admin UI visibility is driven by the stale cached value.

**How to avoid:**
- On admin actions (toggle admin, ban/unban), invalidate the target user's refresh token server-side so their next token refresh fails, forcing re-login.
- Frontend admin routes should also re-validate `is_admin` via a lightweight `/users/me` check on admin page mount (not just rely on cached store).

**Warning signs:** Admin UI still visible after another admin revokes your admin status without refresh.

**Phase to address:** Phase 1 (auth guard + state management).

---

### 4. Mixing Admin State into the Existing Auth Store

**What goes wrong:** Admin-specific state (current admin view context, selected user for editing, admin filter preferences) gets added to the existing `useAuthStore`, polluting the regular user auth state. This creates coupling — admin-specific bugs affect all users, and the persisted store grows with admin keys that leak to non-admin users' localStorage.

**Why it happens:** Convenience — `useAuthStore` already exists and persists. Developers add admin fields there to avoid creating a new store.

**How to avoid:**
- Create a separate `useAdminStore` (non-persisted or with its own persist key) for admin page state.
- `useAuthStore` only carries identity: `user`, `tokens`, `isAuthenticated`, `teams`, `currentSpace`.
- Admin-specific queries use React Query with dedicated query keys (e.g., `['admin', 'users', params]`).

**Warning signs:** `auth-store.ts` growing with admin-prefixed fields; non-admin users seeing admin keys in their localStorage.

**Phase to address:** Phase 1 (frontend architecture).

---

### 5. N+1 Queries in Admin List Endpoints

**What goes wrong:** Admin user list loads 50 users, then for each user fetches their teams, quota, and recent activity — resulting in 150+ queries per page load. With 1000+ users, the admin panel becomes visibly slow.

**Why it happens:** The existing user search endpoint (`/users/search`) returns max 20 results with no joins. Admin needs richer data (team count, quota usage, last login) that requires joins or aggregates not present in the current query pattern.

**How to avoid:**
- Design admin list endpoints with explicit `selectinload` or subquery aggregates from the start.
- Return denormalized summary data (team_count, total_credits_used) in the list response, not via separate API calls per row.
- Use server-side pagination with cursor or keyset (not offset) for large datasets.

**Warning signs:** Admin user list taking > 1s with 100+ users; frontend making per-row API calls.

**Phase to address:** Phase 2 (user management + team overview).

---

### 6. AuthGuard Has No Admin Route Protection

**What goes wrong:** The current `AuthGuard` only checks `isAuthenticated` and `PUBLIC_PATHS`. A non-admin user who knows the URL `/admin/users` can navigate there directly. Even if API calls fail with 403, the admin UI skeleton, navigation, and component code are still loaded and visible — leaking information about admin capabilities and creating confusion.

**Why it happens:** The current guard was built for a single role level (authenticated vs. not). No concept of protected-admin routes exists yet.

**How to avoid:**
- Add an `ADMIN_PATHS` prefix list (e.g., `["/admin"]`) to `AuthGuard` that checks `user.is_admin` before rendering.
- Alternatively, create a dedicated `AdminGuard` wrapper for the `/admin` layout.
- Consider Next.js middleware for server-side redirect before client hydration.

**Warning signs:** Non-admin can see the admin sidebar/layout even if data calls fail.

**Phase to address:** Phase 1 (frontend foundation).

---

### 7. Overloading the Admin Dashboard with Vanity Metrics

**What goes wrong:** The admin dashboard becomes a wall of numbers — total users, total teams, total tasks, total cost, charts for everything — most of which the admin glances at once and never acts on. Actionable items (users hitting quota, failed tasks, provider errors) get buried.

**Why it happens:** Dashboard is the first thing built; temptation to show "everything" to prove completeness. Creative AI platforms have many quantifiable metrics (tokens, costs, images generated, etc.) that are easy to display.

**How to avoid:**
- Lead with actionable items: "3 users at 90% quota", "5 failed tasks in last hour", "Provider X error rate spiked".
- Aggregate KPIs should be secondary — 3-4 max, not 10+.
- Defer time-series charts to sub-pages; the dashboard is a triage screen, not an analytics tool.

**Warning signs:** Dashboard requires scrolling; admin ignores the dashboard and goes directly to sub-pages.

**Phase to address:** Phase 3 (monitoring dashboard).

---

### 8. Admin Actions Without Audit Trail

**What goes wrong:** An admin bans a user, changes quota, toggles admin, or modifies pricing — but there's no structured record of who did what and when. When disputes arise ("I didn't change that quota"), there's no evidence.

**Why it happens:** The quota API already logs admin changes via `QuotaUsageLog` with `action="admin_set"` and `admin_user_id` in details JSON. But this pattern is ad-hoc — billing pricing changes, user status changes, admin flag toggles, and provider config changes have no equivalent audit logging.

**How to avoid:**
- Create a unified `AdminAuditLog` model (admin_user_id, action_type, target_type, target_id, old_value, new_value, timestamp).
- Emit audit events from all admin mutation endpoints, not just quota.
- Make the audit log append-only (no update/delete).

**Warning signs:** Only quota changes are auditable; admin can deny making a pricing change.

**Phase to address:** Phase 1 (API foundation) — define the model early, wire it incrementally.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Inline `is_admin` checks instead of dependency | Fewer files to modify | Inconsistent auth patterns, easy to miss on new endpoints | Never — standardize from day one |
| Client-side pagination for admin tables | Faster to implement | Browser freezes at 1000+ rows, wasted bandwidth | Only for tables guaranteed < 200 rows (e.g., AI providers) |
| Reusing `/users/search` for admin user list | No new endpoint | Missing fields (status, is_admin, team_count, last_login), no pagination metadata | Never for admin — create dedicated admin user list endpoint |
| `password_hash` in admin user response | Tempting to reuse User model as response | Security breach — leaks hashes via API | Never — always use a response schema that excludes sensitive fields |
| Storing admin UI preferences in auth-store | Quick to implement | Pollutes auth state, persists admin keys for non-admins | Never — create separate admin store |
| Soft-delete admin audit logs | Fits existing mixins pattern | Defeats audit trail purpose | Never — audit logs must be append-only |
| Using `datetime.utcnow()` (naive) for audit timestamps | Matches existing codebase pattern | Ambiguous timezone, Python 3.12+ deprecation warning | Acceptable short-term if entire codebase is consistent, but migrate to `datetime.now(timezone.utc)` |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| Admin user list + existing `/users/search` | Reusing search endpoint that excludes banned users (`status == "active"` filter) and limits to 20 | Create `/admin/users` with configurable status filter, no hardcoded limit, server-side pagination |
| Admin logs view + existing `/logs/skills` and `/logs/ai-calls` | These endpoints are hardcoded to `user_id == user.id` with no admin override | Either lift the scope (add `is_admin` bypass like `/logs/tasks` already does) or create parallel `/admin/logs/*` routes |
| Admin provider management + existing `/ai-providers?owner_type=system` | Already works — but adding admin views for team/personal providers requires changing ownership verification | Add read-only admin override to `_verify_config_ownership` for GET operations only; mutations still require proper ownership |
| Admin quota view + existing `/quota/user/{user_id}` | Already admin-gated — works as-is | Wire directly to admin UI; add user search/picker for the `user_id` parameter |
| Admin pricing + existing `/billing/pricing/` | `list_pricing` has no `require_admin` — any authenticated user can read pricing rules | Intentional? If pricing is public, fine. If admin-only, add guard. Document the decision. |
| User ban + existing login flow | `get_current_user` already checks `user.status == "banned"` and returns 403 | Ensure ban also invalidates refresh token so banned user can't refresh; verify frontend handles 403 gracefully (redirect to login with message) |
| Admin team overview + existing `/teams` | Existing team list is scoped to user's memberships | Create `/admin/teams` with cross-tenant view; reuse team model but with aggregate member counts |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| Unindexed `status` column on users table | Admin user list with status filter does full table scan | Add index on `users.status`; also consider composite index `(status, created_at)` for sorted+filtered queries | 1000+ users |
| COUNT(*) for pagination total on large tables | Each page load runs a full count query; noticeable latency | Use approximate counts for display (`EXPLAIN` row estimate) or cache total with short TTL; exact count only when user pages | 10000+ rows |
| Admin dashboard aggregating multiple tables | Dashboard loads slowly because it runs 5+ aggregate queries (users count, teams count, active tasks, total cost, provider status) serially | Batch into a single `/admin/dashboard-stats` endpoint; consider materialized view or cache for expensive aggregates | 100+ concurrent admin sessions or 100K+ log rows |
| Fetching all team members for team overview | N+1: load teams, then per-team member count | Use subquery aggregate: `select teams.*, (select count(*) from team_members where team_id = teams.id) as member_count` | 50+ teams |
| Client-side sorting/filtering of full user list | JavaScript sort on 5000 rows causes visible jank | Server-side sort/filter from the start; TanStack Table with server-side mode | 500+ rows with complex columns |
| Timeseries queries without time-range index | Admin monitoring page with date range filter scans entire `ai_call_logs` table | Ensure `(created_at)` index exists on `ai_call_logs` and `skill_execution_logs` | 100K+ log entries |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| No `require_admin` on new admin endpoints — relying only on frontend route hiding | Complete admin bypass via direct API call (curl/Postman) | Every admin endpoint MUST call `require_admin(user)` at the top; add automated test that calls each `/admin/*` route with a non-admin token and asserts 403 |
| Leaking `password_hash` in admin user list response | Offline brute-force of user passwords if response is intercepted or logged | Always use a Pydantic response schema that explicitly excludes `password_hash` and `refresh_token` |
| Admin can set `is_admin=True` on any user including themselves via profile update | Privilege escalation via PATCH `/users/me` | `UserProfileUpdate` schema must not include `is_admin` or `status` fields; admin toggle must be a dedicated endpoint with separate authorization |
| IDOR on admin endpoints — guessing user_id/team_id UUIDs | Accessing arbitrary user/team data without ownership | Less critical for admin (admins should see all), but non-admin endpoints must not accept arbitrary IDs — current `/users/search` correctly scopes |
| No rate limiting on admin actions | Admin account compromise leads to rapid mass changes (ban all users, delete all pricing) | Rate limit destructive admin actions (ban, admin toggle, pricing delete); require confirmation/2FA for bulk operations |
| Refresh token not invalidated on ban/demotion | Banned or demoted user can keep using the system until token expires (up to 7 days) | On ban: set `refresh_token = NULL` and `refresh_token_expires = NULL` in DB; on admin demotion: same, to force re-login with updated `is_admin` |
| Admin API routes discoverable in client bundle | Attackers see `/admin/users`, `/admin/teams` in JS bundles and probe | Use code-splitting with dynamic imports for admin pages; admin API paths should not appear in non-admin bundles |
| Cross-Site Request Forgery on admin state-changing endpoints | If admin visits a malicious page, it can trigger admin actions via forged requests | JWT Bearer auth in Authorization header (not cookies) is inherently CSRF-resistant — maintain this pattern; do NOT add cookie-based admin auth |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---|---|---|
| Admin sidebar visible in regular user navigation | Confusing for non-admins who see links they can't use; cluttered for admins who see regular + admin nav | Separate admin layout: `/admin/*` routes have their own sidebar with admin-only items; regular pages keep current sidebar. Admin enters via a clear "Admin Console" link (visible only to admins) in the user menu. |
| No confirmation on destructive actions | Admin accidentally bans a user or deactivates a pricing rule; no undo | Require explicit confirmation modal with the action description and target name. For irreversible actions (ban), consider a "cool-down" period or 2-step process. |
| Admin tables without useful empty states | Admin sees a blank table with no guidance when there are zero entries (e.g., no pricing rules configured yet) | Show contextual empty states: "No pricing rules configured. Add your first rule to start tracking costs." with a CTA button. |
| Overloading admin pages with every possible field | User list shows 15 columns including created_at, updated_at, email_verified, avatar URL — most irrelevant to the admin's task | Show 5-6 essential columns in the table (name, email, status, role, last active, teams). Additional details on click/expand. Column configuration is a differentiator, not table-stakes. |
| No loading/error states on admin data tables | Admin clicks a tab, sees nothing for 2 seconds, then data appears (or worse, old data from another tab) | Skeleton loaders matching table layout; error boundaries with retry buttons; stale-while-revalidate pattern via React Query. |
| Search that triggers on every keystroke | Admin types a username in the search box; every character fires an API call, causing rate limiting or jank | Debounce search input (300ms minimum); show loading indicator; cancel previous in-flight requests. |
| Inconsistent design language between admin and regular pages | Admin pages use different spacing, colors, or components than the rest of the app, feeling like a bolted-on afterthought | Use the same Obsidian Lens `--ob-*` tokens, same component library, same spacing scale. Admin-specific components (data tables, stat cards) should extend the existing design system, not introduce a parallel one. |
| No breadcrumbs or navigation context | Admin drills into a user's detail page but loses context of where they came from or what filter they had applied | Breadcrumb trail: Admin Console > Users > [user name]. Preserve table filter state when navigating back (via URL params or store). |

---

## "Looks Done But Isn't" Checklist

- [ ] **Non-admin cannot access any `/admin/*` API route** — automated test for every admin endpoint with a regular user token
- [ ] **Non-admin cannot see admin UI** — AuthGuard/AdminGuard blocks `/admin/*` frontend routes; no admin components in non-admin bundles
- [ ] **Admin can see banned/inactive users** — admin user list does NOT filter by `status == "active"` (unlike regular search)
- [ ] **Admin ban immediately invalidates user session** — refresh token cleared on ban; next API call returns 403
- [ ] **Admin demotion forces re-login** — refresh token cleared on is_admin toggle; UI re-validates
- [ ] **Last admin cannot be demoted** — server rejects the request; UI shows explanation
- [ ] **Self-demotion is blocked** — admin cannot remove their own admin flag
- [ ] **Audit trail covers ALL admin mutations** — not just quota (also user status, admin flag, pricing, provider config)
- [ ] **Admin tables paginate server-side** — no endpoint returns unbounded result sets
- [ ] **Admin response schemas exclude sensitive fields** — `password_hash`, `refresh_token`, `refresh_token_expires` never appear in API responses
- [ ] **Pagination total count is present** — admin tables show "Page 1 of 47 (932 users)" not just rows
- [ ] **Admin search is debounced** — no keystroke-per-request pattern
- [ ] **Empty states exist for every admin table** — not blank white space
- [ ] **Error states exist for every admin data fetch** — not silent failures
- [ ] **Admin pages use Obsidian Lens design tokens** — no ad-hoc colors or spacing
- [ ] **`/billing/pricing/` list endpoint has intentional access control decision** — currently no `require_admin` on GET; document if this is by design
- [ ] **`/logs/skills` and `/logs/ai-calls` have admin scope bypass** — currently hardcoded to `user.id`; admin console needs cross-user view

---

## Recovery Strategies

### "Admin locked themselves out"
1. Backend env var `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` creates admin on startup — use this to recover
2. Alternative: direct DB update `UPDATE users SET is_admin = true WHERE email = 'admin@example.com'`
3. **Prevention:** last-admin guard + self-demotion block

### "Admin accidentally banned a critical user"
1. Another admin can re-enable the user via the admin console
2. If the banned user was the only admin → use DEFAULT_ADMIN_EMAIL recovery
3. **Prevention:** confirmation modal with user name; "undo" window (soft-ban → hard-ban after 5 min)

### "Admin pricing change broke billing"
1. Pricing uses soft-delete (deactivate, not destroy) — reactivate the old rule
2. If modified in-place, check `updated_at` and audit log (once implemented) to identify the change
3. **Prevention:** audit log for pricing changes; consider making pricing append-only (new version instead of edit)

### "Admin API routes exposed to non-admins"
1. Immediate: verify all admin endpoints have `require_admin` guard
2. Run automated test suite against all `/admin/*` routes with non-admin token
3. **Prevention:** router-level middleware that enforces admin on all routes under the admin prefix

### "Performance degradation at scale"
1. Add database indexes for commonly filtered/sorted admin columns
2. Switch from client-side to server-side pagination
3. Add caching layer (Redis) for expensive dashboard aggregates
4. **Prevention:** design with server-side pagination from day one; load test with 10x expected data

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---|---|---|
| Implicit scope bypass (dual-scope endpoints) | Phase 1 — API conventions | Automated test: non-admin gets only own data on every dual-scope endpoint |
| Admin self-demotion / last-admin removal | Phase 1 — User management API | Test: last admin demotion returns 400; self-demotion returns 400 |
| Stale `is_admin` in frontend store | Phase 1 — Auth guard + admin store | Manual test: demote admin in DB, verify UI redirects on next navigation |
| Mixing admin state into auth-store | Phase 1 — Frontend architecture | Code review: auth-store has no admin-prefixed fields |
| N+1 queries in admin lists | Phase 2 — User/team management | Load test: 1000 users, admin list response < 500ms |
| No admin route protection in AuthGuard | Phase 1 — Frontend foundation | Test: non-admin navigating to `/admin/*` gets redirected |
| Vanity metrics dashboard | Phase 3 — Monitoring dashboard | UX review: dashboard fits in one viewport, actionable items are above fold |
| Missing audit trail | Phase 1 — API foundation (model) | Audit table has entries for every admin mutation type |
| No confirmation on destructive actions | Phase 2 — UI implementation | UX review: ban, delete, admin toggle all require confirmation |
| Password hash in response | Phase 1 — Response schemas | Automated test: no admin endpoint response contains `password_hash` |
| Admin routes in client bundle | Phase 1 — Frontend architecture | Bundle analysis: admin chunks not loaded for non-admin users |
| Client-side pagination | Phase 2 — Data tables | No admin list endpoint returns > 100 rows without `limit`/`offset` params |
| Unindexed admin query columns | Phase 1 — Database | EXPLAIN ANALYZE on admin list queries shows index usage |
| Existing log endpoints lack admin scope | Phase 2 — Monitoring | `/logs/skills` and `/logs/ai-calls` support admin cross-user scope or new `/admin/logs/*` routes exist |
| `/billing/pricing/` access control ambiguity | Phase 1 — API audit | Decision documented; either guard added or explicit comment why public |

---

## Sources

- Canvas Studio codebase analysis (deps.py, quota.py, billing.py, logs.py, users.py, ai_providers.py, auth-guard.tsx, auth-store.ts, security.py, user.py model)
- [Top 10 Admin Console Mistakes — Ouriken Blog](https://blog.ouriken.com/top-10-admin-console-mistakes-that-are-hurting-your-business-right-now/)
- [The Hidden Perimeter: SaaS Admin Tools Security — SaaS Pentest](https://saaspentest.io/blog/saas-internal-tool-security-risks.html)
- [How to Build a Secure Admin Panel — Aikido Dev](https://www.aikido.dev/blog/build-secure-admin-panel)
- [Common Admin Panel Problems — All Panel / Medium](https://medium.com/@allpanelexche/common-admin-panel-problems-and-practical-solutions-af3fa09dbe84)
- [Top 3 Ways to Improve Admin Consoles — Proximity Lab](https://www.proximitylab.com/top-3-ways-to-improve-admin-consoles/)
- [Locking Down FastAPI Against IDOR — Medium](https://medium.com/@raulereno/no-more-spoilers-locking-down-fastapi-against-idor-7a939ad2c988)
- [Stop SaaS Privilege Escalation — AppOmni](https://appomni.com/blog/saas-privilege-escalation-and-threat-detection/)
- [Fast Dashboard Lists with 100K Rows — Koder.ai](https://koder.ai/blog/fast-dashboard-lists-100k-rows)
- [Building High-Performance Virtualized Table — TanStack / Medium](https://medium.com/@ashwinrishipj/building-a-high-performance-virtualized-table-with-tanstack-react-table-ced0bffb79b5)
- [What is an Admin Panel? Complete Guide 2026 — Refine](https://refine.dev/blog/what-is-an-admin-panel/)
- [Zustand Scoping Patterns — DEV Community](https://dev.to/alexey79/stop-fighting-zustand-context-practical-store-scoping-patterns-for-react-3c71)
