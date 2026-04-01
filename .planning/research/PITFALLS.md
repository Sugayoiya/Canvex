# Pitfalls Research

**Domain:** Agent System Upgrade — QueryEngine, ArtifactStore, Skill Expansion, AI Call Convergence, Canvas-Chat Orchestration on existing PydanticAI + Celery + SkillRegistry system
**Researched:** 2026-04-02
**Confidence:** HIGH (verified against codebase + PydanticAI docs + community issues)

## Critical Pitfalls

### Pitfall 1: AI 调用路径收敛时的隐式双栈竞争

**What goes wrong:**
系统当前有 3 条割裂的 AI 调用栈：(A) PydanticAI Agent 直读 `settings.GEMINI_API_KEY` 创建模型 (`agent_service.create_pydantic_model`)，(B) `ProviderManager.get_provider_sync()` 走 env-var，(C) 图/视频技能直接读 `settings.GEMINI_API_KEY`。收敛到统一路径时，如果分阶段迁移（先改 A、再改 B/C），中间状态会出现**同一请求链路内同时走新旧路径**——比如 Agent 用了 DB 密钥链选出 team-scoped key，但 Agent 调用的 visual Skill handler 内部仍然读 env var，导致计费归属错误、密钥配额不一致、rate limit 被重复消耗。

**Why it happens:**
`create_pydantic_model()` 独立构造 PydanticAI Model 实例，不经过 `ProviderManager`。14 个 Skill handler 分散在 `skills/text.py`、`skills/visual.py` 等文件中，各自直接 import `settings` 或通过 `get_provider_sync()` 获取 provider。没有中间抽象层保证"一个请求只用一把 key"。

**How to avoid:**
1. 第一步收敛：让 `create_pydantic_model()` 也经过 `ProviderManager.get_provider()` 的异步密钥链（team → personal → system → env），返回解密后的 key + owner 描述。
2. 在 `SkillContext` 中增加 `resolved_api_key` 和 `resolved_provider` 字段，由 Agent 会话启动时一次解析、注入到 context 中向下传递，所有 Skill handler 从 context 中读取而非自行解析。
3. 用 deprecation warning 标记 `get_provider_sync()` 和直接读 `settings.*_API_KEY` 的调用点，CI lint 检查禁止新增直接读取。

**Warning signs:**
- 同一 trace_id 下出现两个不同 API key 的 AI call log
- Team A 的密钥配额消耗与其实际使用量不符
- Admin monitoring 仪表盘显示 "env" 来源调用占比在收敛后不降反升

**Phase to address:**
Phase 1（AI 调用路径收敛）——这是地基，必须在所有其他功能之前完成。

---

### Pitfall 2: QueryEngine 包装 agent.iter() 破坏 SSE 流式输出

**What goes wrong:**
在现有 `agent.iter()` 外层包装 QueryEngine（token 预算、轮次限制、递减检测）时，如果 QueryEngine 在 `async for node in run` 循环外层做了 try/except 或提前退出逻辑，会导致：(1) SSE 连接断开但 agent 内部仍在执行 tool call（zombie execution），(2) `run_result.all_messages_json()` 在未正常结束时抛异常导致消息历史丢失，(3) 递减检测逻辑在 `is_model_request_node` 和 `is_call_tools_node` 交替出现时误判——把"工具执行后的第二轮模型请求"算作递减而提前终止。

**Why it happens:**
PydanticAI `agent.iter()` 返回的 `async with` 上下文管理器有严格的生命周期——提前退出 (`break`) 会触发 cleanup，但此时如果有 pending tool calls 还在 Celery 中执行，`SkillToolset._poll_async()` 的 `asyncio.sleep` 会被 cancel。当前代码（`agent.py:224-316`）的 SSE 生成器已经是深度嵌套的 `async with agent.iter() → async for node → async with node.stream()` 三层结构，再加一层 QueryEngine 控制循环极易打破 yield 顺序。

PydanticAI issue #640 和 #1007 确认：streaming tool calls 在非官方 API 端点下行为不一致，`stream_text(delta=True)` 在 tool call 响应后可能返回空内容。

