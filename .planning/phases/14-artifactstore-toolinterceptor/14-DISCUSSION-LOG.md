# Phase 14: ArtifactStore + ToolInterceptor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 14-artifactstore-toolinterceptor
**Areas discussed:** ArtifactStore 数据模型, ToolInterceptor 注入机制, Celery 长任务对接, Pipeline 数据流改造, System Prompt, 迁移策略, 测试策略, 前端适配, 可观测性

---

## ArtifactStore 数据模型

### 主键策略

| Option | Description | Selected |
|--------|-------------|----------|
| UUID 主键 + 追加模式 | 每次执行生成新行，查询最新一条（类似 OpenStoryline） | ✓ |
| 组合键 + Upsert | (session_id, skill_kind) 组合唯一键，后执行覆盖前执行 | |

**User's choice:** UUID + 追加模式
**Notes:** 无

### Payload 存储格式

| Option | Description | Selected |
|--------|-------------|----------|
| JSONB 全量存储 | payload 存入单一 JSONB 字段 | |
| 摘要 + 引用分离 | summary (TEXT, ≤500 chars) + payload (JSONB) 分开 | ✓ |

**User's choice:** 摘要 + 引用分离
**Notes:** 无

### 生命周期

**User's choice:** 永久保留，与 AgentSession 同生命周期
**Notes:** 用户先询问了 artifact 是什么，在获得全景科普后做出选择

### 关联模型

| Option | Description | Selected |
|--------|-------------|----------|
| 仅关联 AgentSession | session_id FK，与 SkillExecutionLog 独立 | |
| 双关联 | session_id FK + 可选 execution_log_id FK | ✓ |

**User's choice:** 双关联
**Notes:** 在全景科普后选择

### 跨会话

| Option | Description | Selected |
|--------|-------------|----------|
| 仅会话内 | 每次会话独立 | ✓ |
| 支持跨会话 | 通过 project_id 查询最新 artifact | |

**User's choice:** 仅会话内

### 版本管理

| Option | Description | Selected |
|--------|-------------|----------|
| 全部保留 | 追加写入，查询取最新 | ✓ |
| 只保留最新 | 后执行覆盖前执行 | |

**User's choice:** 全部保留

---

## ToolInterceptor 注入机制

### 实现方式

| Option | Description | Selected |
|--------|-------------|----------|
| StructuredTool 包装层 | wrapper 函数包裹每个 @tool，内部做 before/after 钩子 | ✓ |
| LangChain Callback | on_tool_start/on_tool_end callback handler | |

**User's choice:** StructuredTool 包装层
**Notes:** 用户询问了 OpenStoryline 的做法。解释了 OpenStoryline 使用 MCP Interceptor，Canvex 因为不走 MCP 所以只能用 StructuredTool wrapper，思路一致但适配层不同

### LLM 返回格式

| Option | Description | Selected |
|--------|-------------|----------|
| 仅摘要 | LLM 只看到简短摘要 | |
| 摘要 + artifact_id | LLM 看到摘要 + 引用 ID | ✓ |
| 条件判断 | 小结果直接返回，大结果返回摘要 | |

**User's choice:** 摘要 + artifact_id

### 缺失依赖处理

| Option | Description | Selected |
|--------|-------------|----------|
| 递归补跑 | 自动执行缺失前置技能 | ✓ |
| 报错提示 | 返回错误信息让 LLM 自己决定 | |

**User's choice:** 递归补跑

### read_artifact 工具

| Option | Description | Selected |
|--------|-------------|----------|
| 需要 | 新增 read_artifact 工具 | |
| 不需要 | before-hook 已自动注入 | ✓ |

**User's choice:** 不需要

### 包装范围

| Option | Description | Selected |
|--------|-------------|----------|
| 全部 17 个 @tool | 统一包装 | ✓ |
| 仅有产物的工具 | 约 10 个 | |

**User's choice:** 全部 17 个

### 递归深度

| Option | Description | Selected |
|--------|-------------|----------|
| 最多 3 层 | 超过报错 | ✓ |
| 最多 5 层 | 覆盖完整 pipeline | |

**User's choice:** 最多 3 层

### 并发安全

**User's choice:** 不需要并发控制
**Notes:** 用户询问是否有并行执行工具的情况。解释了 LangChain Agent 单线程顺序执行，跨会话天然隔离

---

## Celery 长任务对接

### Task 复用

| Option | Description | Selected |
|--------|-------------|----------|
| 复用 run_skill_task | 将 AI 工具包装成 SkillRegistry 格式 | |
| 新建专用 @task | 不复用 SkillRegistry，直接调用 Service | ✓ |

