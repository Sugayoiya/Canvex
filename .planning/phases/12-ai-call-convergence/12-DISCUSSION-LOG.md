# Phase 12: AI Call Convergence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 12-ai-call-convergence
**Areas discussed:** Credential Resolution Path, Migration Strategy, Key Health Feedback Loop, Admin Per-Key Health UI

---

## Credential Resolution Path

### Q1: How should the unified path handle sync/async (Celery workers)?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-resolve + inject | Resolve key in HTTP layer, pass to Celery task params. Worker doesn't touch DB | |
| Worker also queries DB | Worker maintains its own DB connection for full resolution | |
| Dual mode (async + sync) | Provide both async and sync DB resolution, same logic | |

**User's choice:** Initially option 1, but user raised concern about key staleness (admin disabling key between dispatch and execution). Revised to option 2 (Worker also queries DB), then further revised to full async unified path.
**Notes:** User pointed out that Worker needs DB access anyway for KeyRotator error feedback (CONV-08), so pre-resolve approach insufficient.

### Q2: How should PydanticAI Agent integrate?

| Option | Description | Selected |
|--------|-------------|----------|
| Resolve key before creating Agent | Call get_provider() then construct PydanticAI Model with resolved key | ✓ |
| Claude decides | Technical detail left to implementation | |

**User's choice:** Option 1 — resolve before Agent creation. Agent is created per-request so this naturally gives real-time key state.

### Q3: Async vs sync for Worker path?

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend async, Worker sync, shared logic | Two entry points, one resolution engine | |
| Fully async unified | Single async get_provider(), Celery uses asyncio.run() | ✓ |

**User's choice:** Fully async unified — one codebase, no sync path to maintain.

### Q4: Env var fallback in runtime?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep env fallback as last resort | team → personal → system → env → error | |
| Env as seed only, no runtime fallback | team → personal → system → error | ✓ |

**User's choice:** Env as seed only. seed_providers_from_env() writes to DB on first startup; runtime never reads env for keys.

### Q5: Redis cache for credential resolution?

**User's suggestion:** Cache resolved credentials in Redis to avoid DB hit on every AI call.
**Decision:** Yes — short TTL cache, admin changes actively invalidate.

---

## Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Big bang | All skills + Agent switch at once | |
| Incremental + feature flag | Batch migration with rollback capability | |
| Claude decides | Technical detail left to implementation | ✓ |

**User's choice:** Claude decides
**Notes:** Must satisfy CONV-06 regression safety requirement.

---

## Key Health Feedback Loop

### Q1: DB write strategy for health data?

| Option | Description | Selected |
|--------|-------------|----------|
| Every request writes DB | Most accurate, extra DB write per AI call | |
| Only on failure | Less DB load, but no last_used_at tracking | |
| Memory accumulate + periodic flush | Fast in-memory, batch DB writes | |
| Redis hot cache + periodic DB sync | Shared across processes, fast, durable | ✓ |

**User's choice:** Redis hot cache. User suggested Redis (already in stack for Celery) over pure in-memory approach.
**Notes:** Key advantages: multi-process shared state, survives single process crash, millisecond writes. Background sync to DB for Admin display and restart recovery.

---

## Admin Per-Key Health UI

| Option | Description | Selected |
|--------|-------------|----------|
| Simple mode | Health badge + error_count + last_used_at + enable/disable/reset | |
| Detailed mode | Above + error history + usage frequency trend | ✓ |
| Claude decides | Technical detail left to implementation | |

**User's choice:** Detailed mode
**Notes:** Full health dashboard per key with historical data.

---

## Claude's Discretion

- Migration strategy (incremental vs big bang, feature flags)
- Redis key naming and TTL values
- Health badge thresholds
- Error history depth
- Usage trend visualization
- DB sync interval

## Deferred Ideas

None — discussion stayed within phase scope