**How to avoid:**
1. QueryEngine 不要包在 `agent.iter()` 外层，而是作为**agent 内部的 hook/middleware**——利用 PydanticAI 的 `hooks` API 在每次 model request 前检查 token 预算和轮次计数。
2. 或者：QueryEngine 作为一个 wrapper 类，持有 agent 实例，在调用 `iter()` 前注入 `UsageLimits(total_tokens_limit=N, tool_calls_limit=M)`，利用 PydanticAI 原生的 `UsageLimitExceeded` 异常来终止——这比手动 break 更安全。
3. 递减检测不要按 node 计数，要按 `run_result.usage().output_tokens` 的实际增量判断——每轮输出 token 数递减才是真递减。
4. 在 SSE event_generator 的 `except` 块中，确保 `toolset.cancel()` 被调用且 partial messages 被持久化（当前代码已有此逻辑，但 QueryEngine 中断路径需要复制此保障）。

**Warning signs:**
- SSE 连接在 tool call 执行中突然 `done` 但没有 final output
- `AgentMessage` 表中出现 `pydantic_ai_messages_json = "[]"` 的记录（说明 cleanup 路径被触发）
- Celery 任务 `SUCCESS` 但 agent 已返回 `failed`

**Phase to address:**
Phase 2（QueryEngine）——必须在 AI 调用收敛之后、Skill 扩展之前。

---

### Pitfall 3: ArtifactStore 与 Celery task result 的存储竞争

**What goes wrong:**
当前 Celery 异步 Skill 的结果通过 `celery_app.AsyncResult(task_id).result` 获取（`registry.poll()`），然后由 `SkillToolset._poll_async()` 轮询返回。引入 ArtifactStore（会话级产物持久化）后，如果 ArtifactStore 在 Celery worker 端写入（`skill_task.py:_update_log`），而 Agent 端也在 `poll()` 返回后写入，会导致：(1) 同一产物被写入两次（Celery result backend + ArtifactStore），(2) Celery 的 `result.result` 包含完整 JSON payload 占用 Redis 内存，ArtifactStore 又存了一份到 DB，(3) 大型产物（图片 base64、长文本）通过 Celery message broker 传输导致 Redis 内存暴涨。

**Why it happens:**
Celery 设计假设 task result 是轻量级的（状态码 + 小型数据），但 AI Skill 的产物往往很大（生成的剧本可能 10KB+，图片 URL 列表、storyboard JSON 等）。当前 `SkillResult.to_dict()` 把 `data` 和 `artifacts` 全部序列化到 Celery result 中。社区经验表明：超过 512KB 的 Celery result 应该存到外部存储只传引用。

**How to avoid:**
1. **ArtifactStore 作为唯一持久化层**：Celery worker 端的 `_update_log` 改为同时写入 ArtifactStore，`SkillResult.to_dict()` 只返回 `artifact_ids` 引用而非完整数据。
2. **ToolInterceptor 模式**：在 `SkillToolset.call_tool()` 返回结果后、注入给 agent 之前，ToolInterceptor 截获结果、写入 ArtifactStore、替换 payload 为摘要 + artifact_id。这样 agent context 中只有摘要，不会因为大型产物撑爆 token 窗口。
3. **Celery result_backend 设置 `result_expires`**：短期过期（如 1 小时），避免 Redis 积累大量过期结果。
4. 避免在 `SkillResult.artifacts` 字段中放 base64 数据——一律使用文件路径/URL 引用。

**Warning signs:**
- Redis `used_memory` 持续增长不回落
- `SkillToolset._poll_async` 返回的 JSON 超过 100KB
- Agent 的 token usage 异常高（因为 tool result 中包含大量原始数据被送入模型上下文）

**Phase to address:**
Phase 3（ArtifactStore + ToolInterceptor）——在 QueryEngine 之后，Skill 扩展之前。

---

### Pitfall 4: SkillDescriptor 增强导致 14 个现有 Skill 注册静默失败

**What goes wrong:**
给 `SkillDescriptor` 添加新的 required 字段（如 `mode`、`dependencies`、`tier`）时，如果新字段没有默认值，现有 14 个 Skill 的注册代码全部 break。更隐蔽的问题：即使新字段有默认值，如果 `SkillToolset._build_tool_map()` 的工具名生成逻辑 (`category__skill_name`) 因为新的分类体系改变了 category 枚举值，所有已保存的 `AgentMessage.tool_calls_json` 中的 tool name 就和新注册的 tool name 不匹配——导致**历史会话无法恢复**（`load_message_history` 反序列化后 agent 找不到对应 tool）。

