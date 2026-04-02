# Phase 12: AI Call Convergence - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Converge the 3 separate AI call stacks (PydanticAI+settings, ProviderManager sync+env, raw Gemini Image/Video+env) into a single unified ProviderManager async DB path. Activate KeyRotator with per-key health management backed by Redis. Extend Admin provider page with per-key health status and operations.

New skills, new pipeline capabilities, or business logic changes are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Credential Resolution Path
- **D-01:** All AI callers (Agent/PydanticAI, LLM Skills, Image/Video Skills, Celery Workers) resolve credentials through a single async `get_provider()` DB chain: team → personal → system → error (no env fallback at runtime)
- **D-02:** Environment variable keys are seed-only — `seed_providers_from_env()` writes them to DB on first startup; runtime never reads env vars for API keys
- **D-03:** Fully async unified path — one `get_provider()` implementation. Celery workers call it via `asyncio.run()`. No separate sync code path to maintain
- **D-04:** PydanticAI Agent resolves key from DB via `get_provider()` each time `create_agent()` / `create_pydantic_model()` is called — always uses latest key state
- **D-05:** Credential resolution results cached in Redis with short TTL (~60s). Admin key changes (disable/modify/delete) actively invalidate the cache for immediate effect

### Key Health Feedback Loop
- **D-06:** Key health state (error_count, last_used_at, usage stats) stored in Redis as hot cache — shared across all Web processes and Celery workers
- **D-07:** KeyRotator reads Redis for real-time health decisions (round-robin across healthy keys, skip keys with error_count >= threshold)
- **D-08:** On AI call failure (429/5xx): increment error_count in Redis immediately, auto-retry with next healthy key from rotation pool (CONV-09)
- **D-09:** On AI call success: update last_used_at in Redis
- **D-10:** Background sync from Redis to DB periodically (for Admin UI display and restart recovery)
- **D-11:** On service restart: restore Redis health state from DB

### Migration Strategy
- **D-12:** Claude's Discretion — approach for migrating 14 existing skills + Agent to unified path (big bang vs incremental, feature flags, etc.). Must satisfy CONV-06 regression safety requirement

### Admin Per-Key Health UI
- **D-13:** Detailed mode — each key displays: health badge (green/yellow/red), error_count, last_used_at, recent error history (last N errors with timestamp + error type), usage frequency trend
- **D-14:** Key-level operations: enable/disable toggle, reset error count button
- **D-15:** Uses existing Admin Provider page as base, extends with health information per key

### Claude's Discretion
- Migration strategy (incremental vs big bang, feature flags)
- Redis key naming scheme and TTL values
- Health badge thresholds (what error_count maps to green/yellow/red)
- Error history storage depth (how many recent errors to keep)
- Usage frequency trend visualization approach (chart type, time window)
- DB sync interval from Redis
- `get_provider_sync()` deprecation/removal timeline

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### AI Provider Infrastructure
- `api/app/services/ai/provider_manager.py` — ProviderManager with async `get_provider()` (dead code to activate), KeyRotator, `seed_providers_from_env()`, `get_provider_sync()` (to be replaced)
- `api/app/models/ai_provider_config.py` — AIProviderConfig + AIProviderKey models (has error_count, last_used_at, is_active, rate_limit_rpm fields)
- `api/app/services/ai/base.py` — AIProviderBase abstract base class
- `api/app/services/ai/llm_provider_base.py` — LLMProviderBase (logging, retry, timeout)

### Current 3 Call Stacks (to converge)
- `api/app/agent/agent_service.py` — Stack A: PydanticAI Agent, `create_pydantic_model()` reads settings directly
- `api/app/services/ai/provider_manager.py` `get_provider_sync()` — Stack B: LLM Skills use env-only sync path
- `api/app/skills/visual/generate_image.py` — Stack C: Image skill reads `settings.GEMINI_API_KEY` directly
- `api/app/skills/video/generate_video.py` — Stack C: Video skill reads `settings.GEMINI_API_KEY` directly

### Admin Provider UI
- `web/src/app/admin/providers/page.tsx` — Admin provider list page
- `web/src/components/admin/provider-card.tsx` — Provider card component
- `web/src/components/admin/provider-form-modal.tsx` — Provider form modal
- `api/app/api/v1/ai_providers.py` — Admin provider API endpoints

### Requirements
- `.planning/REQUIREMENTS.md` §AI Call Convergence — CONV-01 through CONV-11

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProviderManager.get_provider()` async — Full implementation exists (team→personal→system chain + Fernet decryption + KeyRotator). Currently dead code, needs activation
- `KeyRotator` class — Round-robin + error skip logic exists in memory. Needs Redis backing
- `AIProviderKey` model — Already has `error_count`, `last_used_at`, `is_active`, `rate_limit_rpm` fields
- `seed_providers_from_env()` — Already seeds env keys to system-level DB rows on startup
- `encrypt_api_key()` / `_decrypt_key()` — Fernet encryption helpers for API key storage
- Admin Provider CRUD — Full API + UI exists for provider/key management

### Established Patterns
- PydanticAI Agent created per-request in `AgentService.create_agent()` — natural injection point for DB-resolved keys
- LLM Skills use `get_provider_manager().get_provider_sync(provider, model=model)` — single call site pattern, easy to swap
- Celery + Redis already configured and in use for async skill execution
- Admin pages use Obsidian Lens design system + AdminShell layout + TanStack Table

### Integration Points
- `create_pydantic_model()` in `agent_service.py` — Replace `settings.*_API_KEY` with `get_provider()` call
- `get_provider_sync()` call sites in all LLM skills — Replace with async `get_provider()`
- `GeminiImageProvider` / `GeminiVideoProvider` instantiation in visual/video skills — Replace direct settings reads
- Admin provider API — Add health status endpoints, key-level operations
- Admin provider UI — Extend provider-card with per-key health display

</code_context>

<specifics>
## Specific Ideas

- Redis is already in the stack (Celery uses it) — reuse for key health cache and credential resolution cache
- env vars should feel like a "bootstrap" mechanism only, not a runtime dependency

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-ai-call-convergence*
*Context gathered: 2026-04-02*
