# Canvas Studio v2 Refactor

## What This Is

Canvas Studio is an AI-assisted short-film creation workbench. This refactor moves core capabilities into an internal Skill system, uses Celery for async orchestration, and prepares the platform for agent-driven canvas workflows.

## Core Value

A single, reliable Skill execution backbone that both canvas nodes and AI agents can use consistently.

## Requirements

### Validated

- ✓ Phase 1 foundation is implemented and running in repository structure.
- ✓ Phase 2 skill migration + canvas baseline + billing baseline — Validated in Phase 02: skills-canvas
- ✓ Phase 3 agent tool-calling orchestration — Validated in Phase 03: agent-system
- ✓ Phase 3.1 agent chat + canvas quality fix — 12 issues resolved across Agent Chat and Canvas
- ✓ Phase 4 media/slash skills + quota controls — Validated in Phase 04: media-tools

### Active

- [x] Phase 2 skill migration + canvas baseline + billing baseline (complete)
- [x] Phase 3 agent tool-calling orchestration (complete)
- [x] Phase 3.1 agent chat + canvas quality fix (complete)
- [x] Phase 4 media/slash skills + quota controls (complete)
- [ ] Phase 5 canvas/video polish + billing dashboard
- [ ] Phase 6 collaboration/versioning/production hardening

### Out of Scope

- Legacy monolith service extension — replaced by skillized architecture.
- Full production SLA hardening in Phase 1 — deferred to later phases.

## Context

- Backend: FastAPI + SQLAlchemy async + Celery + Redis + PostgreSQL/SQLite.
- Frontend: Next.js 16 App Router + React 19 + Zustand + Axios.
- Existing planning source: `canvas_studio_重构方案_v2_4ed204b5.plan.md`.
- Current reality: repository skeleton exists, but cross-phase GSD planning artifacts were missing before this initialization.

## Constraints

- **Architecture**: SkillRegistry + Celery must remain the core invocation path — this is the refactor center.
- **Traceability**: execution/logging/billing progress must be auditable by phase.
- **Delivery**: keep phase boundaries explicit to prevent scope leakage.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use GSD planning artifacts for audit baseline | Enables standardized cross-phase auditing and verification | ✓ Good |
| Treat current status as Phase 1 complete, Phase 2+ pending | Matches repository state and stated progress | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

- After each phase transition, move validated requirements and record new decisions.
- After each milestone, re-check core value, constraints, and scope boundaries.

---
*Last updated: 2026-03-29 after Phase 04 completion — 4 material-type nodes (text/image/video/audio), focus-panel system, template-driven workflows, asset library, video generation skill, quota enforcement*