**Why it happens:**
`SkillDescriptor` 是 `@dataclass`，不是 Pydantic model，没有 field validator。`SkillCategory` enum 值直接参与 tool name 生成（`safe_name = f"{desc.category.value.lower()}__{desc.name.split('.')[-1]}"`）。历史消息中的 tool call 记录 (`pydantic_ai_messages_json`) 用 tool name 做 key，PydanticAI 在 `iter()` 恢复历史时会尝试匹配 tool name。

业界数据：60% 的 production agent failures 源于 tool versioning 不一致。

**How to avoid:**
1. **所有新字段必须有默认值**，且与旧行为兼容（如 `mode: str = "default"`, `tier: str = "standard"`）。
2. **Tool name 生成逻辑冻结**：safe_name 映射在 `register_all_skills()` 之后通过 snapshot 测试锁定——任何 tool name 变化必须触发迁移脚本。
3. **新增 `SkillCategory` 枚举值不修改已有值**：只 append（如添加 `STORY = "STORY"`, `IMPORT = "IMPORT"`），不重命名已有的 `TEXT`, `EXTRACT` 等。
4. **历史消息兼容**：在 `load_message_history` 中添加 tool name 映射层——如果历史 tool name 不在当前 registry 中，查 alias 表映射到新 name。
5. 在 `register_all_skills()` 末尾添加 integration test：验证注册数量 >= 14，且所有已知 tool name 存在。

**Warning signs:**
- `register_all_skills()` 启动时日志显示 skill_count < 14
- 用户恢复旧会话后 agent 报 "Unknown tool" 错误
- `SkillToolset._build_tool_map()` 抛出 `ValueError: Duplicate safe_name`

**Phase to address:**
Phase 4（SkillDescriptor 增强）——必须在 Skill 扩展（Phase 5）之前完成。

---

### Pitfall 5: 7 阶段业务方法 Skill 化时丢失直接 API 调用路径

**What goes wrong:**
将 `services/ai/business/` 下的 7 阶段服务（script_service, character_service, scene_service 等）转为 Skill 后，如果只保留 Skill 调用入口而移除或废弃原有的 API endpoint handler（如 `api/v1/ai_generate.py` 中的直接调用），前端的非 Agent 调用路径（用户在 UI 上点击"AI 生成剧本"按钮直接触发，不经过 Agent chat）就断了。团队常犯的错误是假设"所有调用都走 Agent"，但实际上 canvas node execution、批量操作、API 直调都需要绕过 Agent 直接调用 Skill。

**Why it happens:**
当前架构中 `api/v1/ai_generate.py` 直接调用 `ScriptService().generate()` 等方法。Skill 化后这些方法变成 Skill handler 注册到 registry 中。如果把原有 service 方法删了只留 Skill handler，那 `api/v1/ai_generate.py` 要么改为调用 `skill_registry.invoke()`（引入了不必要的 Celery 异步开销），要么就断了。

社区经验：Agent Skill 拆分后，10 个工具以内 LLM 工具选择准确率最佳；20-60 个工具时准确率显著下降。30+ Skills 需要分组/分层策略。

**How to avoid:**
1. **Skill handler 是 thin wrapper**：Skill handler 调用底层 service 方法，而非替代它。`ScriptService.generate()` 保持不变，新增 `Skill handler` 调用 `ScriptService.generate()`。API endpoint 继续直接调用 `ScriptService`。
2. **双入口架构**：
   - Direct API → `Service.method()` → provider
   - Agent → `SkillRegistry.invoke()` → `Skill handler` → `Service.method()` → provider
3. **Skill 分层**：30+ Skills 不要一次性全暴露给 Agent。按场景动态加载——canvas 对话只加载与当前画布相关的 Skills；剧本创作对话只加载 SCRIPT + TEXT 类 Skills。利用 `SkillToolset(categories=["SCRIPT", "TEXT"])` 已有的过滤机制。
4. **每个旧 API endpoint 保留并标记**：在 Skill 化完成后跑一遍前端调用路径测试，确认所有非 Agent 调用仍然正常。

**Warning signs:**
- 前端 `ai_generate` API 调用返回 404 或 500
- Agent 工具选择频繁出错（在 30+ tools 中选错 Skill）
- Canvas node execution 超时（因为意外走了 Celery 异步路径而非同步直调）

