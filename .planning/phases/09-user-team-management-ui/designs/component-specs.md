# User & Team Management 组件规格 (Component Specs)

> 供 AI 编码时直接引用的结构化规格，配合 `design-tokens.json` 使用。
> 继承 Phase 08 设计系统，所有颜色引用格式: `tokens.themes.{dark|light}.{path}`
> 设计图参考: `admin-users-page.png`, `admin-teams-page.png`

---

## 1. 页面布局 (共用结构)

```yaml
container: AdminShell > MainContent
layout: vertical
padding: [32, 40]
gap: 24
children:
  - PageHeader
  - FilterToolbar
  - DataTable (含 Pagination)
```

焦点元素: DataTable 是两个页面的主要视觉锚点。

---

## 2. 页面标题区 (PageHeader)

```yaml
layout: horizontal, justifyContent=space_between, alignItems=end
width: fill_container
children:
  - left: vertical, gap=6
    - title: pageTitle, text.primary
    - subtitle: pageSubtitle, text.muted
  - right: 无按钮 (Phase 09 页面无 CTA)
```

### 2.1 页面文案

| 页面 | 标题 | 副标题 |
|------|------|--------|
| Users | "Users" | "Manage user accounts and permissions" |
| Teams | "Teams" | "View all teams and their members" |

---

## 3. 筛选工具栏 (FilterToolbar)

```yaml
layout: horizontal, gap=12, alignItems=center
width: fill_container
children:
  - SearchInput: flex=1
  - StatusFilter (仅 Users 页): width=140px
  - AdminFilter (仅 Users 页): width=140px
```

### 3.1 搜索框 (SearchInput)

```yaml
height: 36px
background: surface.primary
border: border.subtle (1px)
cornerRadius: 8
padding: [0, 12]
layout: horizontal, gap=8, alignItems=center
children:
  - icon: search (lucide), 14px, text.muted
  - input: searchPlaceholder, text.muted
```

**占位文案:**

| 页面 | 占位文案 |
|------|---------|
| Users | "Search by name or email..." |
| Teams | "Search by team name..." |

**交互:**
- 聚焦: border → border.focused
- 防抖: 300ms

### 3.2 筛选下拉 (FilterDropdown)

```yaml
height: 36px
width: 140px
background: surface.primary
border: border.subtle (1px)
cornerRadius: 8
padding: [0, 12]
layout: horizontal, justifyContent=space_between, alignItems=center
children:
  - text: filterLabel, text.secondary
  - icon: chevron-down (lucide), 12px, text.muted
```

**筛选项:**

| 筛选 | 选项 |
|------|------|
| Status | "All Status" (默认) · "Active" · "Banned" |
| Admin | "All Roles" (默认) · "Admin" · "Non-admin" |

**Teams 页面:** 仅搜索框，无筛选下拉。

---

## 4. 数据表 (AdminDataTable)

```yaml
width: fill_container
height: fill_container
background: surface.card
border: border.subtle (1px)
cornerRadius: 12
overflow: hidden (clip border-radius)
layout: vertical
```

### 4.1 表头 (TableHeader)

```yaml
height: 40px
background: canvas.background (#131313)
borderBottom: border.subtle (1px)
padding: [0, 16]
layout: horizontal, alignItems=center
```

**表头文字:**
```yaml
font: tableHeader (Space Grotesk 12px/700)
color: text.muted
textTransform: uppercase
letterSpacing: 1px
```

**可排序表头** (仅 Users 表):
- 图标: `arrow-up` / `arrow-down` (lucide), 12px
- 激活排序: 图标和文字 → text.primary
- 未排序: 图标 text.muted 50% opacity
- 悬停: 文字 → text.secondary

### 4.2 表行 (TableRow)

```yaml
height: 48px
padding: [0, 16]
layout: horizontal, alignItems=center
borderBottom: border.subtle (1px), 最后一行无
```

**交互:**

