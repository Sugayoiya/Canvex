# Phase 06 组件规格 (Component Specs)

> 供 AI 编码时直接引用的结构化规格，配合 `design-tokens.json` 使用。
> 所有颜色引用格式: `tokens.themes.{dark|light}.{path}`
> 参考设计: Stitch Refined 版本截图 (`01-04-*.png`)

---

## 0. 全局布局 (AppShell)

```yaml
layout: horizontal
children:
  - sidebar: 固定左侧, w=256px, h=100vh
  - main: flex-1
    children:
      - topBar: 固定顶部, h=64px, w=100%
      - content: scrollable, pt=64px, pl=256px
background: surface.base
dotGrid:
  image: "radial-gradient(canvas.gridDot 1px, transparent 0)"
  size: "24px 24px"
```

---

## 1. 顶栏 (TopAppBar)

```yaml
position: fixed top-0, w=100%, z=50
height: 64px
background: surface.base + 80% opacity
effects:
  - backdrop_blur: 12px
  - borderBottom: border.subtle (1px)
layout: horizontal, justifyContent=space-between, alignItems=center, px=24
```

### 左侧

```yaml
children:
  - brandMark: horizontal, gap=8, alignItems=center
    - dot: 8×8px, rounded-full, bg=accent.primary, shadow=shadow.primaryGlow
    - text: "Obsidian Lens", headlineSm, text.primary, tracking=-0.01em
  - navTabs: horizontal, gap=24 (hidden on mobile)
    - each: labelMd, text.disabled (默认) / accent.primary + borderBottom 2px (激活)
```

### 右侧

```yaml
children:
  - searchInput: w=256px, bg=surface.containerHighest + 50%, border=border.default
    cornerRadius=default, px=16, py=6, text=bodySm, placeholder=text.placeholder
    trailingIcon: search, text.muted
  - primaryCTA: "New Project", bg=accent.primaryGradient, text=text.onPrimary
    px=16, py=6, cornerRadius=default, labelLg
  - iconGroup: horizontal, gap=8
    - notificationIcon: 20px, text.muted, hover=accent.primary
    - avatar: 32×32px, rounded-full, border=border.default, objectFit=cover
```

---

## 2. 侧边栏 (SideNavBar)

```yaml
position: fixed left-0, w=256px, h=100vh, z=40
background: surface.base
borderRight: border.subtle (1px, 可选)
layout: vertical, p=16, pt=80
```

### 2.1 空间切换器 (SpaceSwitcher)

```yaml
mb: 32
padding: 12
background: surface.containerLow
cornerRadius: lg
border: border.faint (1px)
cursor: pointer
hover: bg=surface.containerHigh
layout: horizontal, gap=12, alignItems=center
children:
  - avatar: 40×40px, cornerRadius=md, bg=accent.primary + 20% opacity
    icon: movie_filter (filled), accent.primary
  - info: vertical
    - name: titleSm, text.primary (团队名/个人名)
    - type: labelSm, text.muted ("TEAM SPACE" / "PERSONAL")
  - expandIcon: expand_more, text.muted, hover=accent.primary
```

### 2.2 导航菜单

```yaml
layout: vertical, gap=4
sectionLabel: labelSm, text.disabled, mb=8, px=12
```

**菜单项:**
```yaml
height: 36px
padding: [8, 12]
cornerRadius: md
layout: horizontal, gap=12, alignItems=center
children:
  - icon: 20px, text.muted (默认) / accent.primary (激活)
  - text: labelMd, text.muted (默认) / accent.primary (激活)
states:
  default: bg=transparent, text=text.muted
  hover: bg=surface.containerHigh + 50%, text=text.primary
  active: bg=accent.primary + 10%, text=accent.primary
```

| 图标 | 名称 | 路由 |
|------|------|------|
| `grid_view` | Workspace | /projects |
| `movie_filter` | Productions | /projects?filter=production |
| `group` | Team | /teams |
| `psychology` | AI Engine | /settings/ai |
| `inventory_2` | Archive | /projects?filter=archived |

### 2.3 底部区域

```yaml
mt: auto, pt=16, space-y=16
children:
  - quotaCard: bg=surface.containerLow, border=border.subtle, cornerRadius=lg, p=16
    - header: horizontal, justifyContent=space-between
      - label: "AI QUOTA", labelSm, accent.primary
      - value: "72%", labelSm, text.muted
    - progressBar: h=4, cornerRadius=full, bg=surface.containerHigh
      - fill: bg=accent.primary, shadow=primaryGlow, w=percentage
  - footerLinks: space-y=4
    - support: icon=help_outline, "Support"
    - settings: icon=tune, "Settings"
```

