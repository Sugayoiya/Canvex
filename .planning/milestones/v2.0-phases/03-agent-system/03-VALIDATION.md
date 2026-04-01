---
phase: 03
slug: agent-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (backend) / vitest (frontend) |
| **Config file** | `api/pyproject.toml` / `web/vitest.config.ts` |
| **Quick run command** | `cd api && uv run pytest tests/ -x -q` |
| **Full suite command** | `cd api && uv run pytest tests/ -v && cd ../web && npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd api && uv run pytest tests/ -x -q`
- **After every plan wave:** Run `cd api && uv run pytest tests/ -v && cd ../web && npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-T1 | 03-01 | 1 | REQ-05, REQ-06 | import | `cd api && uv run python -c "import pydantic_ai; import sse_starlette" && cd ../web && node -e "require('@microsoft/fetch-event-source')"` | — | ⬜ pending |
| 01-T2 | 03-01 | 1 | REQ-05, REQ-06 | import | `cd api && uv run python -c "from app.models.agent_session import AgentSession, AgentMessage; print(AgentSession.__tablename__)"` | api/app/models/agent_session.py | ⬜ pending |
| 01-T3 | 03-01 | 1 | REQ-05, REQ-06 | import | `cd api && uv run python -c "from app.schemas.agent import ChatRequest; from app.agent.sse_protocol import SSEEventType, sse_token"` | api/app/schemas/agent.py, api/app/agent/sse_protocol.py | ⬜ pending |
| 02-T1 | 03-02 | 2 | REQ-05 | integration | `cd api && uv run python -c "from app.agent.skill_toolset import SkillToolset; from app.skills.registry import skill_registry; from app.skills.context import SkillContext; ts=SkillToolset(registry=skill_registry, context=SkillContext()); import asyncio; assert len(asyncio.run(ts.tool_defs()))>0"` | api/app/agent/skill_toolset.py | ⬜ pending |
| 02-T2 | 03-02 | 2 | REQ-05 | import | `cd api && uv run python -c "from app.agent import AgentService, AgentDeps, SkillToolset, SSEEventType; from app.agent.context_builder import build_system_prompt; assert '当前项目' in build_system_prompt(project_name='T')"` | api/app/agent/agent_service.py, api/app/agent/context_builder.py | ⬜ pending |
| 03-T1 | 03-03 | 3 | REQ-05, REQ-06 | import | `cd api && uv run python -c "from app.api.v1.agent import router; assert len(router.routes)>=6"` | api/app/api/v1/agent.py | ⬜ pending |
| 03-T2 | 03-03 | 3 | REQ-05, REQ-06 | pytest | `cd api && uv run pytest tests/test_agent_api.py -x -q` | api/tests/test_agent_api.py | ⬜ pending |
| 04-T1 | 03-04 | 2 | REQ-06 | typecheck | `cd web && npx tsc --noEmit --strict src/stores/chat-store.ts src/lib/api.ts 2>&1 \| head -20` | web/src/stores/chat-store.ts | ⬜ pending |
| 04-T2 | 03-04 | 2 | REQ-06 | typecheck | `cd web && npx tsc --noEmit --strict src/hooks/use-agent-chat.ts 2>&1 \| head -20` | web/src/hooks/use-agent-chat.ts | ⬜ pending |
| 05-T1 | 03-05 | 4 | REQ-06 | typecheck | `cd web && npx tsc --noEmit 2>&1 \| head -30` | web/src/components/chat/chat-sidebar.tsx, chat-messages.tsx, chat-input.tsx | ⬜ pending |
| 05-T2 | 03-05 | 4 | REQ-06 | typecheck | `cd web && npx tsc --noEmit 2>&1 \| head -30` | web/src/components/chat/tool-call-display.tsx, thinking-indicator.tsx, chat-session-list.tsx | ⬜ pending |
| 05-T3 | 03-05 | 4 | REQ-06 | typecheck | `cd web && npx tsc --noEmit 2>&1 \| head -30` | web/src/app/canvas/[id]/page.tsx | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api/tests/test_agent_session.py` — stubs for REQ-05, REQ-06
- [ ] `api/tests/conftest.py` — shared fixtures (extend existing)
- [ ] `pydantic-ai` — install via uv

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chat sidebar displays tool calls in real-time | REQ-06 | SSE streaming UI requires visual confirmation | Open chat sidebar, send message, verify thinking/tool_call/tool_result events render progressively |
| Pipeline orchestration completes multi-step chain | REQ-05 | End-to-end pipeline requires running LLM | Trigger pipeline tool, verify each step executes in sequence with progress updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
