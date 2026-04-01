# Phase 03: Agent System + Tool Calling + Pipeline Orchestration — Research

**Researched:** 2026-03-28
**Domain:** AI Agent framework (PydanticAI) + SSE streaming + Chat UI
**Confidence:** HIGH

## Summary

Phase 03 introduces a PydanticAI-based agent layer that bridges the existing SkillRegistry with LLM tool-calling, adds persistent agent sessions with SSE streaming, and provides a chat sidebar UI. The core technical challenge is creating a `SkillToolset` adapter (PydanticAI `AbstractToolset`) that dynamically exposes registered Skills as PydanticAI tools, then streaming the agent execution loop (`agent.iter()`) as typed SSE events to the frontend.

PydanticAI v1.73.0 provides all required primitives: `Agent` with `deps_type` for DI, `FunctionToolset` / `AbstractToolset` for dynamic tool registration, `agent.iter()` for node-level execution streaming, and native providers for OpenAI, Gemini, and DeepSeek (via OpenAI-compat). The existing `SkillRegistry.invoke()` → `SkillResult` pipeline needs a thin async wrapper to become PydanticAI-compatible tool functions.

**Primary recommendation:** Build a `SkillToolset(AbstractToolset)` adapter that reads `SkillDescriptor` metadata from `skill_registry.discover()` at construction time and delegates execution to `skill_registry.invoke()`. Use `agent.iter()` + FastAPI `StreamingResponse` for SSE, persisting `all_messages_json()` to an `AgentMessage` table after each run.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D1**: 使用 PydanticAI 作为 Agent 层基座（不自研 tool calling 适配器）
- **D2**: 各 Provider 使用其原生 SDK：OpenAI → `OpenAIModel`, DeepSeek → `OpenAIModel` + custom base_url, Gemini → `GoogleModel`, Grok/xAI → `XaiModel`
- **D3**: ReAct 为主 + Programmatic Hand-off 为辅（Graph-Based 延后到 Phase 05）
- **D4**: 持久化 Agent 会话，两级作用域（Project 级 + Canvas 级），简单截断上下文管理
- **D5**: SSE 实时进度推送，使用 `agent.iter()` + FastAPI `StreamingResponse`
- **D6**: 混合模式 — Pipeline Tool（确定性链式流程）+ 单步 Skill Tool
- **D7**: Chat Sidebar 点击呼出，Cursor 风格进度展示（thinking/tool_call/tool_result/token/done）
- **D8**: Agent Skills 开放标准（SKILL.md）+ 渐进加载 + 多协议输出

### Claude's Discretion

- PydanticAI 版本选择：使用最新稳定版（当前 v1.73.0）
- 声明式 Skill 的存储位置：Phase 03 先用文件系统
- Provider 回退策略：team-scoped → global → env 的 3 层回退与 PydanticAI provider 对接方式
- prompt_seeds 迁移粒度：可按使用频率分批

### Deferred Ideas (OUT OF SCOPE)