**Phase to address:**
Phase 5（7 阶段 Skill 化）——必须在 SkillDescriptor 增强之后。

---

### Pitfall 6: Agent 写工具导致不可逆数据变更

**What goes wrong:**
当前 `context_tools.py` 只有读操作（get_project_characters, get_project_scenes, get_script_content, get_canvas_state）。添加写工具（create_character, update_shot, delete_scene 等）后，Agent 可能在对话中**未经用户确认就执行破坏性操作**——比如用户说"帮我重新规划所有分镜"，Agent 调用 delete + batch_create 把已有的手动编辑的分镜全删了。LLM 的 tool call 决策是概率性的，没有确定性保证。

**Why it happens:**
PydanticAI 的 tool 执行是自动的——agent 决定调用哪个 tool，framework 自动执行。没有内置的 "human-in-the-loop confirmation" 机制（虽然 `pydantic-ai-shields` 提供了 `ToolGuard`，但需要显式集成）。SSE 流式场景下，tool call 事件发送给前端后立即执行，前端没有拦截窗口。

**How to avoid:**
1. **写工具分级**：
   - `safe_write`：创建新资源（create_character, add_shot）——自动执行，风险低
   - `destructive_write`：修改/删除已有资源（update_shot, delete_scene）——需要确认
2. **Confirmation gate 模式**：
   - Agent 调用 destructive 写工具时，`ToolInterceptor` 截获调用
   - 返回 `{"status": "pending_confirmation", "action": "delete_scene", "target": "场景A"}` 给 Agent
   - Agent 将确认请求作为文本输出给用户
   - 用户在下一轮对话确认后，Agent 再次调用（带 `confirmed=true` 参数）
3. **Soft delete 优先**：所有 delete 操作使用 soft delete（`is_deleted = True`），支持撤销。
4. **事务快照**：写操作前自动创建 ShotVersion（已有 versioning_service.py），扩展到 Character/Scene。
5. **Scope 限制**：写工具强制绑定 `project_id`，不允许跨项目操作。`SkillContext` 中的 `project_id` 作为写操作的隐式 scope——handler 中 assert `target.project_id == context.project_id`。

**Warning signs:**
- 用户反馈 "我的分镜/角色消失了"
- `AdminAuditLog` 中出现大量 agent trigger 的 delete 操作
- Agent session 日志中 tool_call 紧接着另一个 tool_call，中间没有用户确认

**Phase to address:**
Phase 6（Context Tools 扩充 + 写操作 + 权限控制）——在 Skill 化完成之后。

---

### Pitfall 7: SubAgentTool 的 token 预算穿透与流式事件丢失

**What goes wrong:**
父 Agent 通过 SubAgentTool 委托子 Agent 执行任务时：(1) 子 Agent 的 token 消耗不计入父 Agent 的 `UsageLimits`，导致总成本失控；(2) 子 Agent 的 streaming 事件（tool calls, text tokens）无法穿透到父 Agent 的 SSE 连接——用户看到长时间空白；(3) 子 Agent 在 Celery worker 中执行时没有 `db` session（因为 `AgentDeps.db` 是请求级别的 AsyncSession，无法序列化到 Celery）。

**Why it happens:**
PydanticAI 官方文档明确要求在 agent delegation 时 "pass `ctx.usage` to the child agent's `run()` method"，但这需要手动实现。`SubAgentTool` 如果作为 Skill 通过 Celery 异步执行，就跨了进程边界，`ctx.usage` 无法共享。

子 Agent streaming 事件穿透是 PydanticAI 社区的已知 open issue（#1978），官方尚未提供原生解决方案。

**How to avoid:**
1. **SubAgent 必须 in-process 执行**（`execution_mode = "sync"`），不走 Celery，直接在父 Agent 的 `call_tool` 中 `await child_agent.run()`。这样 `ctx.usage` 可以直接传递。
2. **独立 token 预算**：SubAgentTool 初始化时分配独立 `UsageLimits`（如父 Agent 总预算的 30%），子 Agent 完成后将实际消耗回报给父 Agent 的 QueryEngine。
3. **SSE 事件代理**：子 Agent 不直接 yield SSE 事件，而是将中间状态写入共享的 `asyncio.Queue`，父 Agent 的 SSE event_generator 从 queue 中消费并转发。或者用 PydanticAI 的 `hooks` API 在子 Agent 的 tool call 事件触发时回调父级 handler。
4. **避免嵌套 Celery**：SubAgent 调用 Skill 时如果 Skill 是 `async_celery` 模式，在 SubAgent 内改为 sync 直调（绕过 Celery dispatch），避免"Agent → Celery → SubAgent → Celery"的双重异步地狱。

