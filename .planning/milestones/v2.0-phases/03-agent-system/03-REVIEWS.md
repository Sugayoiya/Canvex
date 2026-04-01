---
phase: 03
reviewers: [codex]
reviewed_at: "2026-03-28T14:20:00.000Z"
plans_reviewed: [03-01-PLAN.md, 03-02-PLAN.md, 03-03-PLAN.md, 03-04-PLAN.md, 03-05-PLAN.md]
---

# Cross-AI Plan Review — Phase 03

## Codex Review

## Plan 03-01 — Foundation (Deps + ORM + Schemas + SSE)

### 1. Summary
This is a solid base plan with the right primitives for REQ-05/06, but it is still infrastructure-only and carries hidden integration risk if schema/event contracts are not versioned and migration/index strategy is not explicit.

### 2. Strengths
- Clear Wave-1 foundation before service/API/UI work.
- Correct dependency choices (`pydantic-ai`, `sse-starlette`, frontend SSE client).
- Introduces persistent session/message models early, enabling later continuity features.
- Separates SSE protocol definitions from endpoint logic.

### 3. Concerns
- **HIGH**: No explicit DB migration/index plan for session/message tables (query latency and rollout risk).
- **MEDIUM**: SSE event protocol lacks stated versioning/compatibility strategy.
- **MEDIUM**: No retention/TTL strategy for agent messages; table growth risk.
- **LOW**: `database.py` touch in this phase may create cross-phase coupling if not minimal.

### 4. Suggestions
- Add migration task with indexes (`session_id`, `created_at`, `(project_id, canvas_id)`).
- Define protocol envelope now (`event`, `timestamp`, `request_id`, `session_id`, `version`).
- Add message retention policy (time-based or count-based) and archive strategy.
- Add contract tests for schema serialization/deserialization and SSE event shape.

### 5. Risk Assessment
**Overall: MEDIUM** — technically sound, but missing migration/index and protocol-hardening details could cause downstream instability.

---

## Plan 03-02 — SkillToolset + AgentService + ContextBuilder

### 1. Summary
This plan directly targets REQ-05 and aligns with locked decisions (PydanticAI, registry-discovered tools, mixed sync/async execution). The main risks are runtime robustness: blocking behavior in tool polling, provider/auth edge cases, and context/session consistency.

### 2. Strengths
- Good adapter boundary (`registry.discover()` → tool defs, `registry.invoke()` → execution).
- Practical guardrails: duplicate detection, safe tool naming, output truncation.
- Explicit provider mapping strategy, including DeepSeek-compatible OpenAI client path.
- Session persistence via typed adapter is appropriate for long-lived chats.

### 3. Concerns
- **HIGH**: 2s polling up to 120s inside `call_tool()` can starve concurrency under load if not fully non-blocking/cancellable.
- **HIGH**: Tool-name normalization (`.`→`_`) can still collide across namespaces; ambiguous invocation risk.
- **MEDIUM**: "explicit api_key + env fallback" needs strict precedence/error behavior to avoid accidental credential mix.
- **MEDIUM**: Last-20-message loading may break multi-step reasoning continuity and pipeline handoff quality.
- **LOW**: 2000-char truncation may cut structured JSON outputs and break downstream interpretation.

### 4. Suggestions
- Make polling cancellation-aware (session abort/disconnect), with jitter/backoff and per-skill timeout overrides.
- Use deterministic namespacing (`category__skill`) plus persisted original skill ID mapping.
- Define provider credential resolution order and fail-fast diagnostics (without key leakage).
- Use token-budget-based history truncation, not fixed message count.
- For large tool outputs, store full payload server-side and stream summarized + reference ID.

### 5. Risk Assessment
**Overall: MEDIUM-HIGH** — architecture is right, but execution-path reliability and naming/credential edge cases need tightening.

---

## Plan 03-03 — Agent API + Pipeline Tool + Tests

### 1. Summary
This is the phase-critical delivery plan because it operationalizes both REQ-05 and REQ-06. Endpoint coverage is good, but authz, SSE lifecycle handling, and pipeline execution guarantees need explicit treatment to avoid production regressions.

### 2. Strengths
- Complete session lifecycle API surface.
- Correct use of streaming endpoint for agent loop observability.
- Pipeline tool provides deterministic multi-step orchestration aligned with D6.
- Includes integration tests in same wave, which is the right timing.

### 3. Concerns
- **HIGH**: No explicit authorization boundaries (session ownership, project/canvas access checks).
- **HIGH**: SSE disconnect/reconnect behavior not specified (zombie runs, duplicate executions, orphan Celery tasks).
- **HIGH**: Pipeline chain is hardcoded; missing step-level failure policy (stop/continue/compensate/retry).
- **MEDIUM**: Missing idempotency for chat requests can duplicate tool execution on client retry.
- **MEDIUM**: Test plan unspecified for provider failures, tool timeout, malformed tool output, partial stream failure.

