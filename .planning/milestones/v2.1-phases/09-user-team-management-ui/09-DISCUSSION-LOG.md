# Phase 09: User & Team Management UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 09-user-team-management-ui
**Areas discussed:** Row Actions & Status Display, Confirmation Modals, Team Overview Interaction, Search & Filter Layout, Pagination, Teams Column Data, Sorting UX, Toast Feedback, Last Admin Warning

---

## Row Actions & Status Display

### Q1: How should status/admin toggles appear in the table?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline Toggle 开关 | 每行两个小开关（状态 + 管理员），点击触发确认弹窗 | |
| Action Button 列 | 每行末尾操作列，两个按钮（Ban / Grant Admin） | |
| Row Dropdown 菜单 | 每行「...」按钮展开操作列表 | ✓ |

**User's choice:** Row Dropdown 菜单
**Notes:** 空间最省，未来加操作不用改表格列结构。

### Q2: How to display user status and admin flag?

| Option | Description | Selected |
|--------|-------------|----------|
| 彩色 Badge 标签 | 绿 Active / 红 Banned / 紫 Admin 标签 | ✓ |
| 纯文字 + 图标 | 文字 + 小圆点/Shield 图标，更克制 | |
| Claude 决定 | 视觉呈现交给 Claude | |

**User's choice:** 彩色 Badge 标签
**Notes:** 状态一目了然，直觉最强。

---

## Confirmation Modals

### Q1: What style for confirmation dialogs?

| Option | Description | Selected |
|--------|-------------|----------|
| 居中 Modal 弹窗 | 经典遮罩 + 居中卡片，危险操作红色确认按钮 | |
| Popover 气泡确认 | 操作按钮旁弹出小气泡，轻量 | |
| Claude 决定 | 根据场景选择最合适的形式 | ✓ |

**User's choice:** Claude 决定
**Notes:** 由 Claude 根据操作危险等级和信息量选择。

---

## Team Overview Interaction

### Q1: What happens when clicking a team row?

| Option | Description | Selected |
|--------|-------------|----------|
| 跳转 `/teams/[id]` | 复用现有团队详情页 | |
| 纯展示不跳转 | 团队表只做一览，不提供 drill-down | ✓ |
| 新建 Admin 团队详情页 | `/admin/teams/[id]` admin 视角详情 | |

**User's choice:** 纯展示不跳转
**Notes:** 用户关心跳转后能否快速返回。由于 `/teams/[id]` 使用 AppShell 布局，跳转会导致 AdminShell → AppShell 上下文切换割裂。选择不跳转，admin 团队详情页留给未来（REQ-F03）。

### Follow-up: 新标签页打开 vs 纯展示？

| Option | Description | Selected |
|--------|-------------|----------|
| 新标签页打开 | `target="_blank"` 打开 `/teams/[id]` | |
| 纯展示不跳转 | 完全不提供跳转 | ✓ |

**User's choice:** 纯展示不跳转

---

## Search & Filter Layout

### Q1: How to arrange search and filter controls?

| Option | Description | Selected |
|--------|-------------|----------|
| 同一行 | 左搜索框 + 右筛选下拉 | |
| 独占两行 | 搜索框满宽 + 下行筛选 chips/下拉 | |
| Claude 决定 | 根据 Obsidian Lens 风格选择 | ✓ |

**User's choice:** Claude 决定

---

## Pagination

### Q1: Pagination style?

| Option | Description | Selected |
|--------|-------------|----------|
| 传统页码导航 | 页码 + 上下页按钮 + 总数显示 | ✓ |
| Load More 按钮 | 底部追加加载 | |
| Claude 决定 | 根据场景选择 | |

**User's choice:** 传统页码导航
**Notes:** 管理后台标配，精确定位方便。

---

## Teams Column Data

### Q1: How to handle missing teams field in backend?

| Option | Description | Selected |
|--------|-------------|----------|
| 后端扩展 | Phase 09 给 `GET /admin/users` 增加 teams 字段 | ✓ |
| 前端省略 teams 列 | 暂不显示，deferred | |
| 前端聚合 | N+1 请求获取团队信息 | |

**User's choice:** 后端扩展
**Notes:** 改动量小（一个 JOIN 查询），确保 REQ-19 完整满足。

---

## Sorting UX

### Q1: Default sort and interaction?

| Option | Description | Selected |
|--------|-------------|----------|
| 单列排序，默认 created_at desc | 列头箭头切换，一次一列 | ✓ |
| 单列排序，默认 last_login_at desc | 按活跃度排序 | |
| Claude 决定 | 排序细节交给 Claude | |

**User's choice:** 单列排序，默认 created_at desc

---

## Toast Feedback

### Q1: Toast information density?

| Option | Description | Selected |
|--------|-------------|----------|
| 具体反馈 | 包含用户邮箱 + 操作结果，失败展示后端错误 | ✓ |
| 简洁反馈 | 只说 "已更新" / "失败" | |
| Claude 决定 | 文案细节交给 Claude | |

**User's choice:** 具体反馈
**Notes:** Admin 同时操作多人时不会混淆。

---

## Last Admin Warning

### Q1: When to show last-admin warning?

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown 直接禁用 | 置灰 + tooltip "Cannot revoke — last admin" | ✓ |
| 确认弹窗里警告 | 允许点击，弹窗里红色警告 + 确认按钮禁用 | |
| Claude 决定 | 呈现方式交给 Claude | |

**User's choice:** Dropdown 直接禁用
**Notes:** 从源头阻止误操作，无需进入确认弹窗。

---

## Claude's Discretion

- 确认弹窗的具体形式和样式
- 搜索与筛选的具体布局排列
- 表格空状态、加载骨架屏、错误状态的实现
- Badge 标签色值选择

## Deferred Ideas

- Admin 专属团队详情页 (`/admin/teams/[id]`) — REQ-F03
