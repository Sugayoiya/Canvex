# Phase 08: Admin Frontend Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 08-admin-frontend-shell
**Areas discussed:** Admin Layout & Shell Structure, Admin Route Organization, API Client Namespaces, Main Sidebar Admin Entry

---

## Admin Layout & Shell Structure

### AdminShell 与 AppShell 的关系

| Option | Description | Selected |
|--------|-------------|----------|
| 完全独立的 AdminShell | 新建 AdminShell + AdminSidebar，与 AppShell 完全分离。视觉风格一致（--ob-*），布局组件独立 | ✓ |
| 共享外壳，替换 Sidebar | 复用 AppShell 的 Topbar 和整体结构，只把 Sidebar 替换为 AdminSidebar | |
| AppShell 参数化 | 给 AppShell 传入不同的 sidebar 配置，admin 模式下渲染不同导航项 | |

**User's choice:** 完全独立的 AdminShell
**Notes:** Admin 和普通用户的导航结构差异大，独立实现更清晰，也方便 code splitting。

### AdminSidebar 交互

| Option | Description | Selected |
|--------|-------------|----------|
| 固定展开 | 始终完整展开显示图标+文字 | ✓ |
| 可折叠（图标模式） | 支持折叠为只显示图标的窄侧边栏 | |
| Claude 决定 | 交给 Claude 根据实际页面数量判断 | |

**User's choice:** 固定展开
**Notes:** Admin 导航项只有 7-8 个，固定展开最清晰。

### "Back to App" 交互方式

| Option | Description | Selected |
|--------|-------------|----------|
| 侧边栏底部固定链接 | "Back to App" 放在 AdminSidebar 最底部 | |
| Topbar 内的返回按钮 | 在 AdminShell 的 Topbar 左上角放返回箭头 + "Back to App" | ✓ |
| 两者都有 | Topbar 有小返回箭头，侧边栏底部也有链接 | |

**User's choice:** Topbar 内的返回按钮
**Notes:** 侧边栏只放导航项，返回操作放在 Topbar 更符合层级关系。

---

## Admin Route Organization

### 路由文件结构

| Option | Description | Selected |
|--------|-------------|----------|
| app/admin/layout.tsx + 子页面 | 直接在 app/admin/ 下建 layout.tsx，子页面如 app/admin/users/page.tsx | |
| Route Group app/(admin)/admin/ | 用 (admin) route group 包一层，layout 与主应用完全隔离 | |
| Claude 决定 | 根据 Next.js 16 最佳实践自行选择 | ✓ |

**User's choice:** Claude 决定
**Notes:** 无强偏好。

### 子页面初始内容

| Option | Description | Selected |
|--------|-------------|----------|
| 全部创建 placeholder 页面 | 每个子路由都建 page.tsx，内容是标题 + 空状态提示 | ✓ |
| 只建 dashboard 入口页 | 只创建 /admin/dashboard/page.tsx，其余等后续 Phase | |
| Claude 决定 | 根据实现需要自行判断 | |

**User's choice:** 全部创建 placeholder 页面
**Notes:** 代码量极小但验证价值大，确保侧边栏路由和 layout 集成完整。

### Code splitting 策略

| Option | Description | Selected |
|--------|-------------|----------|
| Next.js dynamic import | 在 admin/layout.tsx 中用 next/dynamic 懒加载 AdminShell | |
| 依赖 App Router 自动 code split | Next.js App Router 按路由自动 code split，不需额外处理 | ✓ |
| Claude 决定 | 根据实际情况权衡 | |

**User's choice:** 依赖 App Router 自动 code split
**Notes:** App Router 天然按路由 code split，额外 dynamic import 增加复杂性无实际收益。

---

## API Client Namespaces

### 命名空间组织

| Option | Description | Selected |
|--------|-------------|----------|
| 集中式 adminApi | 所有 admin 相关方法集中在一个 adminApi 命名空间 | |
| 按后端路由拆分 | adminApi + quotaApi + 复用 billingApi + 复用 aiProvidersApi | |
| REQ-18 双命名空间 | adminApi（用户管理+团队+dashboard）+ quotaApi（配额），复用现有 billingApi/aiProvidersApi | ✓ |

**User's choice:** REQ-18 双命名空间
**Notes:** 严格对齐 REQ-18 要求，避免重复搬运已有方法。

### 方法签名定义时机

| Option | Description | Selected |
|--------|-------------|----------|
| 全部定义 | Phase 08 即全部定义好所有方法签名 | ✓ |
| 只定义骨架 | 只创建命名空间结构 + 1-2 个示例方法 | |
| Claude 决定 | 根据工作量权衡 | |

**User's choice:** 全部定义
**Notes:** 方法签名代码量很小，一次性定义完避免后续反复编辑 api.ts。

---

## Main Sidebar Admin Entry

### 入口位置

| Option | Description | Selected |
|--------|-------------|----------|
| 底部，Billing 下方 | 紧跟 BOTTOM_ITEMS，最后一个底部导航项 | |
| 底部 + 分隔线 | 底部但用细分隔线与普通 BOTTOM_ITEMS 区分 | ✓ |
| 顶部主导航区域 | NAV_ITEMS 最后一项（AI Console 下方） | |
| Claude 决定 | 根据视觉效果自行判断 | |

**User's choice:** 底部 + 分隔线
**Notes:** 分隔线明确标识"管理员专属"，不占用主导航区域。

### 视觉样式

| Option | Description | Selected |
|--------|-------------|----------|
| 与其他导航项一致 | 相同图标+文字样式，只条件渲染 | ✓ |
| 带强调色标识 | 使用 --ob-primary 或 --ob-warning 色调突出 | |
| Claude 决定 | 根据 Obsidian Lens 设计语言自行判断 | |

**User's choice:** 与其他导航项一致
**Notes:** 分隔线已起到区分作用，不需要额外强调色打破视觉一致性。

---

## Claude's Discretion

- 路由文件结构选择（直接 `app/admin/` 或 route group）
- AdminShell Topbar 布局细节
- AdminSidebar 图标选择
- Placeholder 页面空状态文案和视觉
- sonner Toaster 的 Obsidian Lens 主题配置

## Deferred Ideas

None — discussion stayed within phase scope.