---

## 3. 项目中心 (ProjectDashboard)

### 3.1 页面头部

```yaml
layout: horizontal, justifyContent=space-between, alignItems=end, mb=48
children:
  - left: vertical
    - sectionLabel: "NETWORK HUB", labelSm, accent.primary, tracking=0.4em, mb=12
    - title: displayMd, text.primary
      - bold: 团队名
      - light: "Productions", text.muted, fontWeight=300
  - right: horizontal, gap=16
    - secondaryBtn: "New Canvas", icon=layers
      bg=interactive.buttonSecondary, border=interactive.buttonSecondaryBorder
      text=interactive.buttonSecondaryText, cornerRadius=default
    - primaryBtn: "New Project", icon=add_circle
      bg=interactive.buttonPrimaryGradient, text=text.onPrimary
      shadow=shadow.buttonGlow, cornerRadius=default
```

### 3.2 项目卡片 (ProjectCard)

```yaml
background: glass.card
border: glass.cardBorder (1px)
cornerRadius: xl
padding: [24, 32]
backdrop_filter: blur(glass.blurRadius)
hover:
  border: glass.cardHoverBorder
  background: "rgba(22, 22, 22, 0.9)"
transition: motion.transitionDefault
```

**特色项目卡 (宽版, 8列):**
```yaml
gridSpan: 8/12
children:
  - header: horizontal, gap=24, justifyContent=space-between
    - projectInfo: horizontal, gap=24
      - thumbnail: 64×64px, cornerRadius=lg, border=border.default, overflow=hidden
        img: objectFit=cover, grayscale, hover=grayscale-0 (700ms transition)
      - meta: vertical
        - title: headlineMd, text.primary
        - stats: horizontal, gap=16
          - stat: icon+text, labelSm, text.disabled
          - badge: bg=accent.primary/10, text=accent.primary, border=accent.primary/20
            px=8, py=2, cornerRadius=default, labelSm
    - actions: horizontal, gap=8
      - copyBtn: 40×40px, icon=content_copy, text.disabled
      - moreBtn: 40×40px, icon=more_horiz, text.disabled
  - canvasNodes: grid 2列, gap=20, mt=24
    - nodeLink: bg=surface.containerLow/50, border=border.subtle, p=20, cornerRadius=lg
      hover: border=accent.primary/40
      - sectionLabel: labelSm, text.disabled
      - title: titleSm, text.primary, hover=accent.primary
      - meta: labelSm, text.disabled
```

**标准项目卡 (4列):**
```yaml
gridSpan: 4/12
children:
  - header: horizontal, justifyContent=space-between, mb=20
    - thumbnail: 48×48px, cornerRadius=default, grayscale
    - badge: "Personal"/"In Review"/etc
  - title: titleLg, text.primary
  - description: bodySm, text.disabled, mt=12, mb=24, line-clamp=2
  - footer: borderTop=border.subtle, pt=20
    horizontal, justifyContent=space-between
    - subNodeCount: labelSm, text.disabled
    - enterBtn: "Enter →", accent.primary, labelMd, hover: gap增大
```

**空状态卡 (添加新项目):**
```yaml
gridSpan: 4/12
border: dashed, border.outlineVariant/20
cornerRadius: xl, p=24
layout: vertical, center
hover: border=accent.primary/40, bg=accent.primary/5
children:
  - icon: 48×48px, rounded-full, border=border.default, icon=add, text.disabled
  - title: "Initialize Node", titleSm, text.primary
  - subtitle: labelSm, text.disabled
```

### 3.3 系统分析面板 (SystemAnalysis)

```yaml
gridSpan: 4/12 (右侧)
background: glass.card
cornerRadius: xl, p=24
children:
  - header: "System Analysis", labelLg, text.primary
    dot: 6×6px, accent.primary
  - metrics: space-y=24
    - metric:
      - header: horizontal, justifyContent=space-between, labelSm
        - label: text.disabled
        - value: accent.primary / accent.tertiary
      - bar: h=4, cornerRadius=full, bg=surface.containerHigh
        - fill: accent.primary/40 or accent.tertiary/40, border-right=accent.primary
```

### 3.4 升级面板 (UpgradeCard)

