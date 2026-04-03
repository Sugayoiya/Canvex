# Phase 14: ArtifactStore + ToolInterceptor - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

会话级产物自动存储/注入，替代内联大 JSON 传递和硬编码参数链。ToolInterceptor 在 @tool 调用前后自动处理依赖注入和产物持久化。长运行 AI 工具（generate_image, generate_video）卸载到 Celery 异步队列。Pipeline 数据流通过 ArtifactStore 引用传递替代旧硬编码。

**不在此 Phase 范围内：**
- QueryEngine + Token 预算/成本跟踪（Phase 15）
- Admin Skill 管理页面及 Artifact 可视化统计（Phase 16）
- 多租户 per-team per-provider 实时 QPS 限速（后续里程碑）
- 动态 rate_limit Admin 面板（Phase 15/16）
- Canvas 节点执行路径不受影响——Canvas 生成按钮直接调 Provider，不走 Skill 系统

</domain>

<decisions>
## Implementation Decisions

### ArtifactStore 数据模型
- **D-01:** 新建 `agent_artifacts` 表，UUID 主键 + 追加模式——每次工具执行生成新行，查询时通过 session_id + skill_kind 取最新一条（类似 OpenStoryline 模式）
- **D-02:** 存储格式采用摘要+引用分离——`summary` (TEXT, ≤500 chars) 存 LLM 可见的精简版，`payload` (JSONB) 存完整结构化数据。注入下游时传 payload，返回 LLM 时传 summary
- **D-03:** 生命周期永久保留，与 AgentSession 同生命周期
- **D-04:** 双关联模式——`session_id` FK 指向 `agent_sessions`，可选 `execution_log_id` FK 指向 `skill_execution_logs`（Celery 执行的任务可关联执行日志）
- **D-05:** 仅会话内作用域，不支持跨会话引用（每次会话独立）
- **D-06:** 同一 session + skill_kind 多次执行全部保留（追加写入），查询时取最新一条，旧记录当历史

### ToolInterceptor 注入机制
- **D-07:** 采用 StructuredTool 包装层——每个 @tool 用 wrapper 函数包裹，wrapper 内部执行 before/after 钩子。不依赖 LangChain 内部 API，控制最精确（参考 OpenStoryline 的 MCP Interceptor 模式，适配 LangChain @tool）
- **D-08:** LLM 看到的返回值格式为 摘要 + artifact_id——LLM 看到简短摘要文本和引用 ID。不需要 read_artifact 工具，因为 before-hook 已自动注入完整数据
- **D-09:** 缺失依赖处理采用递归补跑——当工具的 require_prior_kind 依赖在 ArtifactStore 中不存在时，自动执行缺失的前置技能，递归深度最多 3 层，超过报错
- **D-10:** 全部 17 个 @tool 统一包装——无产物的工具 after-hook 跳过存储即可，保持一致性
- **D-11:** 不需要并发控制——LangChain Agent 单线程顺序执行工具，跨会话天然按 session_id 隔离
- **D-12:** 递归补跑失败时的处理由 Agent 决定（推荐：中断调用链，返回错误信息告诉 LLM 前置步骤失败）

### Celery 长任务对接
- **D-13:** 新建专用 @task（不复用旧 SkillRegistry 的 run_skill_task）——旧 handler 已全部废弃，新 task 直接调用 ImageGenerationService / VideoService
- **D-14:** 所有调用外部 AI API 的工具走 Celery（当前为 generate_image + generate_video，架构支持扩展——通过 SkillDescriptor.execution_mode / celery_queue 标记）
- **D-15:** 轮询策略为工具内轮询——@tool 内部 apply_async() 后循环 AsyncResult.get(timeout=5)，对 LLM 完全透明（同步调用体验）。指数退避轮询（1s, 2s, 4s, 8s...）
- **D-16:** 结果存储采用双层路径——Redis result backend 用于 Celery 内部结果传递（@tool 取回），ToolInterceptor after-hook 再存入 ArtifactStore（PostgreSQL 持久化）
- **D-17:** 重试配置 max_retries=2 + 指数退避（30s → 60s），第 3 次失败则报错
- **D-18:** 超时可配置——读 SkillDescriptor.timeout（Phase 13 已标注），运行时按 provider/model 可覆盖。后备值：图片 120s，视频 300s
- **D-19:** 确认策略 acks_late=True——任务完成后才确认，worker 崩溃任务自动重新派发
- **D-20:** 并发控制按 provider 配置——通过 Celery rate_limit 或 per-queue worker 配置控制，具体值从 DB 可配置
- **D-21:** 任务执行复用 SkillExecutionLog 记录——新 Celery task 也写入现有日志表，保持监控一致性
- **D-22:** 队列策略按任务类型分（ai_generation / media_processing），Phase 14 做可配置 rate_limit + 基础队列状态查询 API，多租户限速和 Admin 可视化延后

