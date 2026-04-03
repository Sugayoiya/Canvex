# Phase 14: ArtifactStore + ToolInterceptor - Research

**Researched:** 2026-04-04
**Domain:** Session-scoped artifact persistence, LangChain tool interception, Celery async task offloading
**Confidence:** HIGH

## Summary

Phase 14 introduces three tightly coupled subsystems: (1) an `agent_artifacts` PostgreSQL table for session-scoped artifact persistence, (2) a ToolInterceptor wrapper layer that auto-injects upstream dependencies and auto-persists results around every LangChain `@tool` call, and (3) Celery task offloading for long-running AI tools (`generate_image`, `generate_video`). The design is heavily informed by FireRed-OpenStoryline's `ToolInterceptor` + `ArtifactStore` + `NodeManager` architecture, adapted from MCP interceptors to LangChain StructuredTool wrappers.

The existing codebase provides strong foundations: `TOOL_METADATA` dict with `skill_kind` / `require_prior_kind` per tool (Phase 13), `ToolContext` contextvars for session identity propagation, Celery infrastructure with pre-configured queues (`ai_generation`, `media_processing`), and `SkillExecutionLog` for task observability. The primary engineering challenge is designing the StructuredTool wrapper that intercepts before/after hooks without depending on LangChain internal APIs, and correctly bridging the async `@tool` → sync Celery task → async provider call execution model.

**Primary recommendation:** Implement a `wrap_tool_with_interceptor()` function that wraps each LangChain StructuredTool's `_arun` method, using `TOOL_METADATA` to drive injection/persistence logic. Apply wrappers in `get_all_tools()` before passing tools to `create_agent()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 新建 `agent_artifacts` 表，UUID 主键 + 追加模式——每次工具执行生成新行，查询时通过 session_id + skill_kind 取最新一条（类似 OpenStoryline 模式）
- **D-02:** 存储格式采用摘要+引用分离——`summary` (TEXT, ≤500 chars) 存 LLM 可见的精简版，`payload` (JSONB) 存完整结构化数据。注入下游时传 payload，返回 LLM 时传 summary
- **D-03:** 生命周期永久保留，与 AgentSession 同生命周期
- **D-04:** 双关联模式——`session_id` FK 指向 `agent_sessions`，可选 `execution_log_id` FK 指向 `skill_execution_logs`（Celery 执行的任务可关联执行日志）
- **D-05:** 仅会话内作用域，不支持跨会话引用（每次会话独立）
- **D-06:** 同一 session + skill_kind 多次执行全部保留（追加写入），查询时取最新一条，旧记录当历史
- **D-07:** 采用 StructuredTool 包装层——每个 @tool 用 wrapper 函数包裹，wrapper 内部执行 before/after 钩子。不依赖 LangChain 内部 API，控制最精确
- **D-08:** LLM 看到的返回值格式为 摘要 + artifact_id——LLM 看到简短摘要文本和引用 ID。不需要 read_artifact 工具
- **D-09:** 缺失依赖处理采用递归补跑——当工具的 require_prior_kind 依赖在 ArtifactStore 中不存在时，自动执行缺失的前置技能，递归深度最多 3 层，超过报错
- **D-10:** 全部 17 个 @tool 统一包装——无产物的工具 after-hook 跳过存储即可，保持一致性
- **D-11:** 不需要并发控制——LangChain Agent 单线程顺序执行工具，跨会话天然按 session_id 隔离
- **D-12:** 递归补跑失败时的处理由 Agent 决定（推荐：中断调用链，返回错误信息告诉 LLM 前置步骤失败）
- **D-13:** 新建专用 @task（不复用旧 SkillRegistry 的 run_skill_task）——旧 handler 已全部废弃，新 task 直接调用 ImageGenerationService / VideoService
- **D-14:** 所有调用外部 AI API 的工具走 Celery（当前为 generate_image + generate_video，架构支持扩展——通过 SkillDescriptor.execution_mode / celery_queue 标记）
- **D-15:** 轮询策略为工具内轮询——@tool 内部 apply_async() 后循环 AsyncResult.get(timeout=5)，对 LLM 完全透明（同步调用体验）。指数退避轮询（1s, 2s, 4s, 8s...）
- **D-16:** 结果存储采用双层路径——Redis result backend 用于 Celery 内部结果传递（@tool 取回），ToolInterceptor after-hook 再存入 ArtifactStore（PostgreSQL 持久化）
- **D-17:** 重试配置 max_retries=2 + 指数退避（30s → 60s），第 3 次失败则报错
- **D-18:** 超时可配置——读 SkillDescriptor.timeout（Phase 13 已标注），运行时按 provider/model 可覆盖。后备值：图片 120s，视频 300s
- **D-19:** 确认策略 acks_late=True——任务完成后才确认，worker 崩溃任务自动重新派发
- **D-20:** 并发控制按 provider 配置——通过 Celery rate_limit 或 per-queue worker 配置控制，具体值从 DB 可配置
- **D-21:** 任务执行复用 SkillExecutionLog 记录——新 Celery task 也写入现有日志表，保持监控一致性
- **D-22:** 队列策略按任务类型分（ai_generation / media_processing），Phase 14 做可配置 rate_limit + 基础队列状态查询 API
- **D-23:** PIPE-01（参数对齐）由 ToolInterceptor 自然解决——按 skill_kind 注入完整 artifact payload，工具自己取需要的字段
- **D-24:** PIPE-02（Celery 异步轮询）与 D-15 统一——@tool 内 apply_async + poll，对 Agent 透明
- **D-25:** PIPE-03（ArtifactStore 集成）——Pipeline 每步结果存 ArtifactStore，下一步通过 require_prior_kind 自动获取
- **D-26:** PIPE-04（SSE 步骤进度）——增强现有 on_tool_start / on_tool_end SSE 事件显示，不新建自定义事件类型
- **D-27:** PIPE-05（长任务 Celery）——新建专用 @task + 多队列 + 可配置 rate_limit
- **D-28:** 最小改动——SSE 格式不变，前端仅调整工具返回值显示（从完整 JSON 变为摘要文本）
- **D-29:** Phase 14 做结构化日志——Interceptor 每次 before/after 记录 structured log
- **D-30:** Phase 16 做 Admin 可视化——Artifact 统计在 Admin Skill 管理页面展示