**Warning signs:**
- Agent 会话的 `total_tokens` 与实际 AI 调用日志的 token 总和不一致
- 用户在等待 SubAgent 执行时看到 15 秒以上的无 SSE 事件空白期
- SubAgent 在 Celery worker 中抛 `AttributeError: 'NoneType' has no attribute 'execute'`（db session 为 None）

**Phase to address:**
Phase 8（SubAgentTool）——在核心功能稳定后。

---

### Pitfall 8: Admin 技能管理页面造成运行时配置漂移

**What goes wrong:**
Admin 在管理页面禁用/启用/重新排序 Skill 后，Web 进程的 `SkillRegistry` singleton 状态与 Celery worker 进程中的 registry 不同步。Admin 禁用了 `visual.generate_image`，Web 进程的 Agent 不再暴露该 tool，但 Celery worker 中的 registry 仍然注册着它——如果有已提交的 Celery task 正在执行该 Skill，结果仍然会返回。更糟的是，下次 Celery worker 重启时，`register_all_skills()` 会重新注册所有 Skills，覆盖 Admin 的配置。

**Why it happens:**
当前 `SkillRegistry` 是纯内存 singleton，`register_all_skills()` 是代码级硬编码注册。Admin 管理页面的"禁用 Skill"操作如果只修改 DB 标记而不通知 worker 进程，就会产生 Web ↔ Worker 状态分裂。Celery worker 的 `_ensure_skills_registered()` 使用 `_registry_initialized` 布尔锁，初始化后不会再次检查。

社区经验：oh-my-opencode 的双缓存漂移问题（skill 工具缓存 vs 原生注册缓存无统一失效机制）是已知的 anti-pattern。

**How to avoid:**
1. **DB 作为 truth source**：`SkillDescriptor` 的启用/禁用状态存储在 DB（`skill_configs` 表），`SkillToolset._build_tool_map()` 在构建时查询 DB 过滤已禁用 Skill。
2. **Web 端按请求加载**：每次 Agent 会话创建时，`SkillToolset` 构造函数查询当前启用的 Skills，而非依赖全局 singleton 状态。
3. **Worker 端定期刷新**：Celery worker 在每次 `run_skill_task` 执行前检查该 Skill 是否被禁用（DB 查询，可加短时缓存如 60 秒 TTL）。
4. **不做 hot reload**：Admin 禁用 Skill 后，效果在下次 Agent 会话/Skill 执行时生效（eventual consistency），避免复杂的进程间通信。明确告知 Admin "配置变更将在 60 秒内生效"。
5. **Audit trail**：Admin 的 Skill 配置变更写入 `AdminAuditLog`，可追溯。

**Warning signs:**
- Admin 禁用某 Skill 后用户仍能通过 Agent 调用成功
- Celery worker 重启后 Admin 的自定义配置丢失
- `register_all_skills()` 日志显示的 skill_count 与 Admin 页面显示的启用数量不一致

