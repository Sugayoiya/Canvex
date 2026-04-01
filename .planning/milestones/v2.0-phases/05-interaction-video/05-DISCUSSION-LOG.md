# Phase 05: Canvas/Video Experience + Billing Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 05-interaction-video
**Areas discussed:** 整图执行模型, 视频合成, 节点样式重设计, 计费仪表盘, 任务监控

---

## 整图执行模型

| Option | Description | Selected |
|--------|-------------|----------|
| 一键全图执行 | 从源节点到汇节点全部自动执行 | |
| 框选多节点 + 单节点 | 框选批量执行 + 单节点执行并存 | ✓ |
| 选中子图执行 | 选中部分节点形成子图执行 | |

**User's choice:** 框选多节点批量执行 + 单节点执行
**Notes:** 继承 Phase 03.1 D-15 决策，Graph-Based 整图执行在本阶段实现

---

## 视频合成

| Option | Description | Selected |
|--------|-------------|----------|
| Canvas 生成视频后预览/下载 | 改善现有 video node 体验 | |
| 视频片段拼接时间线 | 添加时间线编辑功能 | |
| 暂不做 | 延后到后续迭代 | ✓ |

**User's choice:** 暂时不做
**Notes:** 无

---

## 节点样式重设计

用户提供了 3 张参考截图并给出详细需求：

| Option | Description | Selected |
|--------|-------------|----------|
| 保留 V4 NodeHeader | 维持现有设计 | |
| 去掉 Header，标签外置 | 标签移到框外上方，工具栏分模板+通用 | ✓ |

**User's choice:** 去掉 NodeHeader 横条，标签移到框外上方
**Notes:**
- 使用 Pencil MCP 创建了 V5 节点设计稿（pencil-new.pen, Frame 54PdO）
- 图片节点：左侧模板功能（高清/扩图/多角度/打光/重绘/擦除/抠图），右侧通用功能（九宫格/标注/裁剪/下载/放大）
- 视频节点：2x 倍速 + 下载
- 音频节点：波形可视化 + 红色播放头 + 播放控制 + 2x + 下载
- 文本节点：不变
- 用户反馈修正：1) 音频节点底部留太宽 → 减小到 180px；2) 所有工具栏与节点居中对齐
- 导出设计文件到 `.planning/phases/05-interaction-video/designs/`

---

## 计费仪表盘

| Option | Description | Selected |
|--------|-------------|----------|
| 简洁卡片式 | KPI 卡片 + 表格 | |
| 图表仪表盘 | KPI + 折线图 + 饼图 + 明细表 | ✓ |
| 按项目维度 | 以项目为主维度 | ✓ (叠加) |
| 你来决定 | Claude 自选方案 | |

**User's choice:** 图表仪表盘 + 按项目维度（两者都要）
**Notes:** 用户在选择前追问了后端状态，确认计费模型层完整（AICallLog/ModelPricing/Quota 均已实现），API 层基本可用

---

## 任务监控与运营可见性

| Option | Description | Selected |
|--------|-------------|----------|
| 任务状态列表 | 独立 Celery 任务队列列表页 | |
| 节点级执行历史 | Canvas 节点上查看历史记录 | |
| 两者都要 | 独立任务监控页 + 节点级执行历史 | ✓ |
| 仅做 readiness | 只做后端不做前端 | |
| 你来决定 | Claude 自选 | |

**User's choice:** 两者都要
**Notes:** 无

---

## Claude's Discretion

- 整图执行的拓扑排序算法和并发策略
- 图表库选择
- 任务监控刷新策略
- 框选交互 UX 细节
- 时序数据聚合粒度

## Deferred Ideas

- 视频合成/拼接 → 后续迭代
- 团队系统 API → Phase 06
- AI Provider DB 管理 → Phase 06
- OAuth → Phase 06
- 节点执行结果缓存/版本化 → 可能本阶段
- Audio skill 真实实现 → 后续迭代