### Claude's Discretion
- System Prompt 调整方式（建议明确告知 LLM 数据传递已自动化）
- 迁移策略实现细节（建议渐进式，无 artifact 时 fallback 到旧行为）
- ToolInterceptor wrapper 的具体代码组织（独立模块 vs 嵌入 tools/__init__.py）
- ArtifactStore 的 summary 生成策略（截断 vs LLM 摘要 vs 模板拼接）
- 递归补跑失败时的具体错误消息格式

### Deferred Ideas (OUT OF SCOPE)
- 多租户 per-team per-provider 实时 QPS 限速（Redis Token Bucket + 配额分配）— 后续里程碑
- 动态 rate_limit Admin 面板（Admin 界面实时显示和调整 rate_limit）— Phase 15/16
- 跨会话 Artifact 引用（新会话复用上一次会话的产物）— 后续评估
- SSE pipeline_progress 自定义进度事件（带步骤序号/总数/名称）— Phase 15
- Admin Artifact 统计可视化 — Phase 16
- SkillRegistry 与 SkillLoader 合并为单一注册表 — Phase 14+ 评估
- Canvas 节点执行走 Agent Skill 路径（AGENT_CHAT_FOR_CANVAS flag）— v3.1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARTS-01 | Session-scoped artifact store persists skill execution results (keyed by session_id + skill_name) | `agent_artifacts` table model with UUID PK, session_id FK, skill_kind column; append-only write pattern; query by session_id + skill_kind ORDER BY created_at DESC LIMIT 1 |
| ARTS-02 | Artifacts stored as structured data with metadata (artifact_id, skill_kind, summary, timestamp) | D-02 summary+payload split; JSONB payload column; TEXT summary ≤500 chars; created_at timestamp |
| ARTS-03 | ToolInterceptor before-hook auto-injects upstream dependency artifacts into skill parameters | `wrap_tool_with_interceptor()` reads `TOOL_METADATA[tool.name]["require_prior_kind"]`, queries ArtifactStore for latest payload per kind, injects into tool kwargs; recursive backfill on miss (max depth 3) |
| ARTS-04 | ToolInterceptor after-hook auto-persists skill results to ArtifactStore | after-hook captures tool return value, generates summary, writes to `agent_artifacts` with session_id from ToolContext; skip for read-only/meta tools with no meaningful payload |
| ARTS-05 | Agent no longer needs to pass large JSON blobs between tool calls (interceptor handles data flow) | LLM sees summary + artifact_id instead of full JSON; before-hook transparently injects full payload from ArtifactStore into downstream tool kwargs |
| ARTS-06 | ArtifactStore uses PostgreSQL/SQLAlchemy (agent_artifacts table), not file system | SQLAlchemy model with JSONB payload column; FK to agent_sessions; optional FK to skill_execution_logs; AsyncSessionLocal for DB access |
| PIPE-03 | Pipeline chain passes results through ArtifactStore instead of _chain_params hard-coding | episode-pipeline skill's step outputs are auto-persisted by after-hook; next step's before-hook auto-loads via require_prior_kind chain (split_clips → convert_screenplay → create_storyboard) |
| PIPE-05 | Long-running AI @tools offloaded to Celery async queue with retry, persistence, concurrency | New `generate_image_task` / `generate_video_task` Celery tasks; @tool calls `apply_async()` + polls `AsyncResult`; max_retries=2, acks_late=True, exponential backoff |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.0.48 | ORM for agent_artifacts table | Already the project's ORM; JSONB support via `sqlalchemy.dialects.postgresql.JSONB` |
| Celery | 5.6.3 | Async task queue for long-running AI tasks | Already configured with Redis broker, 4 queues, acks_late, result backend |
| LangChain Core | 1.2.24 | StructuredTool wrapper target, `@tool` decorator | Already used for all 17 tools |
| Redis | (server) | Celery broker + result backend | Already running, used for key health + credential cache |
| PostgreSQL | 15+ | JSONB storage for artifact payloads | Project DB; JSONB enables structured queries on payload |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| structlog | 24.4.0+ | Structured logging for interceptor events | Already used in skill_task.py for contextvars binding |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONB payload | TEXT + json.dumps | Loses PostgreSQL JSON query operators; JSONB is correct for structured data |
| StructuredTool wrapper | LangChain CallbackHandler | Callbacks are passive observers, not interceptors — cannot modify input/output |
| Celery in-tool polling | Celery webhook/callback | Webhook adds complexity; polling is simpler and keeps LLM experience synchronous |
| Single wrapper function | Class-based interceptor | Function is simpler, matches existing codebase patterns; class would add unnecessary abstraction |