- Graph-Based 编排（pydantic-graph）→ Phase 05
- Agent Delegation 模式（导演 Agent 统筹多专业 Agent）→ 后续迭代
- Agent 自主多步规划（Planning Agent）→ 后续迭代
- Skill 开放平台（MCP Server + OpenAPI）→ 后续里程碑
- 用户自定义 Skill（前端 UI 创建/编辑）→ 后续里程碑
- Skill 市场 → 远期规划

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-05 | Agent tool-calling loop can discover and invoke skills from registry tool definitions | PydanticAI `FunctionToolset`/`AbstractToolset` + `agent.iter()` loop; SkillToolset adapter pattern documented in Architecture Patterns |
| REQ-06 | Chat sidebar can display tool calls and async progress | SSE event protocol (thinking/tool_call/tool_result/token/done) + `@microsoft/fetch-event-source` on frontend; UI component structure documented in Code Examples |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pydantic-ai` | 1.73.0 | Agent framework — tool calling, streaming, multi-provider | Same team as FastAPI/Pydantic; native `agent.iter()` for node-level streaming; built-in OpenAI/Gemini/xAI providers |
| `pydantic-ai-slim[openai,google,xai]` | 1.73.0 | Slim install with only needed provider SDKs | Avoids pulling unnecessary dependencies; project already has `openai` and `google-genai` |
| `sse-starlette` | 3.3.3 | FastAPI SSE helper (`EventSourceResponse`) | Production-proven, handles keep-alive/ping, works with Starlette middleware; cleaner than raw `StreamingResponse` |
| `@microsoft/fetch-event-source` | 2.0.1 | Frontend SSE client (POST + headers + reconnect) | Supports POST requests (native `EventSource` is GET-only), custom Authorization headers, AbortController cleanup |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zustand` | 5.0.12 (existing) | Chat sidebar state management | Agent session state, message list, streaming status |
| `@tanstack/react-query` | 5.95.2 (existing) | Session list fetching, non-streaming queries | Session CRUD, history loading |
| `lucide-react` | 1.7.0 (existing) | Chat UI icons | Message icons, tool status indicators |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pydantic-ai` | LangChain / LlamaIndex | PydanticAI is lighter, type-safe, native Pydantic — matches project stack perfectly |
| `sse-starlette` | FastAPI native `StreamingResponse` | `sse-starlette` adds keep-alive pings, automatic `text/event-stream` headers, better reconnection |
| `@microsoft/fetch-event-source` | Native `EventSource` | Native `EventSource` doesn't support POST/headers — agent chat requires POST with auth |
| Custom `AbstractToolset` | `FunctionToolset` with manual wrapping | `AbstractToolset` gives cleaner separation; `FunctionToolset` works for simpler cases but SkillRegistry bridge needs custom `call_tool()` logic |

**Installation:**

Backend:
```bash
cd api && uv add "pydantic-ai-slim[openai,google,xai]>=1.73.0" "sse-starlette>=3.3.0"
```

Frontend:
```bash
cd web && npm install @microsoft/fetch-event-source
```

## Architecture Patterns

### Recommended Project Structure (New Files)

```
api/app/
├── agent/                          # NEW: Agent system
│   ├── __init__.py
│   ├── agent_service.py            # Agent creation, provider resolution, session management
│   ├── skill_toolset.py            # AbstractToolset adapter: SkillRegistry → PydanticAI tools
│   ├── pipeline_tools.py           # Pipeline Tool definitions (deterministic chains)
│   ├── context_builder.py          # System prompt construction with project/canvas context
│   └── sse_protocol.py             # SSE event type definitions and serialization
├── api/v1/
│   └── agent.py                    # NEW: Agent chat endpoint (SSE streaming)
├── models/
│   ├── agent_session.py            # NEW: AgentSession + AgentMessage ORM models
│   └── ...existing...
├── schemas/
│   └── agent.py                    # NEW: Pydantic schemas for agent API
└── ...existing...

web/src/
├── components/
│   └── chat/                       # NEW: Chat sidebar
│       ├── chat-sidebar.tsx         # Main sidebar container
│       ├── chat-messages.tsx        # Message list with streaming support
│       ├── chat-input.tsx           # Message input
│       ├── chat-session-list.tsx    # Session history list
│       ├── tool-call-display.tsx    # Tool call progress display (Cursor-style)
│       └── thinking-indicator.tsx   # Agent thinking animation
├── hooks/
│   └── use-agent-chat.ts           # NEW: SSE streaming hook
├── stores/
│   └── chat-store.ts               # NEW: Chat sidebar Zustand state
└── ...existing...
```

### Pattern 1: SkillToolset Adapter (SkillRegistry → PydanticAI)

**What:** Custom `AbstractToolset` subclass that bridges the existing `SkillRegistry` to PydanticAI's tool system.
**When to use:** Every agent run — this is the core bridge layer.

```python
# Source: PydanticAI AbstractToolset docs + project SkillRegistry
from pydantic_ai.toolsets import AbstractToolset
from pydantic_ai.tools import ToolDefinition

