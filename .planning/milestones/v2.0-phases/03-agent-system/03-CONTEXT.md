---
phase: "03"
name: "agent-system"
created: 2026-03-27
updated: 2026-03-28
---

# Phase 3: Agent System + Tool Calling + Pipeline Orchestration — Context

## Decisions

### D1: Tool Calling 集成方式 — 采用 PydanticAI 框架

- **决定**：使用 PydanticAI 作为 Agent 层基座，不自研 tool calling 适配器
- **理由**：
  - 与项目技术栈（FastAPI + Pydantic + async）原生契合，同一团队出品
  - 内置 Provider 支持：OpenAI、Gemini、xAI/Grok、DeepSeek（OpenAI 兼容）
  - Tool calling、structured output、streaming 开箱即用
  - `agent.iter()` 暴露执行节点，便于实时推送 Agent 思考过程
  - FastAPI 集成有 `UIAdapter`，支持 AG-UI Protocol / Vercel AI Data Stream
- **影响**：
  - 不再需要自研 `ToolCall/ToolResult` 数据模型和 `generate_with_tools()` 适配器
  - 现有 15 个 Skills 包装为 PydanticAI tools
  - Provider 层可沿用 PydanticAI 内置的 provider system（OpenAI/Gemini/xAI）

### D2: Provider SDK 策略 — 尽量使用原生 SDK

- **决定**：各 Provider 使用其原生 SDK，不强制走 OpenAI 兼容层
- **映射**：
  - OpenAI → `openai` SDK（PydanticAI 内置 `OpenAIModel`）
  - DeepSeek → OpenAI 兼容（PydanticAI `OpenAIModel` + custom base_url）
  - Gemini → `google.genai` SDK（PydanticAI 内置 `GeminiModel`）
  - Grok/xAI → `xai-sdk`（PydanticAI 内置 `XaiModel` + `XaiProvider`）
- **理由**：原生 SDK 能更好地利用各 Provider 的特性（如 Gemini 多模态、xAI 原生能力）

### D3: Agent 执行范式 — ReAct 为主 + Programmatic Hand-off 为辅

- **决定**：分层组合，不单一绑定一种范式
- **层级**：
  1. **ReAct（核心，Phase 03 落地）**：Chat Sidebar 对话、单步 AI 生成，LLM 自主决定调用哪些 Skill
  2. **Programmatic Hand-off（Pipeline，Phase 03 落地）**：多步确定性流程（剧本→角色→场景→分镜），代码控制编排顺序，每步可暂停/编辑/重试
  3. **Graph-Based（延后到 Phase 05）**：Canvas 全链路执行对接 `pydantic-graph`，用户可视化编排→图执行
- **理由**：ReAct + 程序式交接已覆盖 Phase 03 全部需求，Graph-Based 过早引入增加复杂度

### D4: Agent 会话模型 — 持久化 + 两级作用域 + 简单截断

- **决定**：会话（session + messages）持久化到数据库，支持多轮上下文记忆
- **数据模型**：
  - `AgentSession`：`project_id`（必填）+ `canvas_id`（可空）+ `user_id` + `title` + `model_name` + `status`
  - `AgentMessage`：`session_id` + `role`（user/assistant/tool-call/tool-result）+ `content` + `tool_calls_json` + `token_usage`
- **作用域（两级）**：
  - **Project 级**：`canvas_id=NULL`，在项目概览页使用，Agent 拥有项目全局上下文
  - **Canvas 级**：绑定 `canvas_id`（对应某剧集），Agent 拥有该剧集的角色/场景/分镜等上下文
- **上下文恢复**：使用 PydanticAI 的 `message_history` 参数，消息以 `all_messages_json()` 格式存储，恢复时 `ModelMessagesTypeAdapter.validate_json()` 反序列化
- **上下文窗口管理**：Phase 03 先用简单截断（保留最近 N 条），预留扩展接口供后续实现摘要压缩、RAG 等策略
- **多会话**：同一 Canvas/Project 可有多个会话（不同对话主题），同一时间一个 active session

### D5: 实时进度推送 — SSE + agent.iter()

- **决定**：使用 SSE（Server-Sent Events）推送 Agent 执行过程，不用 WebSocket
- **理由**：
  - Agent 对话是"请求-响应"模式（用户 POST → 服务端流式回复），单向推送即够
  - SSE 无状态，断线重连简单，不需要维护连接池/心跳
  - FastAPI `StreamingResponse` 原生支持，无需额外库
  - PydanticAI `agent.iter()` 逐节点产出，天然匹配 SSE `yield` 模式
  - WebSocket 双向能力在此场景用不上，且状态管理复杂（连接池、sticky session、负载均衡）
- **事件类型**：
  - `thinking` — Agent 正在思考（ModelRequestNode）
  - `tool_call` — Agent 调用工具（CallToolsNode，附带工具名和参数）
  - `tool_result` — 工具返回结果
  - `token` — 文本流式输出（逐 token）
  - `done` — 回复完成，附带最终结果
- **端点设计**：`POST /api/v1/agent/chat/{session_id}`，返回 `text/event-stream`

### D6: Pipeline 编排策略 — 混合模式（Pipeline Tool + 单步 Tool）

- **决定**：采用混合模式，Pipeline 封装为 Tool 供 Agent 调用
- **设计**：
  - **Pipeline Tool**：完整流程（如"一键生成剧集"）封装为确定性代码编排，以 Tool 形式注册给 Agent
  - **单步 Tool**：各 Skill（script_generate、character_extract 等）独立注册为 Tool，Agent 可直接调用
  - Agent 根据用户意图自行选择：整套流程 → 调 Pipeline Tool；单步操作 → 调具体 Skill Tool