**User's choice:** 新建专用 @task
**Notes:** 用户询问别的项目如何做。解释了旧 handler 已废弃，新 task 直接调 Service 更干净

### 轮询策略

| Option | Description | Selected |
|--------|-------------|----------|
| 工具内轮询 | @tool 内 apply_async + poll | ✓ |
| SSE 通知前端 | 返回 task_id，前端监听完成事件 | |

**User's choice:** 工具内轮询
**Notes:** 用户不确定，解释了两种方案对比和推荐理由

### 结果存储

| Option | Description | Selected |
|--------|-------------|----------|
| 存入 ArtifactStore | Celery task 直接写 agent_artifacts | |
| Celery result backend + Interceptor 存 ArtifactStore | 双层路径 | ✓ |

**User's choice:** Redis result backend → Interceptor 存 ArtifactStore
**Notes:** 用户询问哪种更合理不耦合，解释了职责分离原则

### Celery 范围

| Option | Description | Selected |
|--------|-------------|----------|
| 仅图片/视频 | generate_image + generate_video | |
| 所有 AI 工具 | 包含 LLM 推理工具 | ✓ |

**User's choice:** 所有调用外部 AI API 的工具
**Notes:** 用户希望所有大模型交互走 Celery。解释了当前只有 generate_image/generate_video 调外部 API，其他技能由 Agent LLM 自身执行

### 重试配置

**User's choice:** max_retries=2 + 指数退避（30s → 60s）

### 超时配置

**User's choice:** 可配置，读 SkillDescriptor.timeout，运行时按 provider/model 可覆盖
**Notes:** 用户提出需要按不同 provider 不同模型配置

### 确认策略

**User's choice:** acks_late=True

### 并发控制

**User's choice:** 按 provider 配置
**Notes:** 用户希望根据 provider 决定并发数

### 队列策略

**User's choice:** 按任务类型分队列 (ai_generation / media_processing)
**Notes:** 用户深入讨论了多租户限速场景。讨论了 KeyRotator 与 Celery 的分工，以及即梦等低 QPS Provider 的分配问题。结论：Phase 14 做基础队列 + 可配置 rate_limit，多租户限速延后

### 超限处理

**Notes:** 用户明确希望超限任务排队而非报错重试。Celery 天然提供此能力——QPS 超限的任务在队列等待，不返回 429

---

## Pipeline 数据流改造

### PIPE-01 参数对齐

**User's choice:** ToolInterceptor 自然解决
**Notes:** 用户不清楚细节，解释了旧问题（字段名不匹配）和新方案（按 skill_kind 注入完整 payload，工具自取字段）

### PIPE-02 Celery 异步轮询

**User's choice:** 与 D-15 统一，@tool 内 apply_async + poll

### PIPE-03 ArtifactStore 集成

**User's choice:** Artifact 引用传递

### PIPE-04 SSE 步骤进度

**User's choice:** 增强现有 on_tool_start / on_tool_end 事件

### PIPE-05 长任务 Celery

**User's choice:** 与 Celery 决策统一

---

## System Prompt 调整

**User's choice:** Agent 自行决定

## 迁移策略

**User's choice:** Agent 自行决定

## 测试策略

| Option | Description | Selected |
|--------|-------------|----------|
| 单元 + 集成 | ArtifactStore CRUD + ToolInterceptor 钩子 + 完整链路 | ✓ |
| E2E 为主 | 主要测试完整 Agent 会话流程 | |

**User's choice:** 单元 + 集成测试

---

## 前端适配

| Option | Description | Selected |
|--------|-------------|----------|
| 最小改动 | SSE 格式不变，仅调整返回值显示 | ✓ |
| 增加 Artifact 查看器 | 前端可点击查看完整产物 | |

**User's choice:** 最小改动

## 可观测性

| Option | Description | Selected |
|--------|-------------|----------|
| 结构化日志 | Interceptor before/after 记录 structured log | |
| Admin 页面 | Phase 16 展示 artifact 统计 | |
| 两者都要 | Phase 14 做日志，Phase 16 做可视化 | ✓ |

**User's choice:** 两者都要

---

## Agent's Discretion

- System Prompt 具体调整方式
- 迁移策略具体实现（Feature Flag vs 直接切换）
- ToolInterceptor wrapper 代码组织
- ArtifactStore summary 生成策略
- 递归补跑失败的错误消息格式

## Deferred Ideas

- 多租户 per-team per-provider 实时 QPS 限速 — 后续里程碑
- 动态 rate_limit Admin 面板 — Phase 15/16
- 跨会话 Artifact 引用 — 后续评估
- Admin Artifact 统计可视化 — Phase 16