## Architecture Patterns

### Recommended Module Structure
```
api/app/agent/
├── artifact_store.py          # ArtifactStore service (CRUD on agent_artifacts)
├── tool_interceptor.py        # wrap_tool_with_interceptor() + before/after hooks
├── tool_context.py            # Extended with session_id field
├── tools/
│   ├── __init__.py            # get_all_tools() applies interceptor wrappers
│   └── ai_tools.py            # generate_image/video refactored for Celery
api/app/models/
├── agent_artifact.py          # AgentArtifact SQLAlchemy model
api/app/tasks/
├── ai_generation_task.py      # New Celery tasks for image/video generation
```

### Pattern 1: StructuredTool Wrapper (ToolInterceptor)

**What:** A function that wraps each LangChain `@tool`'s async callable, injecting before/after hooks that read/write from ArtifactStore based on `TOOL_METADATA` declarations.

**When to use:** Applied to every tool before passing to `create_agent()`.

**Implementation approach:**

```python
from langchain_core.tools import StructuredTool
from app.agent.tool_context import get_tool_context

def wrap_tool_with_interceptor(tool: StructuredTool) -> StructuredTool:
    """Wrap a LangChain tool with before/after artifact hooks."""
    meta = TOOL_METADATA.get(tool.name, {})
    skill_kind = meta.get("skill_kind", "")
    require_prior = meta.get("require_prior_kind", [])
    original_fn = tool.coroutine  # the async callable

    async def intercepted_fn(**kwargs):
        ctx = get_tool_context()
        session_id = ctx.session_id

        # BEFORE: inject upstream artifacts
        if require_prior and session_id:
            injected = await _inject_dependencies(
                session_id, require_prior, depth=0
            )
            kwargs.update(injected)

        # EXECUTE original tool
        result = await original_fn(**kwargs)

        # AFTER: persist result as artifact
        if skill_kind and session_id:
            await _persist_artifact(session_id, skill_kind, result)

        return result

    # Create new StructuredTool with same schema but intercepted function
    return StructuredTool(
        name=tool.name,
        description=tool.description,
        args_schema=tool.args_schema,
        coroutine=intercepted_fn,
        metadata=tool.metadata,
    )
```

