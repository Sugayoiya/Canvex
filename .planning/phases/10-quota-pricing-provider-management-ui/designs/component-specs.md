# Quota & Pricing & Provider Management 组件规格 (Component Specs)

> 供 AI 编码时直接引用的结构化规格，配合 `design-tokens.json` 使用。
> 继承 Phase 08 设计系统 + Phase 09 组件库（AdminDataTable, StatusBadge, ConfirmationModal 等）。
> 设计图参考: `pencil-new.pen` (Frame zXqUs, ASIoH, E1Z09)

---

## 1. 共用页面布局

```yaml
container: AdminShell > MainContent
layout: vertical
padding: [32, 40]
gap: 24
children:
  - PageHeader
  - [页面特有内容区]
```

所有三个页面复用 Phase 08 AdminShell（Sidebar 240px + TopBar 56px + MainContent），
仅更新侧边栏激活导航项。

### 1.1 侧边栏导航状态

| 页面 | 激活导航项 |
|------|-----------|
| Quotas | `gauge` — Nav Quotas |
| Pricing | `credit-card` — Nav Pricing |
| Providers | `settings` — Nav Providers |

激活态: icon + text → text.primary, fontWeight 600, bg → activeHighlight。
其他项保持默认态 (icon + text → text.muted)。

---

## 2. 页面标题区 (PageHeader)

### 2.1 Quota 页面 — 仅标题

```yaml
layout: vertical, gap=4
width: fill_container
children:
  - title: "Quotas", pageTitle, text.primary
  - subtitle: "Allocate and monitor API usage limits. Resets every 30 days.", pageSubtitle, text.muted
```

### 2.2 Pricing 页面 — 标题 + 筛选 + CTA

```yaml
layout: horizontal, justifyContent=space_between, alignItems=end
width: fill_container
children:
  - left: vertical, gap=4
    - title: "Pricing", pageTitle, text.primary
    - subtitle: "Configure model-level pricing and service rules", pageSubtitle, text.muted
  - right: horizontal, gap=12, alignItems=center
    - StatusFilter: FilterDropdown (width=140, "All Status")
    - CTA: primaryButton "Create Pricing Rule" + plus icon
```

### 2.3 Providers 页面 — 标题 + CTA

```yaml
layout: horizontal, justifyContent=space_between, alignItems=end
width: fill_container
children:
  - left: vertical, gap=4
    - title: "System Providers", pageTitle, text.primary
    - subtitle: "Manage system-level AI provider configurations and API keys", pageSubtitle, text.muted
  - right: primaryButton "Add Provider" + plus icon
```

### 2.4 主操作按钮 (primaryButton)

```yaml
height: 36px
cornerRadius: 8
background: btn.primary (#E5E2E1)
color: btn.primaryText (#131313)
font: Manrope 12px/700
padding: [0, 16]
gap: 8
icon: plus (lucide), 14px
hover: opacity=0.9
```

---

## 3. Quota 页面 — 特有组件

### 3.1 TabBar (Users | Teams)

```yaml
layout: horizontal
width: fill_container
borderBottom: border.subtle (1px)
children:
  - Tab (active): height=40, padding=[0,16], borderBottom=text.primary (2px)
    - text: tabLabel, text.primary
  - Tab (inactive): height=40, padding=[0,16], borderBottom=transparent
    - text: tabLabelInactive, text.muted
```

**Tab 选项:** "Users" (默认选中) | "Teams"

**交互:**
- 悬停: text → text.secondary
- 点击: 切换 Tab，重新加载对应数据

### 3.2 搛选工具栏 (SearchInput)

```yaml
height: 36px
cornerRadius: 8
background: surface.primary
border: border.subtle (1px)
padding: [0, 12]
gap: 8
layout: horizontal, alignItems=center
width: fill_container
children:
  - icon: search (lucide), 14px, text.muted
  - input: "Search by name or email...", searchPlaceholder, text.muted
```

### 3.3 配额列表容器 (QuotaList)

```yaml
width: fill_container
height: fill_container
background: surface.card
border: border.subtle (1px)
cornerRadius: 12
overflow: hidden (clip)
layout: vertical
```

### 3.4 可展开行 — 折叠态 (QuotaRowCollapsed)

```yaml
height: 72px
padding: [0, 20]
layout: horizontal, justifyContent=space_between, alignItems=center
borderBottom: border.subtle (1px)
```

**左侧:**
```yaml
layout: horizontal, gap=16, alignItems=center
children:
  - nameGroup: vertical, gap=2
    - name: expandableRowName, text.primary
    - meta: expandableRowMeta, text.muted
      format: "{email} · Active since {date}"
```