```yaml
bg: accent.primary/5
border: accent.primary/20
cornerRadius: xl, p=32
layout: vertical, center
children:
  - icon: 56×56px, rounded-full, bg=accent.primary/10, border=accent.primary/20
    shadow: "0 0 20px rgba(0,209,255,0.15)"
    icon: auto_awesome (filled), accent.primary
  - title: labelMd, accent.primary, tracking=0.3em
  - description: bodySm, text.muted, center
  - button: w=100%, py=10, bg=accent.primary, text=text.onPrimaryContainer
    cornerRadius=default, labelMd, shadow=shadow.buttonGlow
```

### 3.5 活动日志 (RecentActivity)

```yaml
mt: 80
background: glass.card
cornerRadius: xxl, p=32
children:
  - header: horizontal, justifyContent=space-between, mb=40
    - title: headlineSm, text.primary + "Logs" text.muted/30
    - link: "Full Log Report", labelMd, accent.primary
  - list: space-y=12
    - item: horizontal, gap=20, p=16
      bg: surface.containerLow/30, hover: surface.containerLow/80
      cornerRadius=lg, border=transparent, hover: border.subtle
      children:
        - statusDot: 6×6px, rounded-full
          - primary: accent.primary + glow
          - tertiary: accent.tertiary + glow
          - neutral: text.muted/40
        - avatar: 28×28px, rounded-full, border=border.default
        - text: bodySm, text.muted
          - name: text.primary, bold
          - link: accent.primary, underline
        - time: labelSm, text.disabled
```

### 3.6 浮动操作按钮 (FAB)

```yaml
position: fixed, bottom=40, right=40, z=50
width: 64px, height: 64px
bg: accent.primaryGradient
cornerRadius: full
shadow: shadow.primaryGlow
icon: bolt, 28px, text.onPrimary
border: white/10
hover: scale=1.1
active: scale=0.95
```

---

## 4. 团队管理 (TeamManagement)

### 4.1 页面头部

```yaml
children:
  - title: displayMd, "Team & Roles", text.primary
  - subtitle: bodyLg, text.muted, mt=8
  - actions: horizontal, gap=16
    - inviteBtn: icon=link, "Invite By Link"
      bg=interactive.buttonSecondary, border=border.default
    - newProjectBtn: icon=add, "New Project"
      bg=accent.primaryGradient, text=text.onPrimary
```

### 4.2 组织结构面板 (OrgStructure)

```yaml
width: ~400px (left side)
background: glass.card
cornerRadius: xl, p=24
children:
  - header: "Organizational Structure", labelLg, accent.primary
    dot: 6×6px, accent.primary
  - tree: vertical, space-y=24
    - globalAdmin: bg=surface.containerLow, p=16, cornerRadius=lg
      - title: "GLOBAL ADMIN", titleSm
      - badge: "READ-ONLY", labelSm, bg=surface.containerHigh
      - description: bodySm, text.muted
    - teamAdmins: bg=surface.containerLow, p=16, cornerRadius=lg
      border: accent.primary/30 (激活态)
      - header: "TEAM ADMINS" + badge "4 Active" (accent.primary)
      - description: bodySm, text.muted
    - subGroups: vertical
      - title: "SUB-GROUPS", labelMd, text.primary
      - tags: horizontal, gap=8
        - tag: bg=surface.containerHigh, px=12, py=4, cornerRadius=default
          bodySm, text.muted
  - perfAnalytics: "PERFORMANCE ANALYTICS", labelSm, text.muted
    - stats: horizontal, gap=16
      - stat: bg=surface.containerLow, p=16, cornerRadius=lg
        - label: labelSm, text.muted
        - value: headlineMd, text.primary / accent.primary
```

### 4.3 成员列表 (MemberTable)

```yaml
flex: 1 (right side)
children:
  - toolbar: horizontal, gap=16, mb=16
    - searchInput: bg=surface.containerHigh, cornerRadius=default
      placeholder: "Filter by identity or node ID"
    - filterSelect: "ALL PERMISSIONS", bg=surface.containerHigh
  - table:
    header: labelSm, text.muted, uppercase, tracking=widest
    columns: [Entity, Access Node, Signal Status]
    - row: horizontal, py=16, borderBottom=border.subtle
      - entity: horizontal, gap=16
        - avatar: 40×40px, rounded-full
        - info: vertical
          - name: titleSm, text.primary
          - email: bodySm, text.muted
      - role: labelMd, accent.primary / accent.tertiary / text.muted
        + badge (optional): bg=accent.primary/10
      - status:
        - active: "ACTIVE", accent.primary + dot
        - inactive: "INACTIVE NODE", bg=error/10, text=error
        - lastActive: "LAST ACTIVE 2H AGO", bodySm, text.muted
  - pagination: horizontal, gap=8, center
    - info: "SYNC: 4 / 142 ENTITIES", labelSm, text.muted
    - pages: numbered buttons, active=bg=accent.primary
```