**Key design insight:** LangChain `StructuredTool` accepts a `coroutine` parameter for the async callable. By creating a new StructuredTool with the same `args_schema` and `description` but a wrapped `coroutine`, we intercept execution without touching LangChain internals.

**Confidence:** HIGH — verified from LangChain Core 1.2.x source: `StructuredTool.__init__` accepts `coroutine`, `name`, `description`, `args_schema`, and `metadata` keyword arguments.

### Pattern 2: ArtifactStore Service (Append-Only CRUD)

**What:** A thin service layer over `agent_artifacts` providing `save()`, `get_latest()`, and `get_latest_payload()` methods.

**When to use:** Called by ToolInterceptor before/after hooks and by any code needing artifact access.

```python
class ArtifactStoreService:
    @staticmethod
    async def save(
        session_id: str,
        skill_kind: str,
        summary: str,
        payload: dict,
        execution_log_id: str | None = None,
    ) -> AgentArtifact:
        async with AsyncSessionLocal() as db:
            artifact = AgentArtifact(
                session_id=session_id,
                skill_kind=skill_kind,
                summary=summary[:500],
                payload=payload,
                execution_log_id=execution_log_id,
            )
            db.add(artifact)
            await db.commit()
            await db.refresh(artifact)
            return artifact

    @staticmethod
    async def get_latest(session_id: str, skill_kind: str) -> AgentArtifact | None:
        async with AsyncSessionLocal() as db:
            stmt = (
                select(AgentArtifact)
                .where(
                    AgentArtifact.session_id == session_id,
                    AgentArtifact.skill_kind == skill_kind,
                )
                .order_by(AgentArtifact.created_at.desc())
                .limit(1)
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
```

### Pattern 3: Celery Async Offload with In-Tool Polling

**What:** AI tools submit work to Celery via `apply_async()`, then poll `AsyncResult` with exponential backoff inside the `@tool` function body.

```python
@tool(args_schema=GenerateImageInput)
async def generate_image(prompt: str, aspect_ratio: str = "16:9", model: str = "...") -> str:
    from app.tasks.ai_generation_task import generate_image_task

    ctx = get_tool_context()
    task_result = generate_image_task.apply_async(
        kwargs={
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "model": model,
            "team_id": ctx.team_id,
            "user_id": ctx.user_id,
        },
        queue="ai_generation",
    )

    # Poll with exponential backoff (async-safe via run_in_executor)
    import asyncio
    delay = 1.0
    timeout = 120  # from TOOL_METADATA
    elapsed = 0.0
    while elapsed < timeout:
        await asyncio.sleep(delay)
        elapsed += delay
        if task_result.ready():
            break
        delay = min(delay * 2, 8.0)

    if not task_result.ready():
        return json.dumps({"error": "图片生成超时"}, ensure_ascii=False)
    if task_result.failed():
        return json.dumps({"error": f"图片生成失败: {task_result.result}"}, ensure_ascii=False)

    return json.dumps(task_result.result, ensure_ascii=False)
```

### Pattern 4: Recursive Dependency Backfill

**What:** When before-hook finds a `require_prior_kind` dependency missing from ArtifactStore, it recursively executes the missing tool in default mode. Maximum depth: 3.

