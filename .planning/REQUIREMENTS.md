# Requirements: Canvas Studio v2 Refactor

**Defined:** 2026-03-27
**Core Value:** A single, reliable Skill execution backbone for both canvas nodes and AI agents.

## v1 Requirements

### Foundation

- [x] **REQ-01**: Repository is split into standalone frontend/backend project skeleton.
- [x] **REQ-02**: SkillRegistry/Descriptor/Executor and Celery task path are implemented.

### Skills & Canvas

- [x] **REQ-03**: Core business services are migrated into structured Skills (TEXT/EXTRACT/SCRIPT/STORYBOARD/VISUAL).
- [x] **REQ-04**: Baseline canvas with 5 core node types executes through SkillRegistry.

### Agent System

- [x] **REQ-05**: Agent tool-calling loop can discover and invoke skills from registry tool definitions.
- [x] **REQ-06**: Chat sidebar can display tool calls and async progress.

### Media & Quota

- [x] **REQ-07**: Media/slash skills are available for image/video workflows.
- [x] **REQ-08**: Usage quota checks and enforcement exist at user/team level.

### Production Experience

- [x] **REQ-09**: Canvas interactions and video composition workflow meet target UX.
- [x] **REQ-10**: Billing dashboards and monthly usage outputs are available.

### Collaboration & Production

- [ ] **REQ-11**: Multi-role collaboration and version history are implemented.
- [ ] **REQ-12**: Production deployment/ops baseline (beat/monitoring/retention/export) is complete.

## v2 Requirements

### Future

- **REQ-F01**: Advanced cross-project workflow templates.
- **REQ-F02**: Enterprise compliance and audit export enhancements.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Legacy queue architecture extension | Replaced by Celery-first strategy |
| Full enterprise compliance in v1 | Deferred after production stabilization |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-01 | Phase 1 | Complete |
| REQ-02 | Phase 1 | Complete |
| REQ-03 | Phase 2 | Complete |
| REQ-04 | Phase 2 | Complete |
| REQ-05 | Phase 3 | Complete |
| REQ-06 | Phase 3 | Complete |
| REQ-07 | Phase 4 | Complete |
| REQ-08 | Phase 4 | Complete |
| REQ-09 | Phase 5 | Complete |
| REQ-10 | Phase 5 | Complete |
| REQ-11 | Phase 6 | Pending |
| REQ-12 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after GSD audit initialization*
