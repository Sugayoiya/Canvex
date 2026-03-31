# Stack Research — Admin Console

**Researched:** 2026-03-31  
**Scope:** v2.1 Admin Console — user/quota/pricing/provider/monitoring/team UI on top of existing Canvas Studio stack.

## Existing Stack (brief)

Backend already provides `require_admin`, quota/pricing CRUD, system AI Provider config, billing stats/timeseries, and partial global task logs. Frontend is Next.js 16.2 + React 19.2, TanStack React Query 5.95, Axios, Zustand, Tailwind 4, Obsidian Lens tokens, lucide-react, Recharts 3.8 (billing charts), and SSE via `@microsoft/fetch-event-source`. No dedicated admin routes or data-table/form libraries are in `package.json` yet.

## Additions Needed

### 1. Headless data tables — `@tanstack/react-table` (^8.21.0)

**Rationale:** Admin surfaces need sortable columns, column visibility, server-driven pagination, and stable row actions (disable user, grant admin, open quota drawer) without adopting a full “admin framework” or a styled grid that fights Obsidian Lens.

**Version note:** v8 is the current major line; pin `^8.21.0` (or latest 8.x at install time) for React 19 compatibility.

**Use for:** User list, team overview, pricing rules table, provider list, task/AI-call log tables.

### 2. Forms + validation — `react-hook-form` (^7.69.0) + `zod` (^4.3.0) + `@hookform/resolvers` (^5.2.0)

**Rationale:** Quota numeric limits, pricing CRUD payloads, and provider secret fields benefit from controlled validation, error mapping, and less boilerplate than hand-rolled `useState` for every field.

**Version note:** Add `zod` as a **direct** dependency (it may already appear transitively via tooling; admin forms should not rely on that). `@hookform/resolvers` 5.x supports Zod 4.

**Use for:** Quota edit dialogs, pricing create/edit, optional structured filters on log views.

### 3. Optional: row virtualization — `@tanstack/react-virtual` (^3.13.0)

**Rationale:** Only if task/AI-call tables prove slow with thousands of rows in the DOM. Defer until perf measurement; same vendor family as the table package.

### 4. Optional: CSV export — `papaparse` (^5.5.0) or none

**Rationale:** FEATURES research lists CSV export as a differentiator. For simple lists, `Blob` + manual CSV string is enough. Add `papaparse` only if you need robust quoting/escaping for arbitrary admin-defined exports.

### 5. Date/time presentation — built-in first

**Rationale:** Monitoring and audit views need readable timestamps and range labels. Prefer `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` before adding `date-fns` or `dayjs`. Add a date library only if range pickers or timezone logic become painful.

### 6. Real-time monitoring — no new transport

**Rationale:** Polling with React Query (`refetchInterval`) matches existing product patterns; SSE is already available for agent flows. Admin dashboards do not require WebSockets or a separate push stack ([FEATURES.md](./FEATURES.md) anti-feature A6).

### 7. Backend (out of stack “library” scope but relevant)

**Rationale:** New admin JSON APIs (user list/status/admin flag, team overview, lifted log scopes, dashboard aggregates) stay in FastAPI + Pydantic; no new Python web framework. Structured logs remain the source of truth; a future “audit UI” is query + table, not a new log product.

## Integration Points

| Addition | Connects to |
|----------|-------------|
| `@tanstack/react-table` | React Query `useQuery` for page/sort/filter params; Obsidian Lens classes on `<table>` / row shells; lucide-react for row actions |
| `react-hook-form` + Zod | Axios mutations in `web/src/lib/api.ts` (or parallel `adminApi` module); toast/error handling consistent with existing pages |
| Recharts (existing) | Admin dashboard cards and global usage charts — same patterns as `usage-chart.tsx` / `provider-pie-chart.tsx` |
| JWT + `User.is_admin` | Next.js `/admin` layout: check profile from auth store / me endpoint; redirect or 403 for non-admins; sidebar section gated like PROJECT.md requires |
| Celery / Redis / logs | Monitoring pages consume existing FastAPI log and billing endpoints; no frontend change to execution stack |

## What NOT to Add

- **AG Grid, MUI DataGrid, or full admin suites (Retool-style embeds):** Heavy bundles and theming mismatch with `--ob-*`; hard to justify for internal admin scale.
- **shadcn/ui wholesale adoption:** Useful as reference, but duplicating Radix + default tokens risks visual drift from Obsidian Lens unless every primitive is re-skinned.
- **WebSockets / Socket.io for admin “live” views:** Polling or existing SSE patterns are sufficient.
- **Separate admin SPA or micro-frontend:** Unnecessary split; App Router route groups `(admin)` keep one deployable.
- **GraphQL or tRPC layer:** REST + OpenAPI already matches the backend; adds migration cost for no admin-specific win.
- **OpenTelemetry in the browser for v2.1:** Server-side tracing can evolve later; admin UI needs queryable logs and charts, not client instrumentation.
- **Second charting library:** Recharts is already validated; avoid mixing Chart.js/Visx unless Recharts hits a hard limit.

---

*Aligned with [.planning/PROJECT.md](../PROJECT.md) milestone v2.1 and [.planning/research/FEATURES.md](./FEATURES.md).*