```python
MAX_BACKFILL_DEPTH = 3

async def _inject_dependencies(
    session_id: str,
    require_prior_kinds: list[str],
    depth: int = 0,
) -> dict:
    if depth > MAX_BACKFILL_DEPTH:
        raise RuntimeError(f"Dependency backfill exceeded max depth ({MAX_BACKFILL_DEPTH})")

    injected = {}
    for kind in require_prior_kinds:
        artifact = await ArtifactStoreService.get_latest(session_id, kind)
        if artifact is None:
            # Find and execute the tool that produces this kind
            tool = _find_tool_by_kind(kind)
            if tool is None:
                raise RuntimeError(f"No tool produces artifact kind '{kind}'")
            # Recursively resolve that tool's own dependencies first
            tool_meta = TOOL_METADATA.get(tool.name, {})
            tool_deps = tool_meta.get("require_prior_kind", [])
            if tool_deps:
                sub_injected = await _inject_dependencies(session_id, tool_deps, depth + 1)
                # Execute missing tool with injected deps
                await tool.ainvoke(sub_injected)
            else:
                await tool.ainvoke({})
            artifact = await ArtifactStoreService.get_latest(session_id, kind)
            if artifact is None:
                raise RuntimeError(f"Backfill for '{kind}' succeeded but artifact not found")
        injected[kind] = artifact.payload
    return injected
```

### Pattern 5: Summary Generation Strategy

**What:** Generate the ≤500 char summary that LLM sees instead of full payload.

**Recommendation:** Template-based per skill_kind, with truncation fallback.

```python
SUMMARY_TEMPLATES = {
    "save_characters": lambda p: f"已保存 {p.get('saved', 0)} 个角色，更新 {p.get('updated', 0)} 个",
    "save_screenplay": lambda p: f"剧本已保存，共 {p.get('length', 0)} 字",
    "generate_image": lambda p: f"图片已生成: {p.get('url', '')[:100]}",
    "generate_video": lambda p: f"视频已生成: {p.get('url', '')[:100]}",
}

def generate_summary(skill_kind: str, payload: dict) -> str:
    template = SUMMARY_TEMPLATES.get(skill_kind)
    if template:
        try:
            return template(payload)[:500]
        except Exception:
            pass
    # Fallback: truncated JSON
    return json.dumps(payload, ensure_ascii=False)[:500]
```

### Anti-Patterns to Avoid
- **Modifying LangChain internal `_arun`:** Subclassing or monkey-patching StructuredTool internals is fragile. Use the constructor-based wrapper approach instead.
- **Sharing DB sessions across tool calls:** Each tool opens its own `AsyncSessionLocal()` — the interceptor must follow the same pattern. Never pass `db` between tools.
- **Blocking the event loop in Celery polling:** Use `asyncio.sleep()`, not `time.sleep()`, since tools run in async context.
- **Storing full tool return string in payload:** Parse the JSON string returned by tools before storing in JSONB; don't store the stringified version.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON-to-JSONB storage | Custom serialization | SQLAlchemy `JSONB` column type | Handles serialization, enables PostgreSQL JSON operators |
| Task state machine | Custom task status tracking | Celery `AsyncResult.state` + `SkillExecutionLog` | Celery already tracks PENDING/STARTED/SUCCESS/FAILURE |
| Exponential backoff | Manual delay calculation | Pattern: `delay = min(delay * 2, max_delay)` | Simple enough to inline, no library needed |
| DB session management | Manual session lifecycle | `AsyncSessionLocal()` context manager | Established project pattern, handles commit/rollback |
| Tool wrapping | Custom metaclass/decorator chain | `StructuredTool(coroutine=..., args_schema=...)` constructor | LangChain's native API for creating tool instances |

## Common Pitfalls

### Pitfall 1: Celery Task Cannot Use async/await
**What goes wrong:** Celery workers run in synchronous threads. The new generation tasks need to call async ProviderManager/ImageGenerationService.
**Why it happens:** Celery's default worker pool is prefork (processes), which doesn't support asyncio natively.
**How to avoid:** Use the same pattern as existing `run_skill_task`: create or get an event loop with `_get_or_create_event_loop()`, then `loop.run_until_complete(async_fn())`. This pattern is already proven in `api/app/tasks/skill_task.py`.
**Warning signs:** `RuntimeError: no running event loop` in Celery worker logs.

### Pitfall 2: ToolContext Not Available During Recursive Backfill
**What goes wrong:** Recursive backfill calls `tool.ainvoke()` which internally calls `get_tool_context()`. If ToolContext doesn't include `session_id`, backfill can't persist artifacts.
**Why it happens:** Current `ToolContext` dataclass doesn't have `session_id` field. Need to extend it.
**How to avoid:** Add `session_id: str | None = None` to `ToolContext` dataclass. Set it in `set_tool_context()` call in `api/v1/agent.py` chat endpoint. The `session_id` is already available there as `session.id`.
**Warning signs:** `RuntimeError: Tool context not set` during backfill execution.

