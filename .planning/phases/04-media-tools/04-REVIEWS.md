---
phase: 04
reviewers: [codex]
reviewed_at: 2026-03-30T15:00:00Z
plans_reviewed: [04-01-PLAN.md, 04-02-PLAN.md, 04-03-PLAN.md, 04-04-PLAN.md, 04-05-PLAN.md, 04-06-PLAN.md, 04-07-PLAN.md]
---

# Cross-AI Plan Review — Phase 04

## Codex Review

> Model: gpt-5.3-codex | Session: 019d3a82-7975-7f92-b275-b1b76afe0935

### Plan 04-01: Frontend Infra

#### 1) Summary
Strong foundational plan for the UI migration: tokens, connection rules, and shared node primitives are the right first-step investments. Main risk is migration safety while old and new node types co-exist in active canvases.

#### 2) Strengths
- Establishes a reusable visual system early via `--cv4-*` tokens.
- Rewrites connection rules before new node rollout, reducing ad-hoc logic later.
- Adds backward compatibility (`LEGACY_TYPE_MAP`) explicitly.
- Introduces shared `NodeShell` and `StatusIndicator`, which should reduce duplicate node UI code.
- Fixes known mapping bugs before adding more complexity.

#### 3) Concerns
- [HIGH] Legacy/new rule conflicts may produce inconsistent edge validation for existing saved canvases.
- [MEDIUM] 30+ CSS variables without a token ownership map can lead to drift and dead tokens.
- [MEDIUM] `useUpstreamData` shape change (`videoUrl[]`, `audioUrl[]`) can break implicit assumptions in existing hooks/components.
- [LOW] `StatusIndicator` states may diverge from backend task states if enum mapping is not centralized.

#### 4) Suggestions
- Add a migration compatibility test matrix: legacy node x material node x edge direction.
- Define a canonical execution-status enum shared between backend and frontend.
- Add runtime guards/defaults in `useUpstreamData` for old node payloads.
- Add visual regression snapshots for `NodeShell` and `StatusIndicator` across themes.

#### 5) Risk Assessment
**MEDIUM** — Good ordering and scope, but compatibility edge-cases can cause user-visible canvas breakage if not tested.

---

### Plan 04-02: Backend Quota

#### 1) Summary
This plan addresses REQ-08 directly and puts enforcement in the correct layer (`SkillExecutor`). The biggest issue is the proposed `fail-open` behavior, which conflicts with deterministic enforcement and can leak spend under partial outages.

#### 2) Strengths
- Correct cross-cutting placement at executor boundary.
- Supports both user and team quota dimensions.
- Adds explicit error codes for quota policy outcomes.
- Includes cost estimation API tied to `ModelPricing`.

#### 3) Concerns
- [HIGH] `fail-open on error` undermines deterministic quota outcomes and billing safety.
- [HIGH] Counter updates are vulnerable to race conditions without transactional/atomic increments.
- [HIGH] Celery retry/idempotency can double-charge usage unless execution IDs are deduplicated.
- [MEDIUM] Quota reset via lazy strategy needs timezone/period boundary definition to avoid off-by-one resets.
- [MEDIUM] `PUT` quota endpoints create abuse risk without strict authz/audit controls.
- [MEDIUM] Missing policy precedence details (team exceeded vs user exceeded vs both).

#### 4) Suggestions
- Change to fail-closed for enforcement path, with controlled allowlist bypass only for internal admins.
- Implement atomic increment semantics (`SELECT ... FOR UPDATE` or DB-native atomic updates).
- Make `update_usage` idempotent by `skill_execution_id` unique key.
- Define a deterministic policy order and document it in API contracts.
- Lock quota admin endpoints behind role-based authorization and audit logging.

#### 5) Risk Assessment
**HIGH** — Core requirement-critical area with correctness and financial risk if concurrency and fail-open behavior are not fixed.

---

### Plan 04-03: Backend Video Skill

#### 1) Summary
Good, focused addition that closes a clear capability gap for REQ-07. Main risks are provider availability uncertainty and long-running job lifecycle handling.

#### 2) Strengths
- Adds provider fallback for `auto`, improving resilience.
- Introduces dedicated video provider abstraction instead of embedding model-specific logic in handlers.
- Registers skill with async Celery execution mode, aligned with workload characteristics.
- Includes graceful handling for unavailable models.