---

## 5. AI 配置与计费 (ModelConsole)

### 5.1 页面头部

```yaml
title: displayMd, "Model Console"
subtitle: bodyLg, text.muted
actions:
  - resyncBtn: icon=sync, "Resync Status", bg=accent.secondaryContainer
  - newProviderBtn: icon=add, "New Provider", bg=accent.primaryGradient
```

### 5.2 配额分配 (QuotaDistribution)

```yaml
gridSpan: 8/12
background: glass.card, cornerRadius=xl, p=24
children:
  - header: horizontal, justifyContent=space-between
    - left: vertical
      - label: "QUOTA DISTRIBUTION", labelSm, accent.primary
      - title: headlineMd, "Monthly Token Allocation"
    - right: displayLg, text.primary + "/ 2.0B Used" bodySm, text.muted
  - bars: vertical, space-y=16
    - bar:
      - label: horizontal, justifyContent=space-between
        - name: "PERSONAL (WORKSPACE A)", bodySm, text.muted
        - percentage: "52%", bodySm, accent.primary
      - track: h=6, cornerRadius=full, bg=surface.containerHigh
        - fill: bg=accent.primary, w=percentage
    - bar:
      - name: "TEAM (SHARED POOL)", bodySm, text.muted
      - fill: bg=accent.tertiary
```

### 5.3 服务健康 (ServiceHealth)

```yaml
gridSpan: 4/12
background: glass.card, cornerRadius=xl, p=24
children:
  - list: vertical, space-y=12
    - item: horizontal, justifyContent=space-between, alignItems=center
      - left: horizontal, gap=12
        - statusDot: 8×8px, rounded-full
          green=semantic.success, amber=semantic.warning
        - name: bodySm, text.primary
      - right: labelMd
        - optimal: semantic.success
        - stable: accent.primary
        - latency: semantic.warning
```

### 5.4 Provider 配置卡 (ProviderCard)

```yaml
layout: grid, 3 columns, gap=24
card:
  background: glass.card, cornerRadius=xl, p=24
  children:
    - header: horizontal, gap=12, mb=16
      - icon: 40×40px, cornerRadius=lg, bg=accent.primary/10
      - info: vertical
        - name: titleMd, text.primary ("OpenAI" / "Anthropic" / "Local")
        - status: labelSm
          active: accent.primary ("ROUND-ROBIN ACTIVE")
          manual: accent.tertiary ("MANUAL SELECT ONLY")
          system: semantic.success ("SYSTEM DEFAULT")
      - moreBtn: icon=more_horiz
    - keyField: bg=surface.containerHigh, cornerRadius=md, p=12
      bodySm, text.muted, font=mono
      trailingIcon: visibility_off
    - stats: horizontal, gap=12, mt=16
      - stat: bg=surface.containerLow, cornerRadius=md, p=12
        - label: labelSm, text.muted
        - value: bodyMd, accent.primary / text.primary
```

### 5.5 双维度计费矩阵 (BillingMatrix)

```yaml
mt: 48
header: "Dual-Dimension Billing Matrix", headlineSm, text.primary
  dot: 6×6px, accent.primary
table:
  headerRow: labelSm, text.muted, uppercase
  columns: [Entity (Key/User), Type, Usage (Tokens), Estimated Cost, Trend (24h)]
  row:
    - entity: horizontal, gap=12
      - icon: avatar or key-icon
      - name: bodyMd, text.primary
    - typeBadge: "KEY" (accent.primary bg) / "USER" (accent.secondary bg)
      labelSm, cornerRadius=default
    - usage: bodyMd, text.muted, font=mono
    - cost: titleMd, text.primary, font=headline, bold
    - trend: labelMd
      positive: semantic.success ("↑ 12.4%")
      negative: semantic.error ("↓ 4.2%")
      neutral: text.muted ("— 0.0%")
footer: "VIEW FULL FINANCIAL AUDIT →", labelMd, text.muted, center, mt=24
```

---

## 6. 登录与认证 (AuthLogin)

### 6.1 全屏背景

```yaml
layout: flex, center, min-h=100vh
background:
  - image: 电影片场/影棚背景照片, objectFit=cover
    filter: grayscale, brightness=20%
  - overlay: radial-gradient(circle at center, transparent, rgba(0,0,0,0.4))
```

### 6.2 登录卡片