### Pitfall 3: Double Wrapping on Hot Reload
**What goes wrong:** If `get_all_tools()` is called multiple times (e.g., per-request agent creation), tools get wrapped multiple times, causing duplicate before/after hooks.
**Why it happens:** `get_all_tools()` constructs fresh tool lists each call but interceptor wrapping is applied inline.
**How to avoid:** Either (a) mark wrapped tools with a sentinel attribute (`tool._interceptor_wrapped = True`) and skip already-wrapped tools, or (b) apply wrapping once at module level / in `get_all_tools()` with a check. Option (a) is simpler and more robust.
**Warning signs:** Artifacts being saved multiple times per tool call; duplicate structured log entries.

### Pitfall 4: Parsing Tool Return Values for Payload Storage
**What goes wrong:** LangChain `@tool` functions return `str`. The after-hook needs to parse this string back to dict for JSONB storage.
**Why it happens:** All existing tools return `json.dumps(result)` — a string, not a dict.
**How to avoid:** In the after-hook, `json.loads(result)` the tool's return value. Handle parse failures gracefully (store as `{"raw": result_string}`).
**Warning signs:** Payload column contains escaped JSON strings instead of structured data.

### Pitfall 5: `asyncio.sleep()` Inside LangChain Tool Execution
**What goes wrong:** LangChain `astream_events` uses the same event loop as the tool. Long `asyncio.sleep()` polling blocks event streaming.
**Why it happens:** Tools execute inline within the agent's event loop. Sleep doesn't block other tasks on the same loop, but the agent won't stream intermediate events until the tool returns.
**How to avoid:** This is actually acceptable behavior per D-15 (tool-internal polling, transparent to LLM). The SSE `on_tool_start` event fires before the tool begins, giving frontend feedback. The `on_tool_end` fires when the tool returns. Consider emitting periodic SSE heartbeats (already configured with `ping=15` in EventSourceResponse).
**Warning signs:** Frontend showing "tool running" for 60-120s with no updates — this is expected behavior per D-28.

### Pitfall 6: Celery Result Serialization Limits
**What goes wrong:** Celery's default JSON serializer can't handle certain Python types (datetime, bytes, Decimal).
**Why it happens:** The `celery_app.conf` specifies `result_serializer="json"`. If the AI provider returns non-JSON-safe types, the result can't be serialized.
**How to avoid:** Ensure generation tasks return only JSON-safe types (str, int, float, bool, None, list, dict). Convert file paths to strings, datetimes to ISO strings.
**Warning signs:** `kombu.exceptions.EncodeError` in worker logs.

### Pitfall 7: SkillExecutionLog Creation Timing
**What goes wrong:** If the SkillExecutionLog row is created before `apply_async()` but the Celery task ID isn't known yet, the log can't be linked.
**Why it happens:** Celery assigns task ID on `apply_async()`, but the log might need to be created before for pre-execution tracking.
**How to avoid:** Use Celery's `task_id` parameter to pre-assign a UUID: `task_id = str(uuid.uuid4()); task.apply_async(task_id=task_id, ...)`. Create the log row with this ID before submitting.
**Warning signs:** SkillExecutionLog rows with `celery_task_id=NULL` for Celery-executed tasks.

## Code Examples

### AgentArtifact Model

```python
# api/app/models/agent_artifact.py
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TZDateTime, _utcnow


class AgentArtifact(Base):
    __tablename__ = "agent_artifacts"
    __table_args__ = (
        Index("ix_agent_artifacts_session_kind", "session_id", "skill_kind"),
        Index("ix_agent_artifacts_session_created", "session_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("agent_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    skill_kind: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    execution_log_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("skill_execution_logs.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(TZDateTime, default=_utcnow)
```

### Extended ToolContext

```python
# Changes to api/app/agent/tool_context.py
@dataclass(frozen=True)
class ToolContext:
    project_id: str
    user_id: str
    team_id: str | None = None
    canvas_id: str | None = None
    episode_id: str | None = None
    session_id: str | None = None  # NEW: for ArtifactStore scoping
```

### Celery Generation Task