**Phase to address:**
Phase 7（Admin 技能管理页面）——在 Skill 扩展完成、系统稳定后。

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `create_pydantic_model()` 直读 env var | 快速集成 PydanticAI，无需改 provider_manager | Agent 永远无法使用 DB 密钥链，team-scoped key 在 Agent 中不生效 | **Never** — Phase 1 必须修复 |
| Celery result 中存储完整产物数据 | 无需额外存储层，poll 直接拿到完整结果 | Redis 内存膨胀，大型产物序列化/反序列化开销，token 窗口被产物数据撑爆 | MVP 阶段可容忍，Phase 3 必须迁移到 ArtifactStore 引用模式 |
| SkillToolset 使用 `_PERMISSIVE_VALIDATOR`（any_schema） | 绕过 PydanticAI 的 tool 参数校验，快速对接 Skill | Agent 传入错误参数时无法在 framework 层拦截，错误延迟到 handler 执行时才暴露 | 当前 14 Skills 可接受；30+ Skills 后应启用 schema 校验 |
| 轮询式 Celery 结果查询（`_poll_async` 指数退避） | 实现简单，不需要 WebSocket/callback | Agent 的一个 tool call 最多阻塞 120 秒轮询循环，占用 event loop | 短期可接受，长期应改为 Celery event callback + asyncio.Event 通知 |
| `register_all_skills()` 硬编码注册 | 启动确定性强，不需要 DB | Admin 无法动态管理 Skill，所有变更需要代码部署 | Phase 7 之前可接受 |
| `AgentMessage.pydantic_ai_messages_json` 存完整 message history snapshot | 恢复历史简单——只需读最新一条 | 每条消息都冗余存储完整历史，DB 空间增长与消息数量平方成正比 | 当前规模可接受；会话超过 50 轮时需要改为增量存储 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PydanticAI `agent.iter()` + SSE | 在 `async for node in run` 中间 `break` 导致 cleanup 触发但 Celery task 仍在执行 | 使用 `UsageLimits` 原生中断机制，或在 break 前显式 `toolset.cancel()` 并等待 pending tasks |
| PydanticAI + `ProviderManager` | PydanticAI 需要 `OpenAIModel`/`GoogleModel` 实例，但 `ProviderManager` 返回 `AIProviderBase` 实例 | 在 `ProviderManager` 中增加 `get_pydantic_model()` 方法，直接返回 PydanticAI Model 实例而非自研 base class 实例 |
| Celery worker + SQLAlchemy async session | Worker 中 `loop.run_until_complete()` 创建 async session，但 session 在 coroutine 外泄漏 | 确保每次 `_do_update()` 使用 `async with AsyncSessionLocal() as session` 管理生命周期（当前代码已正确） |
| SkillToolset + PydanticAI tool name | PydanticAI 要求 tool name 符合 `[a-zA-Z0-9_]` 模式 | 当前使用 `category__skill_name` 双下划线分隔，确保 Skill name 中不含其他特殊字符 |
| Celery task retry + ArtifactStore | `self.retry(exc=exc)` 会重新执行 handler，如果 ArtifactStore 写入不是幂等的，会产生重复产物 | ArtifactStore 写入使用 `task_id + step` 作为幂等 key，重复写入覆盖而非追加 |
| PydanticAI message history + tool name 变更 | 恢复历史时 tool name 不匹配当前 registry 导致 deserialization 失败 | 在 `ModelMessagesTypeAdapter.validate_json()` 外加 try/except，tool name 不匹配时降级为空历史而非崩溃 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Agent 每轮都拉取完整 project context（characters + scenes + canvas state） | 单次 chat 响应 > 5 秒，input_tokens 异常高 | context_tools 按需调用（agent 主动决定是否查询），不要在 system prompt 中 prefill 全量上下文 | > 20 characters + > 50 scenes 时 |
| `_poll_async` 轮询间隔过短 | Celery broker 被 poll 请求淹没，CPU 空转 | 指数退避 + jitter（当前已实现），但上限 10 秒过长——AI 图片生成任务应有独立的更长超时 | > 10 并发 agent 会话时 |
| 30+ Skills 全量暴露给 Agent | tool selection 准确率下降，模型 confused | 按会话上下文动态加载 Skill 子集（<= 15 个），使用 `categories` 过滤 | > 20 tools 时准确率显著下降 |
| `pydantic_ai_messages_json` 存储完整快照 | DB 增长快，`load_message_history` 加载慢 | 改为增量存储或压缩存储，加 `max_messages` 截断（当前 max=20） | 会话 > 100 轮时 |
| SubAgent in-process 执行阻塞父 Agent 的 SSE 心跳 | 前端 SSE 连接因心跳超时断开 | SubAgent 执行在独立 asyncio.Task 中，父 Agent event_generator 保持 yield heartbeat | 子 Agent 执行 > 15 秒时（SSE ping 间隔 15 秒） |
| ArtifactStore DB 写入在 tool call 关键路径上 | tool call 延迟增加 50-200ms | Artifact 写入异步化（fire-and-forget 或 buffered batch write），不阻塞 tool result 返回 | > 50 tool calls/session 时 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| 写工具不校验 project_id scope | Agent 可被 prompt injection 引导操作其他项目的数据 | 每个写工具 handler 中 assert `target.project_id == ctx.deps.project_id`，不信任 agent 传入的 project_id 参数 |
| SubAgent 继承父 Agent 的完整权限 | 子 Agent 拥有不必要的写权限，攻击面扩大 | SubAgent 使用 reduced-permission SkillContext（只包含所需操作的最小权限） |
| Admin Skill 管理不记录变更 | 无法审计谁在何时禁用/启用了什么 Skill | 所有配置变更经过 AdminAuditLog |
| `SkillContext.to_dict()` 序列化包含 `resolved_api_key` | Celery message 中泄漏 API key 明文 | `resolved_api_key` 不参与序列化，Celery worker 端独立从 DB 解析 key |
| Agent 历史消息中包含 API key 或密钥信息 | 历史消息持久化到 DB，密钥泄漏 | ToolInterceptor 在存储前 scrub 敏感信息（regex 匹配 API key 模式） |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Agent 执行 Celery 任务时前端无进度反馈 | 用户等 30 秒以上不知道发生了什么，误以为卡死 | SSE `tool_call` 事件后立即显示 Skill 执行卡片（名称 + 预估时间 + 进度条），利用 `estimated_duration` 字段 |
| QueryEngine token 超限直接中断对话 | 用户正在创作中突然被切断，工作丢失 | 快到限额时提前警告（"剩余 Token 不足，建议保存当前进度"），给用户选择继续或停止 |
| 写操作执行后无撤销入口 | Agent 误操作删除内容，用户无法恢复 | 写操作后在 chat 中显示 "撤销" 按钮，关联 ShotVersion/undo 记录 |
| SubAgent 长时间执行时 chat 无任何响应 | 用户以为 Agent 卡死，反复发消息造成重复执行 | SubAgent 执行期间持续发送 heartbeat + 进度 SSE 事件，前端显示 "子任务执行中..." |
| 30+ Skills 全部列在 tool call 日志中 | 用户被大量技术细节淹没 | 只展示与用户请求直接相关的 tool calls，技术细节折叠在 "详情" 中 |
| Admin 禁用 Skill 后用户无感知 | 用户请求触发被禁用的 Skill，Agent 报错但用户不理解原因 | Agent 在尝试调用被禁用 Skill 时返回人类可读的禁用原因，而非技术错误信息 |

