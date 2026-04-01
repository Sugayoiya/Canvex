# Phase 11: Monitoring Dashboard & Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 11-monitoring-dashboard-polish
**Areas discussed:** Dashboard Actionable Items, Monitoring Page Structure, Component Reuse Strategy, Usage/Cost Visualization, Dashboard Backend Data Gap, Polish Scope, API Client Namespace

---

## Dashboard Actionable Items

| Option | Description | Selected |
|--------|-------------|----------|
| Cards with jump + alert badge | KPI cards clickable, alert badges embedded in card | ✓ |
| Attention panel below cards | KPI cards pure display, separate "Needs Attention" block below | |
| Both combined | Cards clickable + separate Attention panel | |
| You decide | Claude decides based on one-screen constraint | |

**User's choice:** Cards with jump + alert badge
**Notes:** User noted cards have enough space (160px height) for alert badges. No need for extra panel.

---

## Monitoring Page Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single page with tabs | /admin/monitoring with Tab switching (Tasks / AI Calls / Skills) | ✓ |
| Sub-route split | Separate pages under /admin/monitoring/* with sidebar submenu | |
| You decide | Claude decides based on AdminSidebar structure | |

**User's choice:** Single page with tabs
**Notes:** Keeps sidebar simple with single Monitoring entry. Later extended to 4 tabs (+ Usage & Cost).

---

## Component Reuse Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| All new admin versions | New log tables in components/admin/, Recharts components reusable | ✓ |
| Extract shared hooks + admin shell | Hook extraction for data fetching, admin UI wrapper | |
| You decide | Claude judges per-component | |

**User's choice:** All new admin versions (with Recharts reuse exception)
**Notes:** User raised key concern: admin data is all-users scope vs single-user scope. Different APIs, different params, different auth requirements. Pure display Recharts components (data→UI only) are safe to reuse.

---

## Usage/Cost Visualization Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Monitoring page tab | 4th tab "Usage & Cost" in Monitoring | ✓ |
| Dashboard second area | Collapsible chart area below KPI cards | |
| You decide | Claude arranges based on one-screen constraint | |

**User's choice:** Monitoring page tab
**Notes:** Keeps Dashboard clean and within one-screen requirement.

---

## Dashboard Backend Data Gap

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing dashboard endpoint | Add `alerts` field to GET /admin/dashboard response | |
| New independent alerts endpoint | Separate GET /admin/alerts for alert data | ✓ |
| You decide | Claude decides based on endpoint structure | |

**User's choice:** New independent alerts endpoint
**Notes:** Clean separation of concerns between aggregate KPIs and actionable alerts.

---

## Polish Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full audit + fix all pages | Review all Phase 08-10 admin pages, add missing loading/error/empty states | ✓ |
| Phase 11 new pages only | Only ensure new dashboard/monitoring pages have three states | |
| You decide | Claude audits and judges per-page | |

**User's choice:** Full audit + fix all pages
**Notes:** Ensures consistent quality across entire admin console for milestone delivery.

---

## API Client Namespace

| Option | Description | Selected |
|--------|-------------|----------|
| Extend adminApi | All monitoring methods in existing adminApi namespace | ✓ |
| New monitoringApi | Separate namespace for monitoring | |
| Split by route prefix | adminApi for /admin/*, new logsApi for /logs/* | |

**User's choice:** Extend adminApi
**Notes:** Consistent with Phase 08 D-07/D-08 strategy of admin API centralization.

---

## Claude's Discretion

- Dashboard card click interaction details (hover, cursor)
- Monitoring tab filter field combinations
- GET /admin/alerts response schema design
- Log table column definitions and sort fields
- Error boundary implementation approach
- Loading skeleton specifics
- Bundle isolation verification

## Deferred Ideas

None — discussion stayed within phase scope