#### 3) Concerns
- [HIGH] Availability confidence is only medium; no fallback path if Veo/video API is unavailable regionally.
- [MEDIUM] Missing explicit job polling/callback lifecycle contract for long generation times.
- [MEDIUM] Potential payload/security issues if arbitrary `image_url` inputs are accepted without validation.
- [MEDIUM] Queue capacity/timeout/retry settings for heavy media workloads are not specified.
- [LOW] No mention of content-safety/moderation pass before provider submission.

#### 4) Suggestions
- Add provider capability probing at startup and feature flag rollout.
- Define async contract clearly: enqueue response, status endpoint, terminal states.
- Validate/sanitize input URLs and enforce allowed schemes/size limits.
- Add media queue QoS settings (concurrency, timeout, retry backoff, dead-letter handling).
- Add provider-agnostic error taxonomy mapped to deterministic user-facing codes.

#### 5) Risk Assessment
**MEDIUM** — Technically sound direction, but external-provider uncertainty and async lifecycle gaps can delay production readiness.

---

### Plan 04-04: Material Nodes + Hooks

#### 1) Summary
Solid UI-domain decomposition with reusable hooks and backward-compatible registry. Risk centers on state coupling and prompt-construction correctness across mixed node types.

#### 2) Strengths
- `useNodeFocus` and `usePromptBuilder` separate interaction and prompt logic cleanly.
- Material nodes align directly with the new canvas mental model.
- Backward-compatible node registry lowers migration disruption.
- `NodeShell` reuse should keep behavior consistent across node types.

#### 3) Concerns
- [HIGH] Registry with 14 entries (new + legacy) can hide collisions and ambiguous rendering paths.
- [MEDIUM] Prompt assembly may introduce injection/overflow issues without truncation and sanitization rules.
- [MEDIUM] Focus state can become unstable in multi-select/drag/keyboard flows if event ordering is not defined.
- [LOW] Audio placeholder-only node may confuse execution expectations unless explicitly non-executable.

#### 4) Suggestions
- Add explicit precedence rules for node type resolution (legacy vs material).
- Add prompt size/token budget checks and escaping/sanitization strategy.
- Define focus event contract (`click`, `drag start`, `pane click`, `escape`) and test it.
- Mark audio node capability flags (`coming_soon`, non-runnable) in schema/UI.

#### 5) Risk Assessment
**MEDIUM** — Architecture is good, but mixed-registry and prompt/focus edge-cases need tighter contracts.

---

### Plan 04-05: Focus Panels + Menus

#### 1) Summary
Feature set is well-aligned with the new interaction model and user efficiency goals. Risk is UI complexity and integration fragility (positioning, interaction conflicts, and accessibility).

#### 2) Strengths
- `PanelHost` centralizes overlay rendering and placement logic.
- Separates generation, formatting, templates, and creation into focused UI modules.
- Adds contextual node-creation filtering using `NODE_IO` compatibility.
- Keeps some features visual-only for MVP to control backend scope.

#### 3) Concerns
- [HIGH] Overlay positioning and z-index/pointer event conflicts can break core canvas interactions.
- [MEDIUM] `AIGeneratePanel` can trigger expensive actions without visible quota pre-check feedback.
- [MEDIUM] Keyboard accessibility and focus trapping are not addressed.
- [MEDIUM] Multiple floating surfaces increase risk of accidental state loss on blur.
- [LOW] Hardcoded dimensions may be brittle on smaller screens.

#### 4) Suggestions
- Define overlay layering contract and pointer-event strategy before implementation.
- Add synchronous preflight quota/cost check in panel submit flow.
- Implement keyboard navigation/focus trap/escape handling as MVP requirements.
- Add responsive breakpoints and collision-aware panel placement.
- Add interaction tests for drag, pan, zoom, and panel coexistence.

#### 5) Risk Assessment
**MEDIUM** — UX value is high, but interaction complexity can cause regressions without strict UI contracts/tests.

---

### Plan 04-06: Asset Library

#### 1) Summary
Useful capability that supports template workflows and reuse, but backend API/data-model boundaries need tightening for scale, security, and data consistency.