## "Looks Done But Isn't" Checklist

- [ ] **AI 调用收敛:** 检查 `rg "settings.GEMINI_API_KEY\|settings.OPENAI_API_KEY\|settings.DEEPSEEK_API_KEY" --type py` 是否只剩 `config.py` 定义和 `provider_manager.py` 的 env fallback——其他位置直接读取说明收敛未完成
- [ ] **QueryEngine token 预算:** 确认 `UsageLimits` 在 `agent.iter()` 调用时传入，且 `UsageLimitExceeded` 异常被捕获并转为 SSE error event——不要假设 PydanticAI 会静默处理
- [ ] **ArtifactStore 写入幂等性:** 用相同 `task_id` 重复调用 Celery task（simulate retry），验证 ArtifactStore 中不会产生重复记录
- [ ] **SkillDescriptor 兼容性:** 运行 `register_all_skills()` 后 `skill_registry.skill_count >= 14`，且所有旧 tool name 仍然可通过 `_build_tool_map()` 解析
- [ ] **双入口 API 健康:** 前端所有 `ai_generate` 和 `images` API 调用仍然正常工作（不经过 Agent），同时这些功能也可以通过 Agent chat 触发
- [ ] **写工具 scope 隔离:** 用 A 项目的 Agent session 尝试操作 B 项目的资源，验证被拒绝
- [ ] **SSE 流不中断:** Agent 执行 3+ tool calls 的长链路场景下，SSE 连接不因心跳超时断开
- [ ] **历史会话恢复:** Skill name 变更后，旧 session 仍可加载且 Agent 正常工作（降级到无历史 > 崩溃）
- [ ] **SubAgent token 计数:** 父 + 子 Agent 的总 token 消耗正确反映在 session.total_tokens 中
- [ ] **Admin Skill 配置持久化:** 禁用 Skill → 重启所有进程 → 验证该 Skill 仍然处于禁用状态

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| AI 调用路径双栈竞争 | MEDIUM | 回退到 env-var 统一路径（`get_provider_sync`），DB 密钥链标记为 beta feature flag 禁用 |
| QueryEngine 破坏 SSE 流 | LOW | 移除 QueryEngine 中间层，回退到裸 `agent.iter()` + `UsageLimits` |
| ArtifactStore Redis 内存暴涨 | MEDIUM | 紧急设置 `result_expires=3600`，flush 过期 Celery results，ArtifactStore 改为只存 DB 引用 |
| SkillDescriptor 变更导致注册失败 | LOW | 所有新字段加 default value，重启恢复。历史消息兼容通过 alias 映射表修复 |
| 直接 API 路径中断 | HIGH | 恢复旧 service 方法的直接调用路径，Skill handler 改为 wrapper 而非替代 |
| 写工具误删数据 | MEDIUM | soft delete 可直接恢复；ShotVersion 回滚；无版本记录的实体需从 DB backup 恢复 |
| SubAgent token 失控 | LOW | 设置硬性 `total_tokens_limit` 上限，超限后 `UsageLimitExceeded` 中断 |
| Admin 配置漂移 | LOW | 重启所有进程，DB 配置作为 truth source 重新加载 |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| AI 调用路径双栈竞争 | Phase 1: AI 调用收敛 | `grep` 全项目确认无直接 env key 读取；同一 trace 下只有一个 key source |
| QueryEngine 破坏 SSE 流 | Phase 2: QueryEngine | 自动化测试：agent 执行 5+ tool calls 场景 SSE 连接不断、token 计数正确 |
| ArtifactStore 存储竞争 | Phase 3: ArtifactStore | Redis `DBSIZE` 在 100 次 Skill 执行后增量 < 1MB；ArtifactStore 记录数 == Skill 执行数 |
| SkillDescriptor 注册失败 | Phase 4: SkillDescriptor 增强 | `register_all_skills()` 后 count >= 14；snapshot test 锁定 tool name 列表 |
| 直接 API 路径中断 | Phase 5: 7 阶段 Skill 化 | 前端 E2E 测试覆盖所有 `ai_generate` 和 `images` API 调用 |
| 写工具不可逆变更 | Phase 6: Context Tools 写操作 | Destructive write 测试验证 confirmation gate；scope 隔离测试 |
| Admin 配置漂移 | Phase 7: Admin 技能管理 | 禁用 Skill → 重启 → 验证仍禁用；Web 和 Worker 状态一致性检查 |
| SubAgent token 穿透 | Phase 8: SubAgentTool | 父子 Agent 总 token 与 AI call log 一致；子 Agent 有独立预算上限 |

