# Phase 05: Canvas/Video Experience + Billing Dashboard - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

提升 Canvas 创作者交互体验（整图执行、节点样式重设计、功能菜单重构），在前端构建计费仪表盘（图表+项目维度），并提供独立任务监控页 + 节点级执行历史。

**不含：** 视频合成/拼接、团队系统 API、AI Provider DB 管理（属 Phase 06）。

</domain>

<decisions>
## Implementation Decisions

### 整图执行模型
- **D-01:** 支持框选多节点批量执行 — 用户在 Canvas 上框选多个节点后点击执行，按拓扑排序依次执行选中子图
- **D-02:** 支持单节点执行 — 点击单个节点的执行按钮，仅执行该节点（沿用现有 `useNodeExecution` 模式）
- **D-03:** 需要后端拓扑排序 + 批量执行 API — Phase 03.1 D-15 明确将 Graph-Based 执行留给本阶段

### 视频合成 — 延后
- **D-04:** 视频合成流程暂不做 — 不做视频片段拼接/时间线编辑，留到后续迭代

### 节点样式重设计 (V5)
- **D-05:** 去掉 NodeHeader 横条 — 节点卡片内不再包含标题行，卡片顶部直接是内容区
- **D-06:** 节点类型图标+名称移至卡片框外上方 — 左对齐于节点左边缘，`icon(14px) + 类型名(12px, Space Grotesk, text.muted)`
- **D-07:** 图片节点上方功能菜单分两组：左侧模板功能（高清/扩图/多角度/打光/重绘/擦除/抠图），右侧通用功能（九宫格/标注/裁剪/下载/放大预览），中间竖线分隔
- **D-08:** 视频节点上方功能菜单：现有模板功能 + 下载 + 放大查看
- **D-09:** 文本节点不变（沿用 V4 TextToolbar）
- **D-10:** 音频节点：波形可视化 + 红色播放头 + 播放/时间控制 + 上传按钮；上方功能菜单含 2x 倍速 + 下载
- **D-11:** 所有上方功能菜单与节点卡片水平居中对齐（非左对齐）

### 计费仪表盘
- **D-12:** 采用图表仪表盘形式 — KPI 卡片（本月总花费/总调用量/总 token）+ 折线图（日/周趋势）+ 饼图（按 provider 分布）+ 明细表格
- **D-13:** 支持按项目维度 — 可切换到以项目为主维度展示每个项目的用量和成本明细
- **D-14:** 后端 API 已就绪 — `GET /billing/usage-stats/` 支持 start_date/end_date/project_id 过滤，按 provider+model 聚合；需补充按日期分组的时序数据 API
- **D-15:** 非管理员只看自己的数据，管理员可看全局

### 任务监控与运营可见性
- **D-16:** 独立任务监控页面 — Celery 任务队列列表，展示进行中/完成/失败任务，可按用户/项目筛选
- **D-17:** 节点级执行历史 — 在 Canvas 节点上直接查看该节点的历史执行记录（耗时、成本、状态）
- **D-18:** 后端数据源：`SkillExecutionLog` + `AICallLog` 已有完整的执行记录（user/project/provider/model/tokens/cost/status）

### Claude's Discretion
- 整图执行的拓扑排序算法细节和并发策略
- 计费仪表盘的具体图表库选择（echarts/recharts/chart.js 等）
- 任务监控页的轮询/SSE 刷新策略
- 框选交互的具体 UX 细节（选框颜色、选中态高亮等）
- 时序数据 API 的聚合粒度（小时/天/周）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### V5 节点设计规范
- `.planning/phases/05-interaction-video/designs/canvas-v5-node-redesign.png` — V5 节点重设计效果图（dark mode）
- `.planning/phases/05-interaction-video/designs/component-specs.md` — V5 节点组件规格（去 Header、标签外置、菜单居中、音频波形）
- `.planning/phases/05-interaction-video/designs/design-tokens.json` — 双主题色彩令牌（继承 V4）

### V4 基础设计（继承）
- `.planning/phases/04-media-tools/designs/component-specs.md` — V4 Canvas 全组件规格（AIGeneratePanel、TextToolbar、TemplateMenu 等）
- `.planning/phases/04-media-tools/designs/design-tokens.json` — 原始 design tokens

