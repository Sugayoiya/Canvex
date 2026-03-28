---
status: fixing
trigger: "Phase 03 (Agent System) has two critical bugs: Chat sidebar sends no requests (sessionId is null), Celery worker not consuming tasks from Redis"
created: 2026-03-29T00:00:00Z
updated: 2026-03-29T00:45:00Z
---

## Current Focus

hypothesis: CONFIRMED — Both root causes identified and fixes applied
test: Human verification needed
expecting: Bug 1 — sending a message auto-creates session and sends SSE request; Bug 2 — new Celery worker picks up freshly submitted tasks
next_action: Request human verification

## Symptoms

expected: |
  Bug 1 (Chat): User types a message, POST SSE to /api/v1/agent/chat/{sessionId}, agent responds with streaming tokens.
  Bug 2 (Celery): Skill with execution_mode="async_celery" triggers Celery worker to pick up and execute the task.
actual: |
  Bug 1 (Chat): No network request sent. Backend has zero log entries for /agent/chat/.
  Bug 2 (Celery): Backend logs submission and returns 200, but worker shows no activity.
errors: |
  Bug 1: sendMessage() silently returns because sessionId is null. open() does NOT create an agent session.
  Bug 2: Old worker (terminal 690116) shows "Received unregistered task of type 'app.tasks.skill_task.run_skill_task'" — tasks consumed and DISCARDED.
reproduction: |
  Bug 1: Open canvas page → open AI assistant sidebar → type message → click send → nothing happens
  Bug 2: Add "extract characters" node → trigger skill → backend logs submission → worker terminal has no new output
started: Since Phase 03 code was generated. Never successfully tested by a human.

## Eliminated

- hypothesis: Bug 2 — broker URL mismatch between backend and worker
  evidence: Both config.py defaults (redis://localhost:6379/1) and api/.env value match. Worker terminal confirms transport=redis://localhost:6379/1. Redis db 1 KEYS shows proper kombu bindings.
  timestamp: 2026-03-29T00:30:00Z

- hypothesis: Bug 2 — task_queues dict format not working
  evidence: Worker terminal 23280 shows all 4 queues correctly declared (ai_generation, media_processing, pipeline, quick) with exchange(direct) routing.
  timestamp: 2026-03-29T00:32:00Z

## Evidence

- timestamp: 2026-03-29T00:10:00Z
  checked: web/src/hooks/use-agent-chat.ts line 23
  found: sendMessage() has `if (!sessionId || !content.trim()) return;` — sessionId is always null because chat-sidebar.tsx open() only sets projectId/canvasId, never creates a session.
  implication: Chat feature is completely non-functional. Root cause is clear.

- timestamp: 2026-03-29T00:12:00Z
  checked: web/src/stores/chat-store.ts
  found: `open()` action only sets `{ isOpen: true, projectId, canvasId }`. sessionId remains null.
  implication: Confirms Bug 1 — no auto-session-creation path exists.

- timestamp: 2026-03-29T00:15:00Z
  checked: web/src/components/chat/chat-session-list.tsx
  found: handleNewSession() calls agentApi.createSession() and setSession(). But this requires user to manually open session list panel and click "新对话".
  implication: Session creation exists but is hidden behind 2 extra clicks in a non-obvious UI flow.

- timestamp: 2026-03-29T00:20:00Z
  checked: Terminal 690116 (old Celery worker)
  found: `[tasks]` section is EMPTY. Worker received tasks from Redis but errored with "Received unregistered task of type 'app.tasks.skill_task.run_skill_task'" (KeyError). All 7+ pending messages were consumed and DISCARDED.
  implication: Old celery_app.py with autodiscover_tasks didn't register the task. Messages are permanently lost.

- timestamp: 2026-03-29T00:22:00Z
  checked: Terminal 23280 (new Celery worker)
  found: `[tasks] . app.tasks.skill_task.run_skill_task` — task IS registered. Worker connected to redis://localhost:6379/1, listening on ai_generation/media_processing/pipeline/quick queues. Status: "ready", no subsequent activity.
  implication: New worker with conf.include fix is correctly configured. No new tasks have been submitted since it started.

- timestamp: 2026-03-29T00:25:00Z
  checked: Redis db 1 via redis-cli
  found: LLEN ai_generation = 0. Only kombu binding keys exist. No pending messages in any queue.
  implication: Confirms old worker consumed all messages. Queues are clean for fresh operation.

- timestamp: 2026-03-29T00:27:00Z
  checked: Project root .env (Canvex/.env) vs api/.env
  found: Root .env uses `redis://redis:6379/1` (Docker hostname). api/.env uses `redis://localhost:6379/1`. If backend started from project root, it would use Docker hostname which is unreachable in local dev.
  implication: Potential future issue if CWD is wrong, but not current root cause since defaults match api/.env values.

## Resolution

root_cause: |
  Bug 1: use-agent-chat.ts sendMessage() requires sessionId to be non-null, but chat-sidebar.tsx open() only sets projectId/canvasId — it never creates a backend session. Session creation was only available through a hidden "新对话" button in the session list panel.
  Bug 2: Original celery_app.py used autodiscover_tasks() which failed to discover app/tasks/skill_task.py → worker had zero registered tasks → all messages received were discarded as "unregistered". This was already fixed by changing to conf.include=["app.tasks.skill_task"]. The new worker (terminal 23280) is correctly configured. "No activity" was because old worker consumed and discarded all pending messages.

fix: |
  Bug 1: Modified use-agent-chat.ts sendMessage() to auto-create a session via agentApi.createSession() when sessionId is null. On first message, the session is created transparently, stored in chat-store, and the SSE request proceeds immediately.
  Bug 2: Already fixed (conf.include). No additional code change needed. Redis queues are clean. New worker is healthy and waiting for tasks.

verification: Awaiting human verification
files_changed:
  - web/src/hooks/use-agent-chat.ts