## Sources

- PydanticAI official docs: https://ai.pydantic.dev/agents/, https://ai.pydantic.dev/multi-agent-applications/, https://ai.pydantic.dev/tools-advanced/
- PydanticAI issue #640: Streaming Tool Calls (closed, completed)
- PydanticAI issue #1007: run_stream not working properly with tools in streaming mode
- PydanticAI issue #4359: Automatic tool budget reminders via ToolReturn.content
- PydanticAI issue #4791: Pre-tool-call authorization via pluggable GuardrailProvider (closed, capabilities+hooks shipped)
- PydanticAI issue #1978: Handoffs / sub-agent delegation (streaming events from child agents)
- pydantic-ai-shields (ToolGuard): https://github.com/vstorm-co/pydantic-ai-middleware
- pydantic-ai-tool-budget v0.1.1: https://pypi.org/project/pydantic-ai-tool-budget/
- Agent Skills architecture: https://pub.towardsai.net/agent-skills-part-1-why-splitting-knowledge-beats-splitting-agents-26f000b282a7
- Celery large payload best practices: MoldStud, Medium (AI generation queues at scale)
- Schema migration strategies for AI agent systems: Zylos Research 2026-02-27
- AI agent version management: Zylos Research 2026-03-06
- Skill registry testing: dev.to (60+ automated tests)
- Codebase analysis: `agent_service.py`, `skill_toolset.py`, `registry.py`, `provider_manager.py`, `agent.py` (v1 endpoint), `skill_task.py`, `context_tools.py`, `pipeline_tools.py`, `descriptor.py`, `sse_protocol.py`

---
*Pitfalls research for: Canvex v3.0 Agent System Upgrade — PydanticAI + Celery + SkillRegistry*
*Researched: 2026-04-02*