**右侧:**
```yaml
layout: horizontal, gap=8, alignItems=center
children:
  - usageInfo: vertical, gap=2, alignItems=end
    - label: "Monthly Usage", usageSummaryLabel, text.muted
    - numberRow: horizontal, gap=6, alignItems=end
      - number: usageCollapsedNumber (18px/700), text.primary (或 error 当接近上限)
      - total: "/ {limit} credits", usageSummaryUnit, text.muted
  - chevron: chevron-down (lucide), 16px, text.muted
```

**用量颜色规则:**
- 0–79%: text.primary
- 80–94%: warning (#FEB127)
- 95–100%: error (#FFB4AB)

**交互:**
- 悬停: background → expandableRowHover
- 点击: 展开 → QuotaRowExpanded

### 3.5 可展开行 — 展开态 (QuotaRowExpanded)

```yaml
layout: vertical
borderBottom: border.subtle (1px)
children:
  - RowHeader (同折叠态, 但 chevron 改为 chevron-up, 右侧 usageSummaryNumber 为 20px)
  - QuotaDetail
```

#### 3.5.1 QuotaDetail

```yaml
background: canvas.background (#131313)
padding: [16, 24, 20, 24]
layout: vertical, gap=16
children:
  - LimitColumns: horizontal, gap=24
    - MonthlyColumn: width=fill_container
    - DailyColumn: width=fill_container
  - WarningBanner (条件显示)
```

#### 3.5.2 LimitColumn (月度/日度共用)

```yaml
layout: vertical, gap=10, width=fill_container
children:
  - header: horizontal, justifyContent=space_between, alignItems=center
    - label: limitSectionHeader, text.muted
      Monthly: "MONTHLY CREDIT LIMIT (TOTAL)"
      Daily: "DAILY CALL LIMIT (TOTAL)"
    - percentage: limitPercentage
      color: 按用量百分比 → primary / warning / error
  - progressBar:
    - track: width=fill_container, height=6, cornerRadius=3, bg=progressBar.trackBg
    - fill: height=6, cornerRadius=3, bg=按百分比颜色, absolute positioned
  - editRow: horizontal, gap=8, alignItems=center
    - label: "LIMIT", limitSectionHeader, text.muted
    - input: fill_container, height=32, cornerRadius=6, bg=surface.primary, border=border.subtle
      - text: limitInputText, text.primary
    - resetButton: height=32, cornerRadius=6, bg=surface.primary, border=border.subtle, padding=[0,12]
      - text: "RESET", resetButton, text.secondary
```

#### 3.5.3 WarningBanner (条件显示)

当日度用量 ≥ 80% 时显示:

```yaml
layout: horizontal, gap=8, alignItems=center
children:
  - icon: triangle-alert (lucide), 14px, warning
  - text: warningText, warning
    format: "USER IS APPROACHING THE DAILY RATE LIMIT."
```

### 3.6 底部统计栏 (BottomStats)

```yaml
layout: horizontal, justifyContent=space_between, alignItems=center
width: fill_container
children:
  - stat1: horizontal, gap=8, alignItems=center
    - label: "Active Users", statsLabel, text.muted
    - value: statsValue, text.primary
  - stat2: horizontal, gap=8, alignItems=center
    - label: "Avg Monthly Usage", statsLabel, text.muted
    - value: statsValue, text.primary (e.g. "64.2%")
```

---

## 4. Pricing 页面 — 特有组件

### 4.1 Summary Cards 区

```yaml
layout: horizontal, gap=16
width: fill_container
children:
  - SummaryCard × N (每个 provider 一张)
```

#### 4.1.1 SummaryCard

```yaml
width: fill_container (均分)
height: 80px
cornerRadius: 12
background: surface.card
border: border.subtle (1px)
padding: [16, 20]
layout: vertical, justifyContent=space_between
children:
  - topRow: horizontal, justifyContent=space_between, alignItems=center
    - name: summaryCardTitle, text.primary
    - badge: StatusBadge (Active | Inactive)
  - bottomRow:
    - price: summaryCardPrice, text.muted
      LLM format: "In: ${input}  Out: ${output}"
      Image format: "Fix: ${price} Per Image"
```

### 4.2 Pricing 数据表 (PricingTable)

复用 Phase 09 AdminDataTable 组件结构:

```yaml
width: fill_container
height: fill_container
background: surface.card
border: border.subtle (1px)
cornerRadius: 12
overflow: hidden (clip)
layout: vertical
```

#### 4.2.1 Pricing 表列定义

| # | Key | 表头 | 宽度 | 内容 | 可排序 |
|---|-----|------|------|------|--------|
| 1 | provider | PROVIDER | 140px fixed | tableCellBold, text.primary | 否 |
| 2 | model | MODEL | 180px fixed | tableCell, text.secondary | 否 |
| 3 | type | TYPE | 80px fixed | tableCell, text.secondary ("LLM" / "Image") | 否 |
| 4 | price | PRICE (PER 1K) | 180px fixed | tableCell, text.secondary | 否 |
| 5 | status | STATUS | 100px fixed | StatusBadge (Active / Inactive) | 否 |
| 6 | actions | (无) | 48px fixed | RowDropdownMenu 触发器 | 否 |

#### 4.2.2 行操作菜单 (Pricing)

| 规则状态 | 项 1 | 项 2 | 项 3 |
|----------|------|------|------|
| Active | "Edit Rule" | "Deactivate Rule" | "Delete Rule" (destructive) |
| Inactive | "Edit Rule" | "Activate Rule" | "Delete Rule" (destructive) |

**图标映射:**

| 操作 | 图标 | 颜色 |
|------|------|------|
| Edit Rule | `pencil` | text.secondary |
| Deactivate Rule | `toggle-left` | text.secondary |
| Activate Rule | `toggle-right` | text.secondary |
| Delete Rule | `trash-2` | semantic.destructive.text |

### 4.3 Pricing 表单弹窗 (PricingFormModal)

```yaml
width: 520px
maxHeight: 80vh
overflowY: auto
cornerRadius: 12
background: surface.primary
border: border.default (1px)
padding: 24
```

#### 4.3.1 Basic Info 区

```yaml
layout: vertical, gap=16
children:
  - Provider: dropdown select (从 /ai-providers/ API 读取已有 provider 列表)
    - 有数据时: <select> 下拉选择已有 provider
    - 无数据时: 回退为 <input type="text"> 手动输入
    - 编辑模式: readOnly, opacity=0.6
    - 切换 provider 时自动清空已选 model
  - Model: dropdown select (从 /ai-providers/models API 读取, 按选中 provider 过滤)
    - 有数据时: <select> 下拉选择, 显示 "{display_name} ({model_name})"
    - 无数据时: 回退为 <input type="text"> 手动输入
    - 编辑模式: readOnly, opacity=0.6
    - 选中 model 时自动填充 model_type
  - ModelType: ToggleGroup (LLM | Image | Audio)
```

**数据联动规则:**
1. Provider 下拉 → 筛选该 provider 关联的 model 列表
2. 选择 Model → 自动回填 model_type (llm/image/audio)
3. 数据来源: `aiProvidersApi.list({ owner_type: "system" })` + `aiProvidersApi.listModels()`

#### 4.3.2 Pricing Model 区

```yaml
ToggleGroup: Per Token | Fixed Request | Per Image | Per Second
```

#### 4.3.3 Rate Configuration 区

```yaml
按 pricing_model 动态显示对应价格字段:
  per_token: Input Price (per 1K tokens) + Output Price (per 1K tokens)
  fixed_request: Price per Request
  per_image: Price per Image
  per_second: Price per Second
每个字段: 带 "$" 前缀的 number input
```

#### 4.3.4 Footer

```yaml
layout: horizontal, justifyContent=flex-end, gap=8
children:
  - cancelBtn: secondaryButton "Discard" / "Cancel"
  - submitBtn: primaryButton "Create Rule" / "Update Rule"
    disabled: provider 或 model 为空时
```

---

## 5. Providers 页面 — 特有组件

### 5.1 供应商卡片列表 (ProviderList)

```yaml
width: fill_container
height: fill_container
layout: vertical, gap=16
```

### 5.2 供应商卡片 — 折叠态 (ProviderCardCollapsed)

```yaml
width: fill_container
height: 64px
cornerRadius: 12
background: surface.card
border: border.subtle (1px)
padding: [0, 20]
layout: horizontal, justifyContent=space_between, alignItems=center
```

**左侧:**
```yaml
layout: horizontal, gap=12, alignItems=center
children:
  - icon: 36×36, cornerRadius=8, bg=provider.iconBg
    - icon_font: (按 provider 对应图标), 18px, provider.iconColor (#00D1FF)
  - info: vertical, gap=2
    - name: providerCardName, text.primary
    - status: providerCardStatus
      Active: "{Active} · {N} keys", success (#4ADE80)
      Warning: "No keys configured", warning (#FEB127)
```

**右侧:**
```yaml
layout: horizontal, gap=8, alignItems=center
children:
  - editBtn: 32×32, cornerRadius=8
    - icon: pencil (lucide), 14px, text.muted
    - aria-label: "Edit {display_name}"
    - hover: bg=hoverHighlight
  - deleteBtn: 32×32, cornerRadius=8
    - icon: trash-2 (lucide), 14px, text.muted
    - aria-label: "Delete {display_name}"
    - hover: bg=hoverHighlight
  - chevron: chevron-down (lucide), 16px, text.muted
```

**交互:** 悬停: background → providerCardHover

### 5.3 供应商卡片 — 展开态 (ProviderCardExpanded)

```yaml
cornerRadius: 12
background: surface.card
border: border.subtle (1px)
overflow: hidden (clip)
layout: vertical
children:
  - CardHeader (同折叠态, chevron 改为 chevron-up)
  - KeysList
```

#### 5.3.1 KeysList (API 密钥列表)

```yaml
padding: [0, 20, 20, 20]
layout: vertical, gap=8
children:
  - KeysHeader
  - KeyTableHeader
  - KeyRow × N
```

**KeysHeader:**
```yaml
layout: horizontal, justifyContent=space_between, alignItems=center
children:
  - title: "API Keys", tableCellBold, text.secondary
  - addAction: horizontal, gap=6, alignItems=center
    - icon: plus (lucide), 12px, primary
    - text: "Add Key", keyAction, primary
```

**KeyTableHeader:**
```yaml
height: 32px
padding: [0, 12]
layout: horizontal, alignItems=center
```

| # | Key | 表头 | 宽度 |
|---|-----|------|------|
| 1 | name | NAME | 140px |
| 2 | key | KEY | 140px |
| 3 | created | CREATED | 100px |
| 4 | lastUsed | LAST USED | 100px |
| 5 | status | STATUS | 80px |
| 6 | actions | (无) | 60px |

表头文字: keyTableHeader (Space Grotesk 10px/700), text.muted, letterSpacing=0.8

#### 5.3.2 KeyRow

```yaml
height: 44px
cornerRadius: 8
background: canvas.background (#131313)
padding: [0, 12]
layout: horizontal, alignItems=center
children:
  - statusDot: 8×8, cornerRadius=4
    Active: bg=statusDotActive (#4ADE80)
    Revoked: bg=statusDotRevoked (#859399)
  - name: keyName (132px fixed-width), text.primary
  - maskedKey: keyMasked (140px fixed-width), text.muted
    format: "sk-{prefix}...{suffix}"
  - created: tableCell (100px fixed-width), text.secondary
    format: "YYYY-MM-DD"
  - lastUsed: tableCell (100px fixed-width), text.secondary
    format: relative time ("2 hours ago")
  - badge: StatusBadge (80px, Active / Revoked)
  - action: (60px)
    Active: "Revoke" text, keyAction, error
    Revoked: "—" text, text.muted
```

---

## 6. StatusBadge (复用 Phase 09 + 新增变体)

```yaml
height: 24px
padding: [4, 8]
cornerRadius: 6
layout: inline-flex, alignItems=center, justifyContent=center
font: badgeLabel (Manrope 11px/700)
```

| 变体 | 背景 | 文字颜色 |
|------|------|---------|
| Active | semantic.badge.active.bg | semantic.badge.active.text |
| Inactive | semantic.badge.inactive.bg | semantic.badge.inactive.text |
| Revoked | semantic.badge.revoked.bg | semantic.badge.revoked.text |

---

## 7. 确认弹窗 (复用 Phase 09 ConfirmationModal)

### 7.1 Quota 页面确认

| 操作 | 标题 | 确认按钮 | 样式 |
|------|------|---------|------|
| Reset Monthly | "Reset Monthly Quota" | "Reset Quota" | primary |
| Reset Daily | "Reset Daily Quota" | "Reset Quota" | primary |

### 7.2 Pricing 页面确认

| 操作 | 图标 | 标题 | 确认按钮 | 样式 |
|------|------|------|---------|------|
| Deactivate Rule | `toggle-left` | "Deactivate Rule" | "Deactivate Rule" | primary |
| Activate Rule | `toggle-right` | "Activate Rule" | "Activate Rule" | primary |
| Delete Rule | `trash-2` | "Delete Pricing Rule" | "Delete Rule" | destructive |

### 7.3 Providers 页面确认

| 操作 | 图标 | 标题 | 确认按钮 | 样式 |
|------|------|------|---------|------|
| Delete Provider | `trash-2` | "Delete Provider" | "Delete Provider" | destructive |
| Revoke Key | `key` | "Revoke API Key" | "Revoke Key" | destructive |

---

## 8. Toast 消息 (Sonner)

### 8.1 Quota

| 操作 | 成功 | 失败 |
|------|------|------|
| Save quota | "配额已更新" | "配额更新失败: {error}" |
| Reset monthly | "月度用量已重置" | "重置失败: {error}" |
| Reset daily | "日度用量已重置" | "重置失败: {error}" |

### 8.2 Pricing

| 操作 | 成功 | 失败 |
|------|------|------|
| Create rule | "定价规则已创建" | "创建失败: {error}" |
| Update rule | "定价规则已更新" | "更新失败: {error}" |
| Deactivate | "规则已停用" | "操作失败: {error}" |
| Activate | "规则已启用" | "操作失败: {error}" |
| Delete | "定价规则已删除" | "删除失败: {error}" |

### 8.3 Providers

| 操作 | 成功 | 失败 |
|------|------|------|
| Add provider | "供应商已添加" | "添加失败: {error}" |
| Edit provider | "供应商已更新" | "更新失败: {error}" |
| Delete provider | "供应商已删除" | "删除失败: {error}" |
| Add key | "API 密钥已添加" | "添加失败: {error}" |
| Revoke key | "API 密钥已撤销" | "撤销失败: {error}" |

---

## 9. 骨架加载 (SkeletonRow)

### 9.1 Quota 骨架

```yaml
count: 5 rows
rowHeight: 72px
animation: pulse 1.5s infinite
barWidths:
  name: 140px
  meta: 180px
  usageNumber: 48px
  usageUnit: 80px
  chevron: 16px
```

### 9.2 Pricing 骨架

复用 Phase 09 SkeletonRow (rowHeight=48, 同列宽)。

### 9.3 Providers 骨架

```yaml
count: 3 cards
cardHeight: 64px
cornerRadius: 12
animation: pulse 1.5s infinite
barWidths:
  icon: 36px
  name: 120px
  status: 80px
```

---

## 10. 空状态 (EmptyState)

| 场景 | 图标 | 标题 | 正文 | CTA |
|------|------|------|------|-----|
| Quota 无用户 | `users` | "No users found" | "Users will appear here once they register." | — |
| Quota 无团队 | `group` | "No teams found" | "Teams will appear here once they are created." | — |
| Pricing 无规则 | `credit-card` | "No pricing rules" | "Create your first pricing rule to start." | "Create Pricing Rule" |
| Providers 无供应商 | `settings` | "No providers configured" | "Add a provider to start managing API keys." | "Add Provider" |

---

## 11. 错误状态 (ErrorState)

```yaml
layout: 同 EmptyState
icon: alert-circle (lucide), 48px, destructive.text 50% opacity
heading: emptyHeading, text.primary
body: emptyBody, text.muted
CTA: "Retry" — Phase 08 primary 按钮
```

| 场景 | 标题 | 正文 |
|------|------|------|
| Quota 加载失败 | "Failed to load quotas" | "Something went wrong. Please try again." |
| Pricing 加载失败 | "Failed to load pricing rules" | "Something went wrong. Please try again." |
| Providers 加载失败 | "Failed to load providers" | "Something went wrong. Please try again." |

---

## 12. 设计决策说明

1. **双 Tab 切换 (Quota)** — Users/Teams 两个视图结构不同，分开展示更清晰
2. **可展开行 (Quota)** — 替代弹窗，配额编辑保持上下文一致
3. **双列并排 (Quota Detail)** — Monthly/Daily 限额并排显示，进度条更紧凑，参考 Stitch 设计
4. **大号数字 (Quota)** — 用量数字用 18–20px Space Grotesk Bold 突出展示，一目了然
5. **Summary Cards (Pricing)** — 顶部概览卡片提供 provider 级别快速摘要
6. **卡片展开 (Providers)** — 每个 provider 独立卡片，展开后显示 API 密钥表格
7. **密钥详情表 (Providers)** — Key 行包含名称、脱敏密钥、创建时间、最后使用、状态，信息密度高
8. **复用 Phase 09 组件** — ConfirmationModal、StatusBadge、RowDropdownMenu 等直接复用

---

*基于 Pencil 设计 (pencil-new.pen, Frame zXqUs, ASIoH, E1Z09)*
*Phase 08/09 设计继承: AdminShell 布局 + 色彩系统 + 组件库*
*设计日期: 2026-04-01*
