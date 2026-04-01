# Admin Console Shell 组件规格 (Component Specs)

> 供 AI 编码时直接引用的结构化规格，配合 `design-tokens.json` 使用。
> 继承 Canvas V4 基础设计系统，所有颜色引用格式: `tokens.themes.{dark|light}.{path}`
> 设计图参考: `admin-console-v2-neutral-gray.png`

---

## 1. 整体布局 (AdminShell)

```yaml
layout: horizontal
width: 100vw
height: 100vh
children:
  - AdminSidebar: fixed, width=240px
  - RightArea: flex, layout=vertical
    - AdminTopbar: height=56px
    - MainContent: flex, padding=40px, overflow=auto
```

与 AppShell 完全独立，不共享布局组件。

---

## 2. 管理侧边栏 (AdminSidebar)

```yaml
position: fixed, left=0, top=0
width: 240px
height: 100vh
background: surface.sidebar (#131313)
borderRight: border.sidebarRight (1px)
layout: vertical
padding: [24, 16]
```

### 2.1 Logo 区

```yaml
padding: [0, 8, 20, 8]
layout: horizontal, gap=10, alignItems=center
children:
  - icon: shield (lucide), 20px, text.primary
  - info: vertical, gap=2
    - title: "Admin", sidebarTitle, text.primary
    - subtitle: "Production Suite", sidebarSubtitle, text.muted
```

### 2.2 导航项 (NavItem)

```yaml
width: fill
height: 36px
padding: [0, 12]
layout: horizontal, gap=10, alignItems=center
cornerRadius: 8
```

**默认态:**
```yaml
background: transparent
icon: 16px, text.muted
text: navItem, text.muted
```

**激活态:**
```yaml
background: interactive.activeHighlight (#E5E2E115)
icon: 16px, text.primary
text: navItemActive, text.primary
```

**悬停态:**
```yaml
background: interactive.hoverHighlight (#E5E2E110)
icon: 16px, text.secondary
text: navItem, text.secondary
```

### 2.3 导航列表

| 序号 | 图标 | 名称 | 路由 |
|------|------|------|------|
| 1 | `layout-dashboard` | Dashboard | /admin |
| 2 | `users` | Users | /admin/users |
| 3 | `group` | Teams | /admin/teams |
| 4 | `gauge` | Quotas | /admin/quotas |
| 5 | `credit-card` | Pricing | /admin/pricing |
| 6 | `settings` | Providers | /admin/providers |
| 7 | `activity` | Monitoring | /admin/monitoring |

导航项间距: gap=2px

---

## 3. 管理顶栏 (AdminTopbar)

```yaml
position: sticky, top=0
width: fill_container
height: 56px
background: surface.topbar (#1C1B1BDD)
borderBottom: border.topbarBottom (1px)
padding: [0, 32]
layout: horizontal, justifyContent=space_between, alignItems=center
effects:
  - background_blur: radius=20
```

### 3.1 左侧

```yaml
layout: horizontal, gap=16, alignItems=center
children:
  - backButton: horizontal, gap=6, alignItems=center
    - icon: arrow-left (lucide), 14px, text.muted
    - text: "Back to App", topbarLink, text.muted
  - title: "Admin Console", topbarTitle, text.primary
```

### 3.2 右侧

```yaml
layout: horizontal, gap=12, alignItems=center
children:
  - notificationIcon: bell (lucide), 16px, text.muted
  - divider: 1×20px, border.divider
  - email: topbarEmail, text.secondary
  - avatar: ellipse 28×28, fill=surface.primary, border=border.default (1px)
```

---

## 4. KPI 卡片 (KPICard)

```yaml
width: fill_container (2 列网格，gap=16)
height: 160px
background: surface.card (#2A2A2A)
cornerRadius: 12
border: border.subtle (1px)
padding: [20, 24]
layout: vertical, justifyContent=space_between
```

### 4.1 卡片顶部

```yaml
layout: horizontal, justifyContent=space_between, alignItems=start
children:
  - label: cardLabel, text.muted, letterSpacing=1
  - icon: 对应类型 (lucide), 16px, text.muted
```