```python
# api/app/tasks/ai_generation_task.py
import logging
import time
import asyncio

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


def _get_or_create_event_loop():
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError
        return loop
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop


@celery_app.task(
    bind=True,
    acks_late=True,
    max_retries=2,
    name="app.tasks.ai_generation_task.generate_image_task",
)
def generate_image_task(self, prompt: str, aspect_ratio: str, model: str,
                        team_id: str | None, user_id: str):
    loop = _get_or_create_event_loop()
    try:
        result = loop.run_until_complete(
            _async_generate_image(prompt, aspect_ratio, model, team_id, user_id)
        )
        return result
    except Exception as exc:
        logger.exception("generate_image_task failed")
        raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))


async def _async_generate_image(prompt, aspect_ratio, model, team_id, user_id):
    from app.services.ai.provider_manager import get_provider_manager
    from app.services.ai.key_health import get_key_health_manager

    pm = get_provider_manager()
    provider, _owner, key_id = await pm.get_provider(
        "gemini", team_id=team_id, user_id=user_id,
    )
    try:
        result = await provider.generate_image(
            prompt, aspect_ratio=aspect_ratio, model=model
        )
        await get_key_health_manager().report_success(key_id)
        return result
    except Exception as e:
        await get_key_health_manager().report_error(
            key_id, type(e).__name__, str(e)[:200]
        )
        raise
```

### ToolInterceptor Integration in get_all_tools()

