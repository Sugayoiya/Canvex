# Phase 10: Quota & Pricing & Provider Management UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 10-quota-pricing-provider-management-ui
**Areas discussed:** 配额目标选择器, 配额展示与编辑, 定价表 CRUD, Provider 密钥管理, 空状态设计, Provider 状态指示, API 客户端扩展, 跨页面一致性

---

## 配额目标选择器

### 页面布局方式

| Option | Description | Selected |
|--------|-------------|----------|
| 双 Tab 切换（Users \| Teams） | 顶部 Tab 切换用户/团队视图，每个 Tab 下有独立的搜索框和结果列表 | ✓ |
| 搜索选择框 | 顶部一个搜索框（可切换用户/团队），搜索后选择目标，下方展示详情 | |
| 统一目录表 | 类似 Users 页面的列表，每行显示用户/团队 + 当前配额摘要 | |

**User's choice:** 双 Tab 切换
**Notes:** 用户/团队配额结构不同，分开展示更清晰

### 搜索交互方式

| Option | Description | Selected |
|--------|-------------|----------|
| 实时搜索（300ms debounce） | 与 Users 页一致，输入即搜 | ✓ |
| 显式搜索（按回车触发） | 减少 API 调用 | |

**User's choice:** 实时搜索（300ms debounce）
**Notes:** 保持与 Phase 09 一致的交互模式

### Tab 内列表风格

| Option | Description | Selected |
|--------|-------------|----------|
| 简洁列表 | 每行：名称 + 邮箱/成员数 + 配额摘要 | ✓ |
| 完整表格 | 复用 AdminDataTable，完整表格风格 | |
| 卡片列表 | 每个用户/团队一张卡片 | |

**User's choice:** 简洁列表
**Notes:** 信息密度适中，一眼能看到配额状态

### 配额编辑交互

| Option | Description | Selected |
|--------|-------------|----------|
| 展开行 | 点击行在下方展开配额详情 + 编辑表单，一次只展开一行 | ✓ |
| 侧边栏 | 点击后右侧滑出配额详情面板 | |
| 弹窗表单 | 点击后弹出配额编辑弹窗 | |

**User's choice:** 展开行

### 未设置配额展示

| Option | Description | Selected |
|--------|-------------|----------|
| "Unlimited" 标签 | 表示无限制，点击可设置限制 | ✓ |
| "Not Set" 标签 | 明确表示还未配置 | |

**User's choice:** "Unlimited" 标签

---

## 配额展示与编辑

### 用量 vs 上限可视化

| Option | Description | Selected |
|--------|-------------|----------|
| 进度条 + 数字 | 每个配额维度一个进度条（绿/黄/红）+ 右侧数字 | ✓ |
| 纯数字显示 | "Used: 42 / Limit: 100" | |
| 仪表盘 | 环形进度图 | |

**User's choice:** 进度条 + 数字
**Notes:** 直观看到配额紧张度

### 编辑交互流程

| Option | Description | Selected |
|--------|-------------|----------|
| 展开区内直接编辑 | 配额数字旁就是输入框，修改后点 Save | ✓ |
| 先查看再编辑 | 默认只读，点 Edit 按钮切换 | |

**User's choice:** 展开区内直接编辑
**Notes:** 最少操作步骤

### 保存确认

| Option | Description | Selected |
|--------|-------------|----------|
| 不需要确认 | 点 Save 直接提交，toast 反馈 | ✓ |
| 确认弹窗 | 显示旧值→新值对比 | |

**User's choice:** 不需要确认
**Notes:** 配额修改可随时再改，不是破坏性操作

### Reset 快捷操作

| Option | Description | Selected |
|--------|-------------|----------|
| 是 | 每个配额字段旁加 Reset 按钮，一键清除限制 | ✓ |
| 否 | 管理员手动清空输入框 | |

**User's choice:** 是

### 进度条颜色阈值

| Option | Description | Selected |
|--------|-------------|----------|
| 三级：绿→黄→红 | 绿 (0-60%) → 黄 (60-85%) → 红 (85-100%) | ✓ |
| 两级：绿→红 | 绿 (0-80%) → 红 (80-100%) | |

**User's choice:** 三级

---

## 定价表 CRUD

### 创建/编辑方式

| Option | Description | Selected |
|--------|-------------|----------|
| Modal 表单 | 弹窗表单，包含所有定价字段 | ✓ |
| 行内编辑 | 表格内直接编辑 | |
| 侧边栏 | 右侧滑出编辑面板 | |

**User's choice:** Modal 表单
**Notes:** 定价字段多，弹窗空间充足

### 表格列

| Option | Description | Selected |
|--------|-------------|----------|
| 核心 6 列 | Provider、Model、Model Type、Price（智能合并）、Status、Actions | ✓ |
| 详细 8+ 列 | 更全但较宽 | |