### Pipeline 数据流改造
- **D-23:** PIPE-01（参数对齐）由 ToolInterceptor 自然解决——按 skill_kind 注入完整 artifact payload，工具自己取需要的字段，不需要手动映射字段名
- **D-24:** PIPE-02（Celery 异步轮询）与 D-15 统一——@tool 内 apply_async + poll，对 Agent 透明
- **D-25:** PIPE-03（ArtifactStore 集成）——Pipeline 每步结果存 ArtifactStore，下一步通过 require_prior_kind 自动获取
- **D-26:** PIPE-04（SSE 步骤进度）——增强现有 on_tool_start / on_tool_end SSE 事件显示，不新建自定义事件类型
- **D-27:** PIPE-05（长任务 Celery）——新建专用 @task + 多队列 + 可配置 rate_limit（与 D-13/D-14 统一）

### 前端适配
- **D-28:** 最小改动——SSE 格式不变，前端仅调整工具返回值显示（从完整 JSON 变为摘要文本）。不需要新增前端页面或组件

### 可观测性
- **D-29:** Phase 14 做结构化日志——Interceptor 每次 before/after 记录 structured log（artifact_id、操作类型、skill_kind、耗时）
- **D-30:** Phase 16 做 Admin 可视化——Artifact 统计在 Admin Skill 管理页面展示

### Agent's Discretion
- System Prompt 调整方式（建议明确告知 LLM 数据传递已自动化）
- 迁移策略实现细节（建议渐进式，无 artifact 时 fallback 到旧行为）
- ToolInterceptor wrapper 的具体代码组织（独立模块 vs 嵌入 tools/__init__.py）
- ArtifactStore 的 summary 生成策略（截断 vs LLM 摘要 vs 模板拼接）
- 递归补跑失败时的具体错误消息格式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent 工具执行路径
- `api/app/agent/agent_service.py` — Agent 工厂，create_agent(llm, tools)，ToolInterceptor wrapper 需在此处包装 tools
- `api/app/agent/tools/__init__.py` — get_all_tools() 工具聚合 + TOOL_METADATA（Phase 13 元数据），wrapper 注入点
- `api/app/agent/tool_middleware.py` — get_tools_for_context() 元数据驱动工具过滤
- `api/app/agent/tool_context.py` — contextvars（project_id, user_id, team_id, canvas_id, episode_id），需扩展 session_id
- `api/app/agent/context_builder.py` — system prompt 构建，需更新以反映 ArtifactStore 数据流
- `api/app/api/v1/agent.py` — SSE 聊天端点，set_tool_context + astream_events + save_messages

### Agent 工具实现
- `api/app/agent/tools/ai_tools.py` — generate_image / generate_video @tool（PIPE-05 改造目标）
- `api/app/agent/tools/context_tools.py` — 上下文查询 @tool
- `api/app/agent/tools/mutation_tools.py` — 写操作 @tool（当前 LLM 手动传 JSON 参数，改造后由 Interceptor 注入）
- `api/app/agent/tools/skill_tools.py` — read_skill / read_resource @tool

### Skill 元数据系统
- `api/app/skills/descriptor.py` — SkillDescriptor（skill_kind, require_prior_kind, execution_mode, celery_queue, timeout）
- `api/app/agent/skill_loader.py` — SkillLoader + SkillMeta（YAML frontmatter 解析，Phase 13 增强的字段）
- `api/app/agent/skills/*/SKILL.md` — 10 个 SKILL.md（含 skill_kind, require_prior_kind frontmatter）

### 现有数据模型
- `api/app/models/agent_session.py` — AgentSession / AgentMessage（session_id FK 目标，langchain_messages_json 含工具结果）
- `api/app/models/skill_execution_log.py` — SkillExecutionLog（Celery 任务日志，execution_log_id FK 目标）