```python
# In api/app/agent/tools/__init__.py
def get_all_tools() -> list:
    from app.agent.tools.context_tools import CONTEXT_TOOLS
    from app.agent.tools.mutation_tools import MUTATION_TOOLS
    from app.agent.tools.ai_tools import AI_TOOLS
    from app.agent.tools.skill_tools import SKILL_TOOLS
    from app.agent.tool_interceptor import wrap_tool_with_interceptor

    tools = [*CONTEXT_TOOLS, *MUTATION_TOOLS, *AI_TOOLS, *SKILL_TOOLS]
    tools = _attach_tool_metadata(tools)
    tools = [wrap_tool_with_interceptor(t) for t in tools]
    return tools
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LLM manually passes full JSON between tools | ToolInterceptor auto-injects via ArtifactStore | Phase 14 | Removes 10KB+ JSON blobs from LLM context window |
| `asyncio.wait_for(provider.generate_image())` inline | Celery `apply_async()` + in-tool polling | Phase 14 | Enables retry, persistence, concurrency control |
| `_chain_params` hard-coded field mapping in pipeline | ArtifactStore + require_prior_kind auto-injection | Phase 14 | Pipeline data flow becomes declarative |
| Tools return full result JSON to LLM | Tools return summary + artifact_id | Phase 14 | Saves LLM token budget |

## Open Questions

1. **Summary generation for read-only context tools**
   - What we know: Context tools (get_characters, get_scenes, etc.) return full JSON that downstream tools might need.
   - What's unclear: Should context tool results also be stored as artifacts? They don't have `require_prior_kind` dependencies but mutation tools may need their data.
   - Recommendation: Store artifacts for all tools per D-10 (unified wrapping). Read-only tools produce artifacts that can be referenced by downstream tools via `require_prior_kind`. For tools that don't declare dependencies, the after-hook simply stores the result but no before-hook injection occurs.

2. **Backward compatibility during migration**
   - What we know: The agent currently works by LLM reading tool results and manually passing data between calls.
   - What's unclear: During the transition, some tools may not yet have artifacts from prior runs.
   - Recommendation: Graceful fallback — if `require_prior_kind` artifact is missing and recursive backfill fails (e.g., the prerequisite tool needs user input), return a clear error message to the LLM explaining what's needed. Don't silently fail.

3. **StructuredTool.coroutine vs StructuredTool.func for tool wrapping**
   - What we know: All 17 tools are defined as `async def` decorated with `@tool`. LangChain stores the async callable in `tool.coroutine`.
   - What's unclear: Whether creating a new `StructuredTool(coroutine=wrapped_fn)` preserves all metadata correctly.
   - Recommendation: Test with a single tool first. Verify that `tool.name`, `tool.description`, `tool.args_schema`, and `tool.metadata` are all preserved. The constructor approach is the cleanest.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | agent_artifacts table (JSONB) | ✓ | 15+ (via Docker) | — |
| Redis | Celery broker + result backend | ✓ | Running (PONG) | — |
| Celery | Async task offloading | ✓ | 5.6.3 (pip) | — |
| SQLAlchemy | ORM + JSONB support | ✓ | 2.0.48 | — |
| LangChain Core | StructuredTool wrapping | ✓ | 1.2.24 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

**Note:** Celery CLI (`celery` command) is not on PATH — it must be invoked via `uv run celery` from the api directory. Workers will need: `uv run celery -A app.celery_app worker --queues=ai_generation,media_processing -c 2 --loglevel=info`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.5 + pytest-asyncio 0.25.2 |
| Config file | `api/pyproject.toml` `[tool.pytest.ini_options]` asyncio_mode = "auto" |
| Quick run command | `cd api && uv run pytest tests/test_artifact_store.py -x` |
| Full suite command | `cd api && uv run pytest tests/ -x` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARTS-01 | Artifact persists with session_id + skill_kind | unit | `uv run pytest tests/test_artifact_store.py::test_save_and_retrieve -x` | ❌ Wave 0 |
| ARTS-02 | Artifact has structured metadata fields | unit | `uv run pytest tests/test_artifact_store.py::test_artifact_metadata -x` | ❌ Wave 0 |
| ARTS-03 | Before-hook injects dependencies | unit | `uv run pytest tests/test_tool_interceptor.py::test_before_hook_injects -x` | ❌ Wave 0 |
| ARTS-04 | After-hook persists results | unit | `uv run pytest tests/test_tool_interceptor.py::test_after_hook_persists -x` | ❌ Wave 0 |
| ARTS-05 | LLM sees summary not full JSON | unit | `uv run pytest tests/test_tool_interceptor.py::test_summary_return -x` | ❌ Wave 0 |
| ARTS-06 | JSONB storage in PostgreSQL | unit | `uv run pytest tests/test_artifact_store.py::test_jsonb_payload -x` | ❌ Wave 0 |
| PIPE-03 | Pipeline uses ArtifactStore references | integration | `uv run pytest tests/test_tool_interceptor.py::test_pipeline_chain -x` | ❌ Wave 0 |
| PIPE-05 | Celery offload with retry | unit | `uv run pytest tests/test_celery_generation.py::test_celery_offload -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd api && uv run pytest tests/test_artifact_store.py tests/test_tool_interceptor.py -x`
- **Per wave merge:** `cd api && uv run pytest tests/ -x`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `api/tests/test_artifact_store.py` — covers ARTS-01, ARTS-02, ARTS-06
- [ ] `api/tests/test_tool_interceptor.py` — covers ARTS-03, ARTS-04, ARTS-05, PIPE-03
- [ ] `api/tests/test_celery_generation.py` — covers PIPE-05
- [ ] Fixtures: `make_session` factory, `make_artifact` factory, Celery eager mode setup

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** — all 17 tool implementations, TOOL_METADATA dict, ToolContext, celery_app configuration, AgentSession model, SkillExecutionLog model, SSE protocol, agent API endpoint
- **OpenStoryline reference** — `node_interceptors.py` (ToolInterceptor inject_media_content_before + save_media_content_after), `agent_memory.py` (ArtifactStore save_result + get_latest_meta + load_result), `node_manager.py` (check_excutable + recursive dependency resolution)
- **LangChain Core 1.2.24** — `StructuredTool` constructor API (coroutine, name, description, args_schema, metadata parameters)
- **Celery 5.6.3** — `apply_async()`, `AsyncResult`, `max_retries`, `acks_late`, `countdown` retry semantics

### Secondary (MEDIUM confidence)
- **SQLAlchemy 2.0.48** — `JSONB` column type from `sqlalchemy.dialects.postgresql`; confirmed by project already using PostgreSQL-only

### Tertiary (LOW confidence)
- None — all findings verified against codebase or official library APIs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, versions verified
- Architecture: HIGH — ToolInterceptor pattern directly adapted from proven OpenStoryline reference implementation
- Pitfalls: HIGH — derived from codebase analysis of actual execution paths and known Celery/asyncio interaction patterns

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (30 days — stable architecture, no fast-moving dependencies)