class SkillToolset(AbstractToolset):
    """Adapts SkillRegistry descriptors into PydanticAI tools."""

    def __init__(self, registry: SkillRegistry, context: SkillContext, categories: list[str] | None = None):
        self._registry = registry
        self._context = context
        self._categories = categories
        self._tools: dict[str, SkillDescriptor] = {}
        self._build_tool_map()

    def _build_tool_map(self):
        descriptors = self._registry.discover(category=None)
        for desc in descriptors:
            if self._categories and desc.category.value not in self._categories:
                continue
            safe_name = desc.name.replace(".", "_")
            self._tools[safe_name] = desc

    async def tool_defs(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name=safe_name,
                description=desc.description,
                parameters_json_schema=desc.input_schema,
            )
            for safe_name, desc in self._tools.items()
        ]

    async def call_tool(self, tool_call_id: str, name: str, args: dict) -> str:
        desc = self._tools[name]
        result = await self._registry.invoke(desc.name, args, self._context)
        return json.dumps(result.to_dict(), ensure_ascii=False)
```

### Pattern 2: SSE Streaming with agent.iter()

**What:** FastAPI endpoint that runs `agent.iter()` and yields typed SSE events.
**When to use:** Agent chat endpoint (`POST /api/v1/agent/chat/{session_id}`).

```python
# Source: PydanticAI agent.iter() docs + sse-starlette
from sse_starlette.sse import EventSourceResponse
from pydantic_ai.agent import Agent
from pydantic_ai.messages import ModelRequest, ModelResponse, ToolCallPart, TextPart

async def stream_agent_response(agent, user_prompt, message_history, deps, toolsets):
    async def event_generator():
        async with agent.iter(
            user_prompt=user_prompt,
            message_history=message_history,
            deps=deps,
            toolsets=toolsets,
        ) as run:
            async for node in run:
                if Agent.is_model_request_node(node):
                    yield {"event": "thinking", "data": json.dumps({"status": "analyzing"})}
                    async with node.stream(run.ctx) as request_stream:
                        async for event in request_stream:
                            if isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                                yield {"event": "token", "data": json.dumps({"text": event.delta.content_delta})}
                elif Agent.is_call_tools_node(node):
                    for part in node.model_response.parts:
                        if isinstance(part, ToolCallPart):
                            yield {"event": "tool_call", "data": json.dumps({
                                "tool": part.tool_name,
                                "args": part.args,
                                "call_id": part.tool_call_id,
                            })}
                    # Tool execution happens automatically, results come in next iteration
            # Run complete
            result = run.result
            yield {"event": "done", "data": json.dumps({
                "output": result.output if result else "",
                "usage": {"input_tokens": ..., "output_tokens": ...},
            })}

    return EventSourceResponse(event_generator())
```

### Pattern 3: Agent Session Persistence

**What:** Store `AgentSession` + `AgentMessage` in DB, restore via `message_history`.
**When to use:** Every agent chat turn — load history, run agent, save new messages.

```python
# Source: PydanticAI message-history docs
from pydantic_ai.messages import ModelMessagesTypeAdapter

# Save after run
new_messages_json: bytes = result.all_messages_json()
# Store in AgentMessage.messages_json column

# Restore before next run
stored_json: bytes = session.messages_json  # from DB
message_history = ModelMessagesTypeAdapter.validate_json(stored_json)
# Pass to agent.iter(message_history=message_history)
```

### Pattern 4: Provider Resolution (PydanticAI ↔ Existing ProviderManager)

**What:** Map existing env-based provider credentials to PydanticAI model strings.
**When to use:** When creating PydanticAI Agent instances based on user model selection.

```python
# PydanticAI model string format
PROVIDER_MODEL_MAP = {
    "openai": lambda model: f"openai:{model}",           # openai:gpt-4o
    "gemini": lambda model: f"google-gla:{model}",       # google-gla:gemini-2.5-flash
    "deepseek": lambda model: f"openai:{model}",         # Via OpenAI-compat + custom provider
    "grok": lambda model: f"xai:{model}",                # xai:grok-...
}