#### 2) Strengths
- Clear project-scoped asset model tied to canvas context.
- CRUD API and frontend API extension are straightforward and implementable.
- UI includes practical save/reuse flows and drag-to-canvas interaction.

#### 3) Concerns
- [HIGH] Storing large `content/config_json` blobs without limits/versioning can degrade DB performance.
- [HIGH] Missing explicit authz checks for project-scoped asset access (horizontal data leak risk).
- [MEDIUM] No pagination/filtering/sorting in `GET /assets` for large projects.
- [MEDIUM] No update/version endpoint may force delete/recreate and lose references/history.
- [LOW] Drag payload trust boundary may allow malformed data insertion paths.

#### 4) Suggestions
- Add size limits, optional external object storage, and schema validation for JSON payloads.
- Enforce project membership checks on every asset endpoint.
- Add pagination and indexed filters (`type`, `tags`, `node_type`, `created_at`).
- Add `PATCH /assets/{id}` and optional version metadata.
- Validate drag-drop payloads server-side before node creation.

#### 5) Risk Assessment
**MEDIUM** — Feature is valuable, but data/auth constraints must be strengthened to avoid scale and security problems.

---

### Plan 04-07: Integration + Templates

#### 1) Summary
Necessary final integration pass that ties the phase together and directly targets workflow outcomes. Main risk is a large "workspace rewrite" blast radius combined with complex template application logic.

#### 2) Strengths
- Integrates all major components in one convergence wave.
- Template structures and filtering are explicit and practical.
- Auto-connect downstream creation supports fast user workflows.
- Aligns with phase goal of material-node and template-driven operation.

#### 3) Concerns
- [HIGH] Full `InnerWorkspace` rewrite is high regression risk for pan/zoom/select/run flows.
- [HIGH] Template apply may create invalid graphs (cycles, incompatible IO) without validation.
- [MEDIUM] No transaction/undo boundary for multi-step template application.
- [MEDIUM] Built-in template set may drift from node capability constraints over time.
- [LOW] Canvas theme token switch may produce contrast/accessibility regressions.

#### 4) Suggestions
- Do incremental integration behind feature flags instead of one-shot workspace replacement.
- Add graph validator during template apply (`NODE_IO`, cycle prevention, edge dedupe).
- Wrap template apply in atomic command with undo/rollback support.
- Add E2E golden flows for: create node, apply template, run skill, quota exceed path.
- Add accessibility/contrast checks after tokenized background rollout.

#### 5) Risk Assessment
**HIGH** — This is the convergence point with the largest regression surface; needs staged rollout and strong E2E coverage.

---

## Consensus Summary

> Single reviewer — consensus is based on cross-plan pattern analysis.

### Agreed Strengths
- Wave-based decomposition provides clear dependency ordering and incremental delivery
- Backward compatibility (LEGACY_TYPE_MAP, nodeTypes registry) is addressed throughout
- Correct placement of quota enforcement at SkillExecutor boundary
- Reusable abstractions (NodeShell, StatusIndicator, useNodeFocus, usePromptBuilder) reduce code duplication
- CSS custom property system provides single source of truth for theming

### Agreed Concerns
1. **Quota correctness** (Plans 02, 05) — fail-open behavior, race conditions on counter updates, and Celery retry idempotency create financial and requirement-compliance risk (HIGH)
2. **Integration blast radius** (Plan 07) — full InnerWorkspace rewrite in Wave 4 is the largest regression surface (HIGH)
3. **Authorization gaps** (Plans 02, 06) — quota admin and asset CRUD endpoints lack explicit project/team membership checks (HIGH)
4. **Legacy/material compatibility** (Plans 01, 04) — mixed nodeTypes registry and connection rules need thorough testing against existing saved canvases (MEDIUM)
5. **Template graph validation** (Plan 07) — template application could create cycles or incompatible connections without NODE_IO validation (HIGH)

### Divergent Views
_Single reviewer — no divergent views to compare._

### Top Recommendations
1. **Change quota to fail-closed** with atomic counter increments and execution ID deduplication
2. **Add feature flags** for incremental canvas migration instead of one-shot workspace replacement
3. **Add project membership authz** to all asset and quota admin endpoints
4. **Add graph validation** during template application (cycle detection, IO compatibility)
5. **Define shared execution-status enum** between backend and frontend for consistency