```yaml
width: max-w=440px
background: glass.loginCard
backdrop_filter: blur(glass.heavyBlurRadius)
padding: 40px
cornerRadius: xxl
border: white/5 (hover: white/10)
shadow: shadow.loginGlow
transition: motion.transitionSlow
```

### 6.3 Logo 区域

```yaml
layout: vertical, center, mb=40
children:
  - icon: lens_blur (filled), 36px, accent.primary
  - title: headlineLg, text.primary, tracking=-0.01em, bold
  - subtitle: labelSm, text.muted, tracking=0.25em
```

### 6.4 社交登录按钮

```yaml
space-y: 12, mb=32
button:
  w: 100%
  py: 12, px: 16
  bg: white/5, hover: white/10
  border: white/5
  cornerRadius: lg
  layout: horizontal, center, gap=12
  children:
    - icon: 16×16px (Google logo / GitHub SVG)
    - text: "Continue with Google/GitHub", bodyMd, text.primary/90
```

### 6.5 分割线

```yaml
layout: horizontal, gap=16, mb=32, alignItems=center
children:
  - line: flex-1, h=1px, bg=white/5
  - text: "OR EMAIL", labelSm, text.disabled
  - line: flex-1, h=1px, bg=white/5
```

### 6.6 邮箱表单

```yaml
space-y: 24
inputField:
  bg: surface.containerLow (#1c1c1c)
  border: white/5
  cornerRadius: lg
  py: 14, px: 16
  text: bodyMd, text.primary
  placeholder: text.placeholder
  focus: ring=accent.primary/40, border=accent.primary/40
label:
  labelSm, text.muted, ml=4, mb=8
submitButton:
  w: 100%, py: 16
  bg: accent.primary
  text: text.onPrimary
  font: headline, bold, bodyMd
  cornerRadius: lg
  shadow: shadow.buttonGlow
  hover: brightness=110%
  active: scale=0.98
```

### 6.7 底部

```yaml
mt: 40, center
text: "New to Obsidian?", bodySm, text.muted
link: "Request early access", accent.primary, hover: underline

footer:
  p: 32, center
  children:
    - icon: verified_user, 16px, text.muted/30
    - text: "PROTECTED BY AUTHGUARD V2.4", labelSm, text.muted/30
```

---

## 7. 主题切换映射表 (Dark ↔ Light)

> CSS 变量映射，用于 Tailwind 或 CSS-in-JS 配置

| Token Path | Dark | Light |
|---|---|---|
| `canvas.background` | `#0E0E0E` | `#F5F5F5` |
| `surface.base` | `#0E0E0E` | `#F5F5F5` |
| `surface.containerLow` | `#111111` | `#F0F0F0` |
| `surface.containerHigh` | `#1A1A1A` | `#E0E0E0` |
| `surface.containerHighest` | `#222222` | `#D5D5D5` |
| `text.primary` | `#E5E2E1` | `#1A1A1A` |
| `text.secondary` | `#BBC9CF` | `#4A5A62` |
| `text.muted` | `#8E9192` | `#7A8A92` |
| `accent.primary` | `#00D1FF` | `#00677F` |
| `accent.tertiary` | `#FFD59C` | `#624000` |
| `border.default` | `#FFFFFF14` | `#D0D0D040` |
| `interactive.buttonPrimary` | `#00D1FF` | `#00677F` |
| `glass.card` | `rgba(18,18,18,0.8)` | `rgba(255,255,255,0.9)` |

---

## 8. 与 Phase 04/05 画布设计的桥接说明

Phase 04/05 的设计面向**画布工作台**（无限画布 + 素材节点），Phase 06 面向**管理面板**（项目列表、团队配置、登录）。两者共享同一设计语言但有差异：

| 属性 | Phase 04/05 (Canvas) | Phase 06 (Dashboard) |
|------|---------------------|---------------------|
| 底色 | `#131313` (canvas.bg) | `#0E0E0E` (更深) |
| 主按钮 | `#E5E2E1` (中性白) | `#00D1FF` (品牌青) |
| 卡片风格 | solid bg + subtle border | glassmorphism + backdrop-blur |
| 图标库 | Lucide | Material Symbols |
| 网格点 | 40px 间距, 2×2px | 24px 间距, 1×1px |
| 圆角 | 12-20px (较大) | 6-16px (较紧凑) |

**共享不变的部分：**
- 字体: Space Grotesk + Manrope
- 文本颜色: `#E5E2E1` (primary), `#BBC9CF` (secondary)
- 暗色主题色调整体一致
- 阴影层级体系

*基于 Stitch Refined 设计稿 (2026-03-30)*
*设计日期: 2026-03-30*