# DeepSeek needs custom provider with base_url
from pydantic_ai.providers.openai import OpenAIProvider
deepseek_provider = OpenAIProvider(
    api_key=settings.DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com"
)
```

### Pattern 5: Pipeline Tool (Deterministic Multi-Step)

**What:** Register a "pipeline" as a single PydanticAI tool that internally chains multiple skills.
**When to use:** For complete workflows like "generate full episode" (script → characters → scenes → storyboard).

```python
async def run_episode_pipeline(
    ctx: RunContext[AgentDeps],
    canvas_id: str,
    steps: list[str] | None = None,
) -> str:
    """Generate a complete episode pipeline: script → characters → scenes → storyboard.
    
    Args:
        canvas_id: Target canvas ID
        steps: Optional list of steps to run (default: all)
    """
    all_steps = ["script_generate", "character_extract", "scene_extract", "storyboard_plan"]
    run_steps = steps or all_steps
    
    results = {}
    for step_name in run_steps:
        if step_name not in all_steps:
            continue
        # Build params from previous results
        params = build_step_params(step_name, results, canvas_id)
        skill_result = await ctx.deps.registry.invoke(step_name, params, ctx.deps.skill_context)
        results[step_name] = skill_result
        # SSE progress emitted via tool result
    
    return json.dumps({"completed_steps": list(results.keys()), "summary": "..."})