| 状态 | 背景 | 过渡 |
|------|------|------|
| 默认 | transparent | — |
| 悬停 | interactive.tableRowHover (#E5E2E108) | background 100ms |

### 4.3 Users 表列定义

| # | Key | 表头 | 宽度 | 内容 | 可排序 |
|---|-----|------|------|------|--------|
| 1 | name | NAME | 160px fixed | tableCellBold, text.primary | 否 |
| 2 | email | EMAIL | 200px fixed | tableCell, text.secondary | 是 (email) |
| 3 | status | STATUS | 90px fixed | StatusBadge | 否 |
| 4 | admin | ADMIN | 80px fixed | AdminBadge 或空 | 否 |
| 5 | teams | TEAMS | 100px fixed | tableCell, text.secondary | 否 |
| 6 | last_login | LAST LOGIN | 120px fixed | tableCell, text.secondary | 是 (last_login_at) |
| 7 | created | CREATED | 120px fixed | tableCell, text.secondary; 带 arrow-down 排序指示 | 是 (created_at, 默认降序) |
| 8 | actions | (无) | 48px fixed | RowDropdownMenu 触发器 | 否 |

**Teams 字段显示规则:**
- 0 个团队: "—" (text.muted)
- 1–2 个: 逗号分隔团队名
- 3+ 个: "{first}, +{N} more" + tooltip 显示全列表

### 4.4 Teams 表列定义

| # | Key | 表头 | 宽度 | 内容 | 可排序 |
|---|-----|------|------|------|--------|
| 1 | name | NAME | flex 1 | tableCellBold, text.primary | 否 |
| 2 | member_count | MEMBERS | 120px fixed | tableCell, text.secondary | 否 |
| 3 | owner | OWNER | 200px fixed | tableCell, text.secondary | 否 |
| 4 | created | CREATED | 160px fixed | tableCell, text.secondary | 否 |

Teams 表无行操作、无排序 (只读视图)。

---

## 5. 状态徽章 (StatusBadge)

```yaml
height: 24px
padding: [4, 8]
cornerRadius: 6
layout: inline-flex, alignItems=center, justifyContent=center
font: badgeLabel (Manrope 12px/700)
```

| 变体 | 背景 | 文字颜色 |
|------|------|---------|
| Active | semantic.badge.active.bg | semantic.badge.active.text |
| Banned | semantic.badge.banned.bg | semantic.badge.banned.text |

---

## 6. 管理员徽章 (AdminBadge)

```yaml
height: 24px
padding: [4, 8]
cornerRadius: 6
layout: inline-flex, alignItems=center, justifyContent=center
background: semantic.badge.admin.bg
color: semantic.badge.admin.text
font: badgeLabel (Manrope 12px/700)
label: "Admin"
```

非管理员用户: 此列为空。

---

## 7. 行操作菜单 (RowDropdownMenu)

### 7.1 触发器

```yaml
width: 48px (cell 宽度)
children:
  - button: 32×32, cornerRadius=8
    - icon: ellipsis (lucide), 16px, text.muted
    - hover: background=interactive.hoverHighlight, icon=text.secondary
    - open: background=interactive.activeHighlight, icon=text.primary
```

### 7.2 下拉面板

```yaml
position: absolute, right-aligned, portal to body
zIndex: 50
background: surface.primary
border: border.default (1px)
cornerRadius: 8
boxShadow: shadow.md (0 4px 12px #00000040)
minWidth: 200px
padding: 4px
```

### 7.3 菜单项

```yaml
height: 36px
padding: [0, 12]
cornerRadius: 6
layout: horizontal, gap=8, alignItems=center
font: dropdownItem (Manrope 12px/400)
color: text.secondary
```

**交互:**

| 状态 | 背景 | 文字 |
|------|------|------|
| 默认 | transparent | text.secondary |
| 悬停 | interactive.hoverHighlight | text.primary |
| 禁用 | transparent, opacity=0.4, cursor=not-allowed | text.secondary |

### 7.4 菜单项列表 (按用户状态)

| 用户状态 | 项 1 | 项 2 |
|----------|------|------|
| Active, 非管理员 | "Ban User" (destructive) | "Grant Admin" |
| Active, 管理员 (非最后一个) | "Ban User" (destructive) | "Revoke Admin" |
| Active, 管理员 (最后一个) | "Ban User" (destructive) | "Revoke Admin" (禁用, tooltip) |
| Banned, 非管理员 | "Enable User" | "Grant Admin" |
| Banned, 管理员 | "Enable User" | "Revoke Admin" |

**图标映射:**

| 操作 | 图标 | 颜色 |
|------|------|------|
| Ban User | `ban` | semantic.destructive.text (#FFB4AB) |
| Enable User | `circle-check` | text.secondary |
| Grant Admin | `shield` | text.secondary |
| Revoke Admin | `shield-off` | text.secondary |

**禁用 tooltip:** "Cannot revoke — last admin"

---

## 8. 确认弹窗 (ConfirmationModal)

```yaml
overlay: fixed, inset=0, background=#00000080, zIndex=100
modal: centered, width=420px, padding=24px
  background: surface.primary
  border: border.default (1px)
  cornerRadius: 12
  animation: opacity 0→1, scale 0.96→1, 150ms ease-out
```

### 8.1 弹窗头部

```yaml
layout: horizontal, gap=8, alignItems=center
children:
  - icon: contextual (见下表), 20px
  - title: modalTitle (Space Grotesk 14px/700)
```

### 8.2 弹窗正文

```yaml
marginTop: 16px
font: modalBody (Manrope 12px/400)
color: text.secondary
```

### 8.3 弹窗警告 (条件显示)

```yaml
marginTop: 16px
padding: [8, 12]
cornerRadius: 8
background: #FFB4AB10
border: 1px solid #FFB4AB20
layout: horizontal, gap=8
children:
  - icon: alert-triangle (lucide), 14px, semantic.destructive.text
  - text: modalWarning (Manrope 12px/700), semantic.destructive.text
```

### 8.4 弹窗底部

```yaml
marginTop: 24px
layout: horizontal, justifyContent=flex-end, gap=8
children:
  - cancelButton: Phase 08 secondary 按钮样式
  - confirmButton: primary 或 destructive 样式
```

### 8.5 弹窗文案表

| 操作 | 图标 | 标题 | 确认按钮 | 样式 |
|------|------|------|---------|------|
| Ban User | `ban` | "Ban User" | "Ban User" | destructive |
| Enable User | `circle-check` | "Enable User" | "Enable User" | primary |
| Grant Admin | `shield` | "Grant Admin" | "Grant Admin" | primary |
| Revoke Admin | `shield-off` | "Revoke Admin" | "Revoke Admin" | primary |

### 8.6 Destructive 按钮

```yaml
height: 36px
padding: [0, 16]
cornerRadius: 8
background: semantic.destructive.bg (#FFB4AB)
color: semantic.destructive.buttonText (#131313)
font: Manrope 12px/700
hover: opacity=0.9
```

---

## 9. 分页栏 (Pagination)

```yaml
height: 48px
padding: [0, 16]
borderTop: border.subtle (1px)
layout: horizontal, justifyContent=space_between, alignItems=center
```

### 9.1 左侧 — 摘要文字

```yaml
font: paginationText (Manrope 12px/400)
color: text.muted
format: "Showing {start}–{end} of {total} {entity}"
```

### 9.2 右侧 — 页码控件

```yaml
layout: horizontal, gap=4, alignItems=center
```

**页码按钮 (非激活):**

```yaml
size: 32×32
background: transparent
cornerRadius: 8
font: paginationNumber (Manrope 12px/400), text.secondary
hover: background=interactive.hoverHighlight
```

**页码按钮 (激活):**

```yaml
background: interactive.activeHighlight
font: paginationNumber (Manrope 12px/700), text.primary
```

**前后翻页箭头:**

```yaml
size: 32×32
icon: chevron-left / chevron-right (lucide), 14px
disabled: opacity=0.3, cursor=not-allowed
```

**省略号:** `...` text.muted, 12px, 不可点击

**页码窗口:** 最多显示 5 个页码。超过 5 页: `[1] ... [4] [5] [6] ... [10]`

---

## 10. 骨架加载 (SkeletonRow)

```yaml
height: 48px (匹配数据行)
count: 10 rows (匹配默认分页大小)
animation: pulse { 0%,100%: opacity=0.3; 50%: opacity=0.6 } 1.5s infinite
skeletonBar:
  height: 12px
  cornerRadius: 6
  background: text.muted at 15% opacity
barWidths:
  name: 120px
  email: 160px
  status: 60px
  admin: 50px
  teams: 80px
  date: 100px
```

---

## 11. 空状态 (EmptyState)

```yaml
layout: vertical, alignItems=center, justifyContent=center
padding: [64, 0]
container: 替换表体行区域
```

| 元素 | 值 |
|------|-----|
| icon | 上下文图标, 48px, text.muted 50% opacity |
| heading | emptyHeading (Space Grotesk 14px/700), text.primary |
| body | emptyBody (Manrope 12px/400), text.muted, marginTop=8px |
| CTA | Phase 08 secondary 按钮, marginTop=16px (视情况) |

### 11.1 空状态文案

| 场景 | 图标 | 标题 | 正文 | CTA |
|------|------|------|------|-----|
| Users 无数据 | `users` | "No users yet" | "Users will appear here once they register." | — |
| Users 搜索无结果 | `search` | "No users found" | "Try adjusting your search or filters." | "Clear filters" |
| Teams 无数据 | `group` | "No teams yet" | "Teams will appear here once they are created." | — |
| Teams 搜索无结果 | `search` | "No teams found" | "Try adjusting your search." | "Clear search" |

---

## 12. 错误状态 (ErrorState)

```yaml
layout: 同 EmptyState
icon: alert-circle (lucide), 48px, semantic.destructive.text 50% opacity
heading: emptyHeading, text.primary
body: emptyBody, text.muted
CTA: "Retry" — Phase 08 primary 按钮, marginTop=16px
```

| 场景 | 标题 | 正文 |
|------|------|------|
| Users 加载失败 | "Failed to load users" | "Something went wrong. Please try again." |
| Teams 加载失败 | "Failed to load teams" | "Something went wrong. Please try again." |

---

## 13. Toast 消息 (Sonner)

| 操作 | 成功 | 失败 |
|------|------|------|
| Ban User | "已封禁 {email}" | "封禁失败: {error}" |
| Enable User | "已启用 {email}" | "启用失败: {error}" |
| Grant Admin | "已授予 {email} 管理员权限" | "操作失败: {error}" |
| Revoke Admin | "已撤销 {email} 管理员权限" | "操作失败: {error}" |

成功: sonner 默认样式; 失败: sonner `error` 变体。

---

## 14. 侧边栏导航状态

Users 和 Teams 页面复用 Phase 08 AdminSidebar，仅更新激活态:

| 页面 | 激活导航项 |
|------|-----------|
| Users | `users` — Nav Users (icon + text → text.primary, bg → activeHighlight) |
| Teams | `group` — Nav Teams (icon + text → text.primary, bg → activeHighlight) |

其他导航项保持默认态 (icon + text → text.muted)。

---

## 15. 设计决策说明

1. **继承 V2 Neutral Gray** — 完全复用 Phase 08 AdminShell 布局和色彩体系
2. **表格优先** — DataTable 为页面主视觉焦点，筛选栏为辅助导航
3. **语义色徽章** — Active (绿)、Banned (红)、Admin (紫) 三种状态用彩色区分
4. **行操作菜单** — 使用下拉菜单而非内联按钮，保持表格整洁
5. **确认弹窗** — 所有危险操作 (封禁/解封/授权/撤权) 需二次确认
6. **Teams 只读** — Teams 表无行操作和排序，简化只读视图
7. **中文 Toast** — 操作反馈使用中文，与系统其他部分一致

---

*基于 Admin Console V2 Neutral Gray (pencil-new.pen, Frame r6nJZ & i9m7l)*
*Phase 08 设计继承: admin-console-v2-neutral-gray.png*
*设计日期: 2026-04-01*