### 先前阶段决策（继承）
- `.planning/phases/03.1-agent-chat-canvas-quality-fix/03.1-CONTEXT.md` — D-14/D-15: 整图执行留给 Phase 05
- `.planning/phases/04-media-tools/04-CONTEXT.md` — 4 种 material 类型、连接规则、Quota 策略

### 后端 API 参考
- `api/app/api/v1/billing.py` — 计费 API（pricing CRUD + usage-stats 聚合）
- `api/app/api/v1/quota.py` — 配额 API（/my + 管理员操作）
- `api/app/models/ai_call_log.py` — AI 调用日志模型（user/project/provider/model/tokens/cost）
- `api/app/models/quota.py` — UserQuota/TeamQuota/QuotaUsageLog 模型
- `api/app/models/skill_execution_log.py` — 技能执行日志模型

### Canvas 系统参考
- `web/src/components/canvas/canvas-workspace.tsx` — 当前画布工作区
- `web/src/components/canvas/hooks/use-node-execution.ts` — 单节点执行 hook
- `web/src/components/canvas/hooks/use-upstream-data.ts` — 上游数据流 hook
- `web/src/components/canvas/hooks/use-node-focus.ts` — 节点聚焦 hook
- `web/src/components/canvas/panels/panel-host.tsx` — 面板宿主系统
- `web/src/lib/connection-rules.ts` — 连接规则

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useNodeExecution` hook: 单节点 invoke + poll 模式，可扩展为批量执行的基础
- `useUpstreamData` hook: 3 通道类型化数据流（text/json/imageUrl），整图执行需复用
- `useNodeFocus` + `PanelHost`: 聚焦面板系统，节点工具栏定位可复用
- `canvasApi`: 完整的 Canvas CRUD（node/edge 操作），需扩展执行 API
- `billing.py` usage-stats: 已有 provider+model 聚合 + 时间范围/项目筛选
- `SkillExecutionLog`: 已有完整执行记录，可直接作为任务监控数据源

### Established Patterns
- CSS `--cv4-*` 自定义属性用于 Canvas 主题（V5 继续沿用）
- 节点 7 态执行状态机：idle/queued/running/completed/failed/timeout/blocked
- Skill 调用走 SkillRegistry + Celery 异步路径
- 前端 React Query 做服务端状态管理 + Zustand 做客户端状态

### Integration Points
- Canvas 页面需新增框选执行 UI（ReactFlow 的 selection 事件）
- 需新增 `/billing` 前端路由（Settings 页面或独立页面）
- 需新增 `/tasks` 或在 Settings 中嵌入任务监控
- `api.ts` 需封装 billingApi + quotaApi + 任务监控 API 客户端
- 后端需新增: 批量执行 API、时序聚合 API、任务列表 API

</code_context>

<specifics>
## Specific Ideas

- 节点设计参考用户提供的 3 张截图：图片节点工具栏、视频节点工具栏、音频节点波形显示
- 图片节点工具栏左侧模板功能参考即梦 AI 的编辑工具布局（高清/扩图/多角度/打光/重绘/擦除/抠图）
- 音频节点波形显示参考常见音频播放器（红色播放头 + 灰白波形 + 时间码）
- 计费仪表盘需同时支持全局视图和按项目视图的切换

</specifics>

<deferred>
## Deferred Ideas

- 视频合成/拼接/时间线编辑 → 后续迭代
- 团队系统 HTTP API（Team CRUD、成员管理、邀请流程）→ Phase 06
- AI Provider DB 管理（团队级密钥 CRUD）→ Phase 06
- OAuth 登录（Google/GitHub）→ Phase 06
- 节点执行结果缓存/版本化（避免重复执行）→ 如果本阶段有余力可考虑
- Audio node 完整实现（真实音频生成 skill）→ 后续迭代
- 精确 quota 执行加强 → 与计费仪表盘配合评估

</deferred>

---

*Phase: 05-interaction-video*
*Context gathered: 2026-03-30*