```

### Anti-Patterns to Avoid

- **Don't hardcode tools with `@agent.tool`**: Use `FunctionToolset`/`AbstractToolset` for dynamic registration from SkillRegistry. Hardcoded decorators don't scale with 15+ skills.
- **Don't pass raw SkillResult as tool return**: PydanticAI expects string or JSON-serializable return from tools. Always `json.dumps(result.to_dict())`.
- **Don't store PydanticAI ModelMessage objects directly in DB**: Store the JSON serialization (`all_messages_json()`), not Python objects. Deserialization via `ModelMessagesTypeAdapter.validate_json()`.
- **Don't create a new Agent instance per request**: Create agent templates at startup, parameterize per-request via `deps` and runtime `toolsets`.
- **Don't use WebSocket for agent chat**: SSE is simpler, stateless, auto-reconnects. Agent chat is request-response with server-push, not bidirectional.
- **Don't bypass SkillExecutor for agent tool calls**: Route through `SkillExecutor.invoke()` to preserve billing/logging. The SkillToolset's `call_tool()` must go through the executor path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool calling protocol | Custom function-calling adapter per LLM provider | PydanticAI `Agent` with provider-specific models | PydanticAI handles OpenAI/Gemini/xAI tool-calling differences transparently |
| Message serialization | Custom JSON schema for chat messages | PydanticAI `ModelMessagesTypeAdapter` | Handles all message types (text, tool calls, tool results, multi-part), version-stable |
| SSE event formatting | Manual `f"data: {json}\n\n"` string building | `sse-starlette` `EventSourceResponse` | Handles keep-alive pings, proper headers, connection cleanup, spec compliance |
| Frontend SSE client | Native `EventSource` + manual reconnection | `@microsoft/fetch-event-source` | POST support, auth headers, proper error handling, AbortController |
| Provider abstraction | Custom adapter per LLM for tool calling | PydanticAI built-in providers (OpenAI/Google/xAI) | Each provider's tool calling format handled internally |

**Key insight:** PydanticAI already solved the hardest parts — multi-provider tool calling normalization, streaming iteration, and message serialization. The project's job is bridging SkillRegistry ↔ PydanticAI, not reimplementing agent infrastructure.

## Common Pitfalls

### Pitfall 1: Async Celery Skills in Agent Tool Loop

**What goes wrong:** Agent calls a Celery-async skill via tool, gets back `SkillResult(status="running", task_id="...")` instead of actual results. The LLM sees a "running" status and doesn't know what to do.
**Why it happens:** Skills with `execution_mode="async_celery"` dispatch to Celery and return immediately.
**How to avoid:** In the `SkillToolset.call_tool()`, when a skill is `async_celery`, either: (a) await a polling loop until completion (with timeout), or (b) convert skills to `sync` mode for agent context since the SSE stream already provides async behavior. Recommended: option (a) with a configurable timeout (120s default).
**Warning signs:** Agent repeatedly calling the same tool, "polling" behavior in LLM output.

### Pitfall 2: PydanticAI Message History Format Changes

**What goes wrong:** Stored message JSON fails to deserialize after PydanticAI version upgrade.
**Why it happens:** PydanticAI's `ModelRequest`/`ModelResponse` structure could evolve between major versions.
**How to avoid:** Pin PydanticAI to `>=1.73,<2.0` (they guarantee backward compat within v1.x). Store a `schema_version` field alongside messages. Use `ModelMessagesTypeAdapter.validate_json()` which handles migrations internally.
**Warning signs:** `ValidationError` on session restore.

### Pitfall 3: SSE Connection Dropped During Long Tool Execution

**What goes wrong:** Tool execution takes 30+ seconds (e.g., image generation), SSE connection times out or proxy cuts it.
**Why it happens:** Nginx/CloudFront default timeouts, browser idle detection.
**How to avoid:** Send periodic keep-alive events (`{"event": "heartbeat", "data": ""}`) every 15 seconds during long tool execution. `sse-starlette` has built-in `ping` support. Also set appropriate proxy timeouts.
**Warning signs:** Frontends show "connection lost" during image generation.

### Pitfall 4: Tool Name Conflicts Between Skills

**What goes wrong:** Two skills produce the same safe tool name after `.` → `_` conversion.
**Why it happens:** E.g., `text.llm_generate` and `text_llm_generate` would both become `text_llm_generate`.
**How to avoid:** Current skill naming convention uses `category.action` — the `to_tool_definition()` already converts dots to underscores. Verify uniqueness at registration time (already done in `register_all.py`). Add a duplicate check in `SkillToolset._build_tool_map()`.
**Warning signs:** PydanticAI raises `UserError` for duplicate tool names.

### Pitfall 5: Token Explosion from Large Tool Results

**What goes wrong:** Tool returns massive JSON (e.g., full script text, character list), consuming most of the context window.
**Why it happens:** Skills return full data by default; LLM receives everything as tool result.
**How to avoid:** Truncate/summarize tool results before returning to agent. Add a `max_result_tokens` parameter to `SkillToolset` (default: 2000 chars). Return summary + artifact reference instead of full content.
**Warning signs:** Agent "forgets" earlier conversation after a large tool result.

### Pitfall 6: PydanticAI Agent Not Using Project's Existing Provider Credentials

**What goes wrong:** PydanticAI tries to read `OPENAI_API_KEY` from env directly, ignoring the project's `ProviderManager` 3-tier credential lookup.
**Why it happens:** PydanticAI providers auto-read env vars by default.
**How to avoid:** Always create providers explicitly with `api_key` parameter from `ProviderManager.get_provider()`. Never rely on PydanticAI's auto-env detection. Example: `OpenAIProvider(api_key=resolved_key)`.
**Warning signs:** "API key not found" errors when team has configured custom keys.

## Code Examples

### Example 1: AgentSession and AgentMessage Models

```python
# Source: CONTEXT.md D4 + SQLAlchemy patterns from existing models
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer, JSON, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class AgentSession(Base):
    __tablename__ = "agent_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    canvas_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_name: Mapped[str] = mapped_column(String(100), default="gemini-2.5-flash")
    provider: Mapped[str] = mapped_column(String(50), default="gemini")
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | archived
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("AgentMessage", back_populates="session",
                          cascade="all, delete-orphan", order_by="AgentMessage.created_at")