- **Pipeline 内部特性**：
  - 固定执行顺序，确定性强
  - 每步结果持久化为 Artifact，支持暂停/恢复/重试
  - 支持 `steps` 参数选择性执行部分步骤
  - 通过 SSE 推送每步进度
- **理由**：
  - 常见流程走 Pipeline → 可靠 + 省 token（不需 LLM 做编排决策）
  - 灵活请求走单步 Tool → 自然语言灵活
  - 未来可扩展更多 Pipeline 模板

### D7: Chat Sidebar 交互设计 — 点击呼出 + Cursor 风格进度展示

- **决定**：侧边栏点击按钮呼出，执行过程参考 Cursor/Claude 风格
- **展示规则**：
  - `thinking` 事件 → 模糊表述："正在分析你的需求…" "正在规划接下来的步骤…"（不暴露内部推理）
  - `tool_call` 事件 → 具体动作："正在创建剧本节点…" "正在提取角色信息…"
  - `tool_result` 事件 → 结果摘要："✅ 剧本已生成（1200字）" "✅ 发现3个角色"
  - `token` 事件 → 最终回复流式文字输出
- **交互**：
  - 侧边栏出现在工作区右侧，点击按钮展开/收起
  - 支持 Project 级（概览页）和 Canvas 级（剧集页）两个入口
  - 会话列表 + 当前对话，可切换历史会话

### D8: Skill 架构 — Agent Skills 开放标准（SKILL.md）+ 渐进加载 + 多协议输出

- **决定**：采用 [Agent Skills 开放标准](https://agentskills.io)（Anthropic 推出，Claude Code / Cursor 等已采纳）作为 Skill 定义格式
- **目录结构**（每个 Skill 一个文件夹）：
  ```
  skills/
  └── screenplay-conversion/
      ├── SKILL.md                  # 必需：frontmatter（name/description/metadata）+ 使用说明
      ├── references/
      │   └── prompt.zh.txt         # 详细 prompt 模板（从原项目 prompt_seeds 迁移）
      ├── assets/
      │   └── output-schema.json    # 输出格式定义（从原项目 schemas 迁移）
      └── scripts/
          └── handler.py            # 仅特殊 Skill 需要自定义逻辑时使用
  ```
- **渐进加载三层**（符合 Agent Skills 规范的 progressive disclosure）：
  1. **元数据**（~100 tokens/skill）：启动时加载所有 SKILL.md 的 frontmatter（name + description）→ 注册到 SkillRegistry
  2. **指令**（<5000 tokens）：激活时加载 SKILL.md body（使用说明、输入参数、执行流程）
  3. **资源文件**（按需）：执行时才加载 prompt.txt、schema.json、handler.py
- **运行时集成**：
  - 启动时扫描 skills/ 目录 → 解析 SKILL.md → 注册到 SkillRegistry
  - 大部分 LLM Skill 走通用执行器（加载 prompt → 填变量 → 调 LLM → 按 schema 校验）
  - 少数特殊 Skill（图片生成、视频处理）走 scripts/handler.py 自定义逻辑
  - PydanticAI tools 从 SkillRegistry 动态生成，不用 `@agent.tool` 硬编码
- **多协议输出**（SkillDescriptor 作为内部桥梁）：
  - `to_tool_definition()` → OpenAI function calling / PydanticAI（内部 Agent 调用）
  - `to_mcp_tool()` → MCP 协议（外部 Agent 调用，开放平台）
  - `to_openapi_operation()` → OpenAPI spec（REST API 开放）
- **跨平台兼容**：
  - 遵循 Agent Skills 标准，skills 目录可直接被 Claude Code / Cursor 等工具发现和使用
  - 未来用户/第三方可通过提交 SKILL.md 文件夹贡献新 Skill
- **前置任务（Phase 03 之前）**：
  - 将当前 Python 硬编码 Skills 重构为 SKILL.md 目录结构
  - 从原项目 `prompt_seeds/` 迁移 prompt 文件（97个 .txt）和 schema 文件（31个 .json）到对应 Skill 目录
  - 实现 SKILL.md 加载器 + 通用 Skill 执行器
- **理由**：
  - Agent Skills 是被多个 AI 工具采纳的开放标准，天然跨平台
  - SKILL.md 格式人类可读、AI 可发现，比纯 Python dataclass 更适合渐进加载
  - 原项目 97 个 prompt + 31 个 schema 可直接迁移为 references/ 和 assets/
  - 开放平台场景下外部 Agent 可通过标准协议发现和调用 Skill

## Discretion Areas

_Areas where the executor can use judgment_

- PydanticAI 版本选择：使用最新稳定版，executor 可自行决定
- 声明式 Skill 的存储位置：文件系统 vs 数据库，Phase 03 可先用文件系统，后续迁移到 DB
- Provider 回退策略：team-scoped → global → env 的 3 层回退机制如何与 PydanticAI provider 对接
- prompt_seeds 迁移粒度：是否全部 97 个 prompt 一次迁移，还是按使用频率分批

## Deferred Ideas

- Graph-Based 编排（pydantic-graph）→ Phase 05 Canvas polish
- Agent Delegation 模式（导演 Agent 统筹多个专业 Agent）→ 后续迭代
- Agent 自主多步规划（Planning Agent）→ 成熟度验证后再引入
- Skill 开放平台（MCP Server + OpenAPI 暴露 skills 目录）→ 后续里程碑
- 用户自定义 Skill（前端 UI 创建/编辑 SKILL.md + prompt + schema）→ 后续里程碑
- Skill 市场（第三方提交 SKILL.md 文件夹，审核后上架）→ 远期规划
