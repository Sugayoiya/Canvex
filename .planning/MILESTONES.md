# Milestones

## v2.1 Admin Console (Shipped: 2026-04-01)

**Phases completed:** 5 phases, 17 plans, 32 tasks

**Key accomplishments:**

- Append-only AdminAuditLog model with JSON old/new changes, shared record_admin_audit service, and typed admin response schemas
- Admin user list/search/filter/sort + status/admin toggle endpoints with audit logging, safeguards, and cross-DB NULL sort handling
- Wire record_admin_audit into quota/billing/AI-provider admin endpoints with system-scope conditional and 8 integration tests
- Installed react-table + sonner deps, added --cv4-btn-secondary-border CSS token, Manrope 700 weight, and adminApi/quotaApi client namespaces
- AdminSidebar
- One-liner:
- Read-only admin teams table with search, pagination, and contextual empty states using Plan 01 reusable components
- key_hint column + non-sensitive keys list in provider API response, billingApi CRUD extension, TabBar and ProgressBar shared components for Wave 2 pages
- Dual-tab quota management page with expandable row editing, ProgressBar visualization, and save/reset mutations for per-user and per-team API usage limits
- TanStack Table pricing CRUD page with dynamic PricingFormModal, summary cards, status filter, and string-precision price handling
- ProviderCard with expandable key table (masked sk-••••XXXX display), add/revoke key lifecycle, and ProviderFormModal for system-scope provider CRUD with Obsidian Lens styling
- GET /admin/alerts with 3 documented count queries, X-Total-Count on 2 log endpoints, 6 adminApi methods, 8-variant StatusBadge, and configurable AdminErrorBoundary
- Actionable KPI cards with click-to-navigate, hover glow, alert badges, keyboard accessibility, and dual-query graceful degradation
- Shared useAdminLogTable hook + 3 log table components + Usage & Cost tab + full 4-tab monitoring page replacing placeholder
- AdminErrorBoundary wrapping all 7 admin pages below header with verified per-page loading/error/empty state matrix

---