class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user | assistant | tool-call | tool-result
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_calls_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tool_results_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # PydanticAI native message format for accurate history restoration
    pydantic_ai_messages_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session = relationship("AgentSession", back_populates="messages")
```

### Example 2: Agent Service — Provider Resolution + Agent Factory

```python
# Source: PydanticAI docs + existing ProviderManager pattern
from dataclasses import dataclass
from pydantic_ai import Agent
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.providers.google import GoogleProvider

@dataclass
class AgentDeps:
    """Dependencies injected into every agent run."""
    user_id: str
    project_id: str
    canvas_id: str | None
    session_id: str
    db: AsyncSession
    registry: SkillRegistry
    skill_context: SkillContext

def create_pydantic_model(provider_name: str, model_name: str):
    """Resolve project credentials → PydanticAI model instance."""
    from app.services.ai.provider_manager import get_provider_manager
    manager = get_provider_manager()
    
    # Get API key from project's credential chain
    api_key = _resolve_api_key(provider_name)
    
    if provider_name == "openai":
        provider = OpenAIProvider(api_key=api_key)
        return f"openai:{model_name}"  # PydanticAI resolves from env or explicit provider
    elif provider_name == "gemini":
        return GoogleModel(model_name, provider=GoogleProvider(api_key=api_key))
    elif provider_name == "deepseek":
        provider = OpenAIProvider(api_key=api_key, base_url="https://api.deepseek.com")
        return OpenAIChatModel(model_name, provider=provider)
    elif provider_name == "grok":
        return XaiModel(model_name, provider=XaiProvider(api_key=api_key))


SYSTEM_INSTRUCTIONS = """\
你是 Canvex 的 AI 创作助手，专注于短剧/短片的故事创作和分镜制作。
你可以使用各种工具来帮助用户完成创作任务。
当用户请求涉及完整流程时，优先使用 Pipeline 工具。
当用户请求涉及单个步骤时，使用对应的 Skill 工具。
始终用中文回复。
"""

def create_agent(provider_name: str, model_name: str) -> Agent[AgentDeps, str]:
    model = create_pydantic_model(provider_name, model_name)
    return Agent(
        model,
        deps_type=AgentDeps,
        instructions=SYSTEM_INSTRUCTIONS,
        retries=1,
    )
```

### Example 3: SSE Event Protocol

```python
# Source: CONTEXT.md D5 + FastAPI SSE patterns
import json
from enum import Enum

class SSEEventType(str, Enum):
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    TOKEN = "token"
    DONE = "done"
    ERROR = "error"
    HEARTBEAT = "heartbeat"

def sse_event(event_type: SSEEventType, data: dict) -> dict:
    return {"event": event_type.value, "data": json.dumps(data, ensure_ascii=False)}

# Usage in streaming endpoint:
# yield sse_event(SSEEventType.TOOL_CALL, {"tool": "script_generate", "args": {...}})
# yield sse_event(SSEEventType.TOKEN, {"text": "根据您的需求..."})
```

### Example 4: Frontend SSE Hook

```typescript
// Source: @microsoft/fetch-event-source docs + React patterns
import { fetchEventSource } from "@microsoft/fetch-event-source";

interface AgentMessage {
  role: "user" | "assistant" | "tool-call" | "tool-result";
  content: string;
  toolCalls?: { tool: string; args: Record<string, unknown>; callId: string }[];
  toolResults?: { tool: string; result: string; callId: string }[];
}

interface UseAgentChatReturn {
  messages: AgentMessage[];
  isStreaming: boolean;
  sendMessage: (content: string) => void;
  abort: () => void;
}