**User's choice:** 核心 6 列
**Notes:** 用户询问了 type 字段含义后选择。model_type 是模型类型（llm/image/video），pricing_model 是计价模式（per_token/per_image 等），Price 列根据 pricing_model 智能显示对应价格。

### 停用操作

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle 开关 | 行操作菜单中 Deactivate/Activate + 确认弹窗 | ✓ |
| 仅删除 | 只能删除 | |
| Status Badge + Edit | 通过编辑表单修改 | |

**User's choice:** Toggle 开关

### 筛选

| Option | Description | Selected |
|--------|-------------|----------|
| 按 Status 筛选 | All / Active / Inactive | ✓ |
| 按 Provider + Status 双筛选 | 更精确 | |
| 无筛选 | 数据量不多 | |

**User's choice:** 按 Status 筛选

### 创建表单字段行为

| Option | Description | Selected |
|--------|-------------|----------|
| 动态字段 | 选择 pricing_model 后自动显示对应价格字段 | ✓ |
| 所有字段全显示 | 用户自行填写 | |

**User's choice:** 动态字段
**Notes:** 避免用户困惑

---

## Provider 密钥管理

### 页面布局

| Option | Description | Selected |
|--------|-------------|----------|
| 卡片列表 | 每个 Provider 一张卡片 | ✓ |
| 表格列表 | 复用 AdminDataTable | |

**User's choice:** 卡片列表
**Notes:** Provider 数量不多（4-6个），卡片更适合

### API Key 显示方式

| Option | Description | Selected |
|--------|-------------|----------|
| 遮蔽后 4 位 | "sk-****7a3b" + label + 创建时间 | ✓ |
| 遮蔽前 4 位 | "sk-1a****" | |
| 完全遮蔽 | "••••••••" 只显示 label | |

**User's choice:** 遮蔽后 4 位

### Key 管理交互

| Option | Description | Selected |
|--------|-------------|----------|
| 展开区内管理 | 卡片展开后显示 Key 列表 + 底部输入框 | ✓ |
| 独立弹窗 | 点击 Manage Keys 打开弹窗 | |

**User's choice:** 展开区内管理

### Provider 创建/编辑

| Option | Description | Selected |
|--------|-------------|----------|
| Modal 表单 | 弹窗填写 provider_name、display_name 等 | ✓ |
| 卡片内编辑 | 卡片内切换编辑模式 | |

**User's choice:** Modal 表单

### 删除 Provider 安全措施

| Option | Description | Selected |
|--------|-------------|----------|
| 确认弹窗 + 警告 | 显示 "删除后关联的 Key 将一并删除"，红色确认按钮 | ✓ |
| 输入确认 | 要求输入 Provider 名称确认 | |
| 简单确认弹窗 | "确定删除？" | |

**User's choice:** 确认弹窗 + 警告

### 添加 Key 流程

| Option | Description | Selected |
|--------|-------------|----------|
| 展开区内输入框 | Key 列表下方显示输入框 + 可选 label | ✓ |
| 弹窗输入 | 点击 Add Key 打开小弹窗 | |

**User's choice:** 展开区内输入框

---

## 补充议题

### 空状态设计

| Option | Description | Selected |
|--------|-------------|----------|
| 图标 + 描述 + CTA 按钮 | 与 placeholder 风格一致，换成实际 CTA | ✓ |
| 纯文字提示 | "No pricing rules found" + 链接 | |

**User's choice:** 图标 + 描述 + CTA 按钮

### Provider 状态指示

| Option | Description | Selected |
|--------|-------------|----------|
| Key 数量 + is_active | "2 keys • Active" | ✓ |
| 健康检查 | 实时检测可用性（需新端点） | |
| 最后使用时间 | 上次 API 调用时间 | |

**User's choice:** Key 数量 + is_active
**Notes:** 利用后端已有信息，不需要额外 API

### API 客户端扩展

| Option | Description | Selected |
|--------|-------------|----------|
| 放在现有 billingApi 内 | billingApi.createPricing() / .updatePricing() / .deletePricing() | ✓ |
| 新建 pricingApi 命名空间 | pricingApi.create() / .update() / .delete() | |

**User's choice:** 放在现有 billingApi 内

### 跨页面一致性

| Option | Description | Selected |
|--------|-------------|----------|
| 各页独立设计 | 三个页面根据内容类型自由布局 | ✓ |
| 统一页头模式 | 每页顶部统一标题 + 副标题 + 操作按钮 | |

**User's choice:** 各页独立设计

---

## Claude's Discretion

- 配额展开区的具体布局
- Pricing Modal 表单的字段分组和排列
- Provider 卡片的具体样式
- 各页面 loading skeleton 的具体实现
- 错误状态处理方式
- Tab 组件样式

## Deferred Ideas

None — discussion stayed within phase scope