### Celery 基础设施
- `api/app/celery_app.py` — celery_app 定义 + 队列配置（ai_generation / media_processing / pipeline / quick）
- `api/app/tasks/skill_task.py` — 现有 run_skill_task（参考但不复用，新建专用 task）
- `api/app/tasks/health_sync.py` — Celery Beat 周期任务模式参考

### 参考实现
- `/Users/sugayoiya/Documents/github-repository/FireRed-OpenStoryline/src/open_storyline/mcp/hooks/node_interceptors.py` — OpenStoryline ToolInterceptor（inject_media_content_before + save_result_after + 递归补跑缺失依赖）
- `/Users/sugayoiya/Documents/github-repository/FireRed-OpenStoryline/src/open_storyline/nodes/node_manager.py` — NodeManager（check_excutable + kind_to_node_ids 映射）

### Requirements
- `.planning/REQUIREMENTS.md` §ArtifactStore + ToolInterceptor — ARTS-01 through ARTS-06
- `.planning/REQUIREMENTS.md` §Pipeline Fix — PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ToolContext` + `set_tool_context` / `get_tool_context` (contextvars)：可扩展 session_id，供 Interceptor 读取当前会话
- `TOOL_METADATA` dict (`tools/__init__.py`)：已有每个工具的 skill_kind / require_prior_kind / context_group / timeout，直接驱动 Interceptor 注入逻辑
- `SkillResult.artifacts` field (`descriptor.py`)：已有结构化占位，可作为 ArtifactStore 返回格式参考
- `SkillExecutionLog` model：可复用为 Celery 新 task 的日志记录
- Celery 队列配置（ai_generation / media_processing）：直接使用，不需新增队列
- `KeyRotator` + `ProviderManager`：Celery worker 内通过 ProviderManager 获取 key，KeyRotator 处理限速和健康

### Established Patterns
- LangChain @tool 函数使用 Pydantic BaseModel 作为 args_schema
- Agent astream_events(v2) 处理 on_tool_start / on_tool_end 事件
- contextvars 在 async 请求间传播上下文
- Celery task 通过 apply_async(queue=...) 提交到指定队列
- SkillDescriptor 的 execution_mode / celery_queue 字段控制执行模式

### Integration Points
- `agent_service.py` create_agent()：在传入 tools 前做 wrapper 包装
- `tools/__init__.py` get_all_tools()：wrapper 可在此处统一应用
- `api/v1/agent.py` chat 端点：set_tool_context 传入 session_id
- `agent_service.py` save_messages：可选在持久化消息前与 artifact 快照对齐（避免重复存超大 JSON）
- `ai_tools.py` generate_image / generate_video：从 asyncio.wait_for 改为 Celery apply_async + poll

</code_context>

<specifics>
## Specific Ideas

- 参考 OpenStoryline 的 ToolInterceptor 架构模式：before-hook 自动检查 require_prior_kind 并递归补跑缺失依赖，after-hook 自动存储产物。Canvex 需适配从 MCP Interceptor 到 LangChain StructuredTool wrapper
- Celery 队列设计预留多租户扩展点——task 参数带 team_id + provider_name，方便后续加 Redis Token Bucket 限速
- Celery 自然实现"超限排队"——QPS 超限的任务在队列中等待，不返回 429 给用户，体验从"失败重试"变为"等一会就好"
- 前端改动要极小——SSE 格式不变，仅工具返回值从完整 JSON 变为摘要文本

</specifics>

<deferred>
## Deferred Ideas

- 多租户 per-team per-provider 实时 QPS 限速（Redis Token Bucket + 配额分配）— 后续里程碑
- 动态 rate_limit Admin 面板（Admin 界面实时显示和调整 rate_limit）— Phase 15/16
- 跨会话 Artifact 引用（新会话复用上一次会话的产物）— 后续评估
- SSE pipeline_progress 自定义进度事件（带步骤序号/总数/名称）— Phase 15
- Admin Artifact 统计可视化 — Phase 16
- SkillRegistry 与 SkillLoader 合并为单一注册表 — Phase 14+ 评估
- Canvas 节点执行走 Agent Skill 路径（AGENT_CHAT_FOR_CANVAS flag）— v3.1

</deferred>

---

*Phase: 14-artifactstore-toolinterceptor*
*Context gathered: 2026-04-04*