### 4.2 卡片底部

```yaml
layout: vertical, gap=8
children:
  - value: cardValue, text.primary (有数据) / cardValuePlaceholder (#E5E2E150, 无数据用 "—")
  - statusRow: horizontal, gap=8, alignItems=center
    - badge: { padding=[2,8], cornerRadius=6, bg=surface.secondary }
      - text: badgeText, text.secondary
    - description: cardDescription, text.muted
```

### 4.3 四张 KPI 卡片

| 位置 | 标签 | 图标 | Badge | 描述 |
|------|------|------|-------|------|
| 左上 | Total Users | `user` | Stable | Waiting for data link |
| 右上 | Active Teams | `users` | 0 active | No pending requests |
| 左下 | Tasks (24h) | `circle-check` | ● (dot) | Awaiting system sync |
| 右下 | Total Cost (30d) | `wallet` | USD 0.00 (text.primary) | Current billing cycle |

### 4.4 网格布局

```yaml
layout: vertical, gap=16
children:
  - row1: horizontal, gap=16
    - card1 (Total Users): fill_container
    - card2 (Active Teams): fill_container
  - row2: horizontal, gap=16
    - card3 (Tasks 24h): fill_container
    - card4 (Total Cost): fill_container
```

---

## 5. 页面标题区 (PageHeader)

```yaml
layout: horizontal, justifyContent=space_between, alignItems=end
width: fill_container
children:
  - left: vertical, gap=6
    - title: pageTitle, text.primary (#FFFFFF in dark)
    - subtitle: pageSubtitle, text.muted
  - right: horizontal, gap=10
    - secondaryButton: { height=36, padding=[0,16], cornerRadius=8, bg=surface.card, border=border.default }
      - text: buttonSecondary, text.secondary
    - primaryButton: { height=36, padding=[0,16], cornerRadius=8, bg=interactive.buttonPrimary }
      - text: buttonPrimary, interactive.buttonPrimaryText
```

---

## 6. 页脚 (Footer)

```yaml
width: fill_container
borderTop: border.subtle (1px)
padding: [32, 0, 0, 0]
layout: vertical, gap=12, alignItems=center
children:
  - badge: { padding=[6,14], cornerRadius=9999, bg=surface.card, border=border.subtle }
    - layout: horizontal, gap=8, alignItems=center
    - dot: ellipse 5×5, fill=text.muted
    - text: footerLabel, text.muted
  - description: footerDescription, text.muted
```

---

## 7. 主题切换映射表 (Admin 扩展)

> 在 Canvas V4 基础映射表上新增以下 admin 专用 tokens

| Token Path | Dark | Light |
|---|---|---|
| `surface.sidebar` | `#131313` | `#F5F5F5` |
| `surface.topbar` | `#1C1B1BDD` | `#FFFFFFEE` |
| `surface.card` | `#2A2A2A` | `#FFFFFF` |
| `border.sidebarRight` | `#3c494e20` | `#D0D0D040` |
| `border.topbarBottom` | `#3c494e20` | `#D0D0D040` |
| `interactive.buttonSecondaryBorder` | `#3c494e30` | `#D0D0D040` |

所有其余 tokens 继承自 Canvas V4 (`../04-media-tools/designs/design-tokens.json`)。

---

## 8. 设计决策说明

1. **无青色 accent** — 与 Canvas V4/V5 保持一致，主交互色为 `text.primary` (白/黑)，不引入额外的品牌色
2. **实心卡片** — 使用 `surface.primary` (#2A2A2A) 实心背景，不使用 glassmorphism
3. **Lucide 图标** — 与 Canvas V4/V5 统一使用 lucide 图标库
4. **字体** — label 使用 Manrope（body font），标题使用 Space Grotesk（display font）
5. **圆角 12px** — 卡片圆角与 Canvas 节点卡片一致
6. **独立 Shell** — AdminShell 与 AppShell 完全独立，不共享布局组件

---

*基于 Admin Console V2 Neutral Gray (pencil-new.pen, Frame 09KFK)*
*设计日期: 2026-04-01*