function useAgentChat(sessionId: string): UseAgentChatReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    // Add user message optimistically
    setMessages(prev => [...prev, { role: "user", content }]);

    let assistantContent = "";

    await fetchEventSource(`${API_BASE}/api/v1/agent/chat/${sessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
      body: JSON.stringify({ message: content }),
      signal: controller.signal,
      onmessage(ev) {
        const data = JSON.parse(ev.data);
        switch (ev.event) {
          case "thinking":
            // Update thinking indicator
            break;
          case "tool_call":
            setMessages(prev => [...prev, {
              role: "tool-call",
              content: `调用 ${data.tool}`,
              toolCalls: [data],
            }]);
            break;
          case "tool_result":
            setMessages(prev => [...prev, {
              role: "tool-result",
              content: data.summary,
              toolResults: [data],
            }]);
            break;
          case "token":
            assistantContent += data.text;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return [...prev.slice(0, -1), { ...last, content: assistantContent }];
              }
              return [...prev, { role: "assistant", content: assistantContent }];
            });
            break;
          case "done":
            break;
        }
      },
      onclose() { setIsStreaming(false); },
      onerror(err) { setIsStreaming(false); throw err; },
    });
  }, [sessionId]);

  return { messages, isStreaming, sendMessage, abort: () => abortRef.current?.abort() };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@agent.tool` hardcoded decorators | `FunctionToolset` / `AbstractToolset` runtime registration | PydanticAI v1.40+ (2025-Q4) | Dynamic tools without agent recreation |
| `agent.run_stream()` for streaming | `agent.iter()` for node-level control | PydanticAI v1.20+ (2025-Q3) | Can distinguish thinking vs tool-call vs text at node level |
| `ModelMessagesTypeAdapter` from `pydantic_ai.messages` | Same, stable since v1.0 | Stable | Core serialization path for message persistence |
| `result.all_messages()` returns list[ModelMessage] | Same + `all_messages_json()` returns bytes | Stable | JSON bytes for direct DB storage |
| OpenAI function calling only | PydanticAI normalizes across OpenAI/Gemini/xAI/Anthropic | PydanticAI v1.0+ | One tool definition works across all providers |

**Deprecated/outdated:**
- `Agent._function_tools` direct manipulation: Use `FunctionToolset`/`AbstractToolset` instead
- `result.data` for accessing output: Use `result.output` (renamed in v1.0)
- `agent.run_stream()` alone for tool-call visibility: Use `agent.iter()` which gives node-level access

## Open Questions

1. **Celery async skill handling in agent loop**
   - What we know: Skills like `image_gen` use Celery async and return `task_id`. Agent needs actual results.
   - What's unclear: Best polling interval and timeout. Should we convert all skills to sync for agent context, or poll Celery within the toolset?
   - Recommendation: Poll within `SkillToolset.call_tool()` with 120s timeout, 2s intervals. Emit `heartbeat` SSE events during wait. Mark ultra-long skills (video gen) as agent-incompatible for Phase 03.

2. **Context window management for long sessions**
   - What we know: D4 says "simple truncation (keep recent N messages)". PydanticAI's `message_history` accepts full list.
   - What's unclear: Optimal N value. Whether to count by messages or tokens.
   - Recommendation: Start with last 20 messages. Pre-compute approximate token count per message at storage time. Phase 04+ can add summarization.

3. **SKILL.md migration timing (D8 prerequisite)**
   - What we know: D8 says "Phase 03 之前需迁移 prompt_seeds". Current skills are Python-based.
   - What's unclear: Whether full SKILL.md migration is blocking or can be done incrementally within Phase 03.
   - Recommendation: Phase 03 can work with existing Python-based SkillRegistry. SKILL.md format migration can happen as a sub-task within Phase 03 without blocking agent functionality.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.13+ | PydanticAI | ✓ | 3.13 (pyproject.toml) | — |
| Redis | Celery (existing) | ✓ (Docker) | — | SQLite mode skips Celery |
| `pydantic-ai` | Agent framework | ✗ (not yet installed) | 1.73.0 target | `uv add` in Wave 0 |
| `sse-starlette` | SSE streaming | ✗ (not yet installed) | 3.3.3 target | `uv add` in Wave 0 |
| `@microsoft/fetch-event-source` | Frontend SSE | ✗ (not yet installed) | 2.0.1 target | `npm install` in Wave 0 |

**Missing dependencies with no fallback:** None — all are installable.

**Missing dependencies with fallback:** None needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.5 + pytest-asyncio 0.25.2 |
| Config file | `api/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd api && uv run pytest tests/ -x -q` |
| Full suite command | `cd api && uv run pytest tests/ -v` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-05 | SkillToolset generates correct PydanticAI ToolDefinitions from registry | unit | `pytest tests/test_skill_toolset.py -x` | ❌ Wave 0 |
| REQ-05 | Agent can call a skill tool and receive result | integration | `pytest tests/test_agent_integration.py::test_tool_calling -x` | ❌ Wave 0 |
| REQ-05 | Agent session persist/restore round-trip | unit | `pytest tests/test_agent_session.py -x` | ❌ Wave 0 |
| REQ-06 | SSE endpoint emits correct event types | integration | `pytest tests/test_agent_sse.py -x` | ❌ Wave 0 |
| REQ-06 | SSE events include tool_call and tool_result | integration | `pytest tests/test_agent_sse.py::test_tool_events -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd api && uv run pytest tests/ -x -q`
- **Per wave merge:** `cd api && uv run pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_skill_toolset.py` — covers SkillToolset ↔ SkillRegistry bridge
- [ ] `tests/test_agent_session.py` — covers session persistence/restore
- [ ] `tests/test_agent_sse.py` — covers SSE event protocol
- [ ] `tests/test_agent_integration.py` — covers agent tool-calling end-to-end
- [ ] Framework install: `uv add pydantic-ai-slim[openai,google,xai] sse-starlette` + `npm install @microsoft/fetch-event-source`

## Sources

### Primary (HIGH confidence)
- [PydanticAI Official Docs](https://ai.pydantic.dev/) — Tools, Toolsets, agent.iter(), message-history, dependencies
- [PydanticAI API Reference](https://ai.pydantic.dev/api/run/) — AgentRun, PartDeltaEvent, TextPartDelta
- [PydanticAI Providers](https://ai.pydantic.dev/api/providers/) — OpenAI, Google, xAI provider setup
- [PyPI pydantic-ai](https://pypi.org/project/pydantic-ai/) — Version 1.73.0 confirmed

### Secondary (MEDIUM confidence)
- [PydanticAI Streaming Example](https://rolandplesz.com/pydanticai-streaming-example-using-agent-iter/) — agent.iter() streaming implementation pattern
- [FastAPI SSE Docs](https://fastapi.tiangolo.com/tutorial/server-sent-events/) — Native SSE support reference
- [sse-starlette](https://pypi.org/project/sse-starlette/) — Version 3.3.3 confirmed
- [@microsoft/fetch-event-source](https://www.npmjs.com/package/@microsoft/fetch-event-source) — Version 2.0.1 confirmed

### Tertiary (LOW confidence)
- [PydanticAI AbstractMemoryStore RFC #4773](https://github.com/pydantic/pydantic-ai/issues/4773) — Future persistence API (not yet shipped, manual persistence for now)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — PydanticAI v1.73.0 confirmed on PyPI, all APIs verified via official docs
- Architecture: **HIGH** — Patterns derived from official PydanticAI docs + existing codebase analysis
- Pitfalls: **HIGH** — Based on actual codebase analysis (async Celery skills, provider credential chain)
- Frontend patterns: **MEDIUM** — SSE client patterns well-documented, but chat sidebar specifics are project-specific design

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (PydanticAI is actively developed, check for v1.74+ changes)