### 4. Suggestions
- Enforce authz checks on every endpoint by `user_id + project_id + canvas_id`.
- Add request idempotency key for chat/pipeline initiation.
- Define pipeline execution contract: per-step timeout, retry policy, failure propagation, and audit trail.
- Add SSE heartbeat + explicit terminal events (`done`, `error`, `aborted`) with guaranteed emission.
- Expand integration tests to include disconnect, retry, timeout, and permission-denied paths.

### 5. Risk Assessment
**Overall: HIGH** — this plan achieves goals only if authz + streaming lifecycle + pipeline failure semantics are made explicit.

---

## Plan 03-04 — Frontend Infrastructure (Store + API Client + SSE Hook)

### 1. Summary
The frontend infra plan is lean and well-scoped for REQ-06, with a sensible split of store/client/hook. Main risks are event-order correctness, reconnection/dedup behavior, and state consistency under rapid streaming updates.

### 2. Strengths
- Good modularization: transport (`api.ts`), state (`chat-store.ts`), stream logic (`use-agent-chat.ts`).
- Event-driven UI model matches required progress display.
- Abort support included from the start.
- Token accumulation strategy is straightforward and efficient for simple streams.

### 3. Concerns
- **HIGH**: No dedup strategy for reconnect/retry can produce duplicate assistant/tool events.
- **MEDIUM**: Updating "last message" by token assumes strict ordering; concurrent tool events can corrupt message assembly.
- **MEDIUM**: Missing explicit error state model (transport error vs model error vs tool error).
- **LOW**: Potential memory growth if messages are unbounded in Zustand.

### 4. Suggestions
- Track `event_id`/`request_id` and ignore already-applied events.
- Use message map keyed by `message_id` instead of positional "last message" updates.
- Add finite state machine for stream status (`idle/connecting/streaming/aborting/error/done`).
- Cap in-memory message count and lazy-load history.
- Add hook tests with mocked SSE event sequences including out-of-order events.

### 5. Risk Assessment
**Overall: MEDIUM** — good structure, but stream correctness under real network behavior needs stronger safeguards.

---

## Plan 03-05 — Chat Sidebar UI + Canvas Integration

### 1. Summary
The UI plan is detailed and user-focused, and it should satisfy REQ-06 visually. The main risk is integration quality: layout interactions with canvas, long-chat performance, and accessibility behavior during streaming.

### 2. Strengths
- Clear component decomposition with practical interaction details.
- Cursor-style tool/progress display maps directly to decision D7.
- Streaming affordances (thinking indicator, abort control) are aligned with backend event model.
- Explicit canvas/sidebar layout coordination.

### 3. Concerns
- **MEDIUM**: Fixed `380px` + `mr-[380px]` may break responsive/compact layouts and reduce usable canvas area.
- **MEDIUM**: No virtualization strategy for long histories; render cost may degrade quickly.
- **MEDIUM**: Accessibility details not called out (live regions for streaming updates, keyboard focus traps, reduced motion).
- **LOW**: React Query introduced in components without explicit dependency/ownership mention in earlier infra phase.

### 4. Suggestions
- Use responsive sidebar widths + overlay mode on smaller breakpoints.
- Add list virtualization for messages and tool-call blocks.
- Implement ARIA live regions for stream events and full keyboard navigation.
- Add UI tests for scroll lock behavior, abort flow, and session switching during active stream.
- Add visual checkpoint criteria (loading/error/empty/long-conversation states) before phase sign-off.

### 5. Risk Assessment
**Overall: MEDIUM** — likely to deliver visible value, but responsiveness/perf/a11y gaps could reduce production readiness.

---

## Consensus Summary

### Agreed Strengths
- Architecture correctly maps PydanticAI + SkillRegistry bridge pattern (AbstractToolset adapter)
- Clean separation: foundation → service → API → frontend infra → UI
- SSE streaming approach matches project constraints (single-directional, stateless, auto-reconnect)
- Good test timing (integration tests in same wave as API delivery)

### Agreed Concerns

**HIGH priority (must address before execution):**
1. **Authorization/session ownership** — Plan 03-03 endpoints lack explicit authz checks for session ownership and project/canvas access validation
2. **SSE disconnect/reconnect lifecycle** — No specification for zombie run prevention, duplicate execution avoidance, or orphan Celery task cleanup on client disconnect
3. **Pipeline failure semantics** — Hardcoded pipeline chain missing per-step timeout, retry policy, and failure propagation contract
4. **Tool polling concurrency risk** — 2s/120s blocking poll in SkillToolset.call_tool() can starve concurrency under load

**MEDIUM priority (should address):**
5. **Event deduplication** — No dedup strategy for SSE reconnect scenarios on frontend
6. **Tool name collision** — Dot-to-underscore normalization can collide across skill namespaces
7. **Message retention** — No TTL/archival strategy for agent_messages table growth
8. **Responsive layout** — Fixed 380px sidebar may break on smaller viewports
9. **Accessibility** — Missing ARIA live regions, keyboard focus management, reduced motion support

### Divergent Views
No divergent views (single reviewer). Recommend additional reviews with Claude or Gemini CLI for cross-validation.
