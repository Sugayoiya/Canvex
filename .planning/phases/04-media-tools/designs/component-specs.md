# Canvas V4 组件规格 (Component Specs)

> 供 AI 编码时直接引用的结构化规格，配合 `design-tokens.json` 使用。
> 所有颜色引用格式: `tokens.themes.{dark|light}.{path}`

---

## 1. 画布 (Canvas)

- **尺寸**: 无限画布，viewport 默认 1440×900
- **背景**: `canvas.background`
- **网格点**: 间距 40px，尺寸 2×2px，颜色 `canvas.gridDot`
- **缩放**: 支持 25%–400%，滚轮缩放 + 触控板手势

---

## 2. 左侧悬浮菜单 (LeftFloatingMenu)

```yaml
position: { x: 24, y: center-vertically }
width: 48px
layout: vertical, gap=4, padding=[8, 0]
background: surface.overlay
cornerRadius: 14
border: border.subtle (1px)
effects:
  - shadow: shadow.lg
  - background_blur: radius=20
```

### 菜单项

| 序号 | 图标 | 功能 | 背景 | 边框 |
|------|------|------|------|------|
| 1 | `plus` (18px) | 新建节点 | surface.primary + border.default | 有 |
| — | 分割线 | — | border.default | — |
| 2 | `git-branch` (16px) | 工作流视图 | 无 | 无 |
| 3 | `package` (16px) | 资产库 | 无 | 无 |
| 4 | `history` (16px) | 历史版本 | 无 | 无 |
| 5 | `info` (16px) | 帮助 | 无 | 无 |
| 6 | 头像字母 (11px) | 用户头像 | surface.primary | 无 |

- 每个按钮: 36×36px, cornerRadius=10
- 图标颜色: `text.muted` (默认), `text.primary` (激活)
- 新建按钮 (+): 图标色 `text.primary`，有背景和边框

---

## 3. 素材节点 (MaterialNode)

四种类型共享同一卡片结构，仅图标/内容区不同。

### 3.1 卡片容器

```yaml
width: 280–340px (可拖拽调整)
layout: vertical
background: surface.primary
cornerRadius: 12
border: border.default (1px, 默认) / border.focused (1.5px, 聚焦)
shadow: shadow.md (默认) / shadow.lg (聚焦)
```

### 3.2 标题行 (NodeHeader)

```yaml
padding: [12, 16]
layout: horizontal, gap=8, alignItems=center
children:
  - icon: 对应类型图标, 14px, text.muted
  - title: "类型名 + ID后缀", nodeTitle, text.secondary
  - spacer: flex
  - gripIcon: grip-horizontal, 14px, text.disabled
```

### 3.3 内容区 (NodeContent)

**空状态:**

```yaml
height: 100–140px
background: surface.secondary
alignItems: center, justifyContent: center
children:
  - icon: 对应类型图标, 28px, text.disabled
```

**有内容状态 — 文本:**

```yaml
height: fill
padding: [12, 16]
layout: horizontal, gap=12
children:
  - leftBorder: 3px wide, text.disabled (60% opacity), cornerRadius=2
  - textContent: vertical layout, gap=8
    - 标题行: nodeContentTitle, text.primary
    - 正文行: nodeContent, text.secondary / text.muted
```

**有内容状态 — 图片:**

```yaml
height: fill
background: surface.code (或渐变占位)
clip: true
children:
  - 图片预览 (fill)
  - 或: 渐变占位 + 图标(mountain, 32px) + 描述文字
```

### 3.4 提示行 (NodeHints) — 仅空状态显示

```yaml
padding: [12, 16]
layout: vertical, gap=8
children:
  - 每行: "尝试: xxx", nodeHint, text.disabled
```

### 3.5 底部行 (NodeFooter) — 仅有内容状态显示

```yaml
padding: [8, 16]
layout: horizontal, alignItems=center
children:
  # 图片节点:
  - modelText: metadata, text.disabled
  - spacer: flex
  - ratioText: metadata, text.disabled
  # 文本节点:
  - spacer: flex
  - editIcon: pen-line, 14px, text.disabled
```

### 3.6 四种节点类型差异

| 属性 | 文本 | 图片 | 视频 | 音频 |
|------|------|------|------|------|
| 图标 | `file-text` | `image` | `play-circle` | `music` |
| 默认宽度 | 280px | 340px | 340px | 280px |
| 内容区高度(空) | 100px | 130px | 140px | 100px |
| 提示行示例 | "用AI生成一段脚本" | "拍摄/上传/AI生成" | "AI生成/上传视频" | "AI配音/上传音效" |

---

## 4. 文本编辑工具栏 (TextToolbar)

> 聚焦**有内容**的文本节点时，浮动在**节点上方**。

```yaml
position: 节点上方 8px, 水平居中对齐
direction: above  # 有内容节点的面板统一在上方
width: 310px, height: 36px
background: surface.primary
cornerRadius: 10
border: border.default (1px)
shadow: shadow.sm
layout: horizontal, gap=4, padding=[4, 8], alignItems=center
```

### 按钮列表

| 按钮 | 类型 | 内容 | 大小 | 默认色 | 选中态 |
|------|------|------|------|--------|--------|
| H1 | text | "H1" | 28×28, r=6 | text.secondary (dark) / muted (light) | text.primary + 无背景 |
| H2 | text | "H2" | 同上 | 同上 | — |
| H3 | text | "H3" | 同上 | 同上 | — |
| ¶ | icon | `pilcrow` 14px | 同上 | — | text.primary + activeHighlight 背景 |
| B | text | "B" bold | 同上 | 同上 | — |
| I | text | "I" italic | 同上 | 同上 | — |
| \| | divider | — | 1×16px | border.divider | — |
| ≡ | icon | `list` 14px | 同上 | 同上 | — |
| 1. | icon | `list-ordered` 14px | 同上 | 同上 | — |
| \| | divider | — | 1×16px | border.divider | — |
| — | icon | `minus` 14px | 同上 | 同上 | — |
| ⊡ | icon | `copy` 14px | 同上 | 同上 | — |
| ↗ | icon | `maximize-2` 14px | 同上 | 同上 | — |

---

## 5. AI 生成面板 (AIGeneratePanel)

> 聚焦**空节点（无内容）**时，浮动在**节点下方**。

```yaml
position: 节点下方 12px, 左对齐
direction: below  # 空节点的 AI 生成面板统一在下方
width: 460px
background: surface.elevated
cornerRadius: 16
border: border.default (1px)
shadow: shadow.lg (dark) / shadow.md (light)
layout: vertical
```

### 5.1 标签行 (Tags)

```yaml
padding: [12, 16, 8, 16]
layout: horizontal, gap=8, alignItems=center
children:
  - tag[]: { cornerRadius=8, bg=surface.primary, padding=[8,12], gap=4 }
    - icon: 14px, text.secondary
    - text: tag, text.secondary
  - spacer: flex
  - expandIcon: maximize-2, 16px, text.disabled
```

预设标签: `[palette]风格` / `[map-pin]标记` / `[target]聚焦`

### 5.2 输入区 (Input)

```yaml
padding: [8, 16, 12, 16]
children:
  - placeholder: inputPlaceholder, text.placeholder
    content: "描述你想要生成的画面内容，按/呼出指令，@引用素材"
```

### 5.3 底部操作栏 (BottomBar)

```yaml
padding: [8, 16, 12, 16]
layout: horizontal, gap=8, alignItems=center
children:
  - modelSelector: { cornerRadius=8, bg=surface.primary, padding=[8,12] }
    - icon: sparkles, 12px, text.secondary
    - text: "Lib Nano Pro", 12px, text.secondary
    - chevron: chevron-down, 10px, text.disabled
  - ratioSelector: 同结构, text="16:9 · 2K"
  - cameraSelector: 同结构, icon=camera, text="摄像机控制"
  - spacer: flex
  - count: "1张", 12px, text.secondary + chevron
  - divider: 1×16px, border.divider
  - tokenIcon: zap, 12px, text.disabled
  - tokenCount: "14", 12px, text.disabled
  - sendButton: 30×30px, cornerRadius=8
    - bg: interactive.buttonPrimary
    - icon: arrow-up, 16px, interactive.buttonPrimaryText
```

---

## 6. 模板功能菜单 (TemplateMenu)

> 聚焦**有内容**的图片/视频/音频节点时，浮动在**节点上方**。

```yaml
position: 节点上方 12px
direction: above  # 有内容节点的面板统一在上方
width: 350–380px, height: ~80px
background: surface.elevated
cornerRadius: 14
border: border.default (1px)
shadow: shadow.lg (dark) / shadow.md (light)
padding: [12, 16]
layout: vertical, gap=8
```

### 标题行

```yaml
layout: horizontal, gap=8, alignItems=center
children:
  - icon: sparkles, 12px, text.secondary
  - label: "模板功能", 12px/700, text.secondary
  - spacer: flex
  - link: "查看全部 ›", 9px, text.disabled
```

### 模板标签行

```yaml
layout: horizontal, gap=8
children:
  - chip[]: { cornerRadius=8, bg=surface.primary, border=border.default, padding=[8,12], gap=4 }
    - icon: 对应图标, 12px, text.muted (90% opacity)
    - text: templateChip, text.secondary
```

预设模板 (图片节点):
| 图标 | 名称 | Skill |
|------|------|-------|
| `layout-grid` | 九宫格场景 | visual.grid_scene |
| `user` | 角色三视图 | visual.character_triview |
| `palette` | 风格迁移 | visual.style_transfer |
| `video` | 图生视频 | video.img_to_video |

---

## 7. AI 对话弹窗 (AIChatPopup)

```yaml
position: 画布右侧, x=canvas.width-400, y=80
width: 400px, height: 805px
background: surface.popup
cornerRadius: 20
border: border.default (1px)
shadow: shadow.xl
clip: true
layout: vertical
effects:
  - background_blur: radius=24
```

### 7.1 头部 (Header)

```yaml
padding: [16, 20]
borderBottom: border.subtle (1px)
layout: horizontal, gap=12, alignItems=center
children:
  - avatar: 32×32, cornerRadius=10, bg=surface.primary
    - icon: bot, 16px, text.secondary
  - info: vertical, gap=1
    - title: "Cinematic AI", chatTitle, text.primary
    - subtitle: "Canvas Agent", chatSubtitle, text.muted (90%)
  - spacer
  - minimizeBtn: minus, 14px, text.disabled
  - closeBtn: x, 14px, text.disabled
```

### 7.2 消息区 (Body)

```yaml
padding: [16, 20]
layout: vertical, gap=16
flex: 1 (填满剩余空间)
overflow: scroll
```

**用户消息:**
```yaml
alignItems: end (右对齐)
bubble:
  bg: surface.secondary
  cornerRadius: [12, 2, 12, 12]
  padding: [12, 16]
  text: chatMessage, text.primary
timestamp: metadata, text.placeholder
```

**AI 消息:**
```yaml
alignItems: start (左对齐)
statusLine:
  icon: zap, 11px, text.secondary
  text: "EXECUTING", statusLabel, text.secondary
bubble:
  bg: surface.elevated
  cornerRadius: [2, 12, 12, 12]
  border: border.faint (1px)
  padding: [12, 16]
  children:
    - text: chatMessage, text.secondary
    - codeBlock:
        bg: surface.code
        cornerRadius: 8
        border: border.faint
        padding: 12
        text: code, text.muted (90%)
```

**进度条:**
```yaml
layout: horizontal, gap=8, alignItems=center
children:
  - trackBg: fill, h=3, cornerRadius=2, bg=surface.primary
  - trackFill: w=120, h=3, gradient(text.secondary → text.disabled)
  - label: "2/5", metadata/600, text.disabled
```

### 7.3 输入区 (InputArea)

```yaml
borderTop: border.subtle (1px)
padding: [12, 20, 16, 20]
children:
  - textArea: (layout=none, 自由定位)
    width: fill, height: 80px
    bg: surface.code (浅) / surface.elevated (深)
    cornerRadius: 12
    border: border.default (light only)
    children:
      - uploadBtn: 28×28, cornerRadius=7, bg=surface.secondary
        position: top-left (x=10, y=8)
        icon: paperclip, 14px, text.disabled
      - placeholder: "描述你的创作意图...", chatMessage, text.placeholder
        position: (x=46, y=14)
      - micBtn: 28×28, cornerRadius=7, bg=surface.secondary
        position: bottom-right-1 (x=310, y=42)
        icon: mic, 14px, text.disabled
      - sendBtn: 28×28, cornerRadius=7
        position: bottom-right-0 (x=342, y=42)
        bg: interactive.buttonPrimary
        shadow: shadow.sm
        icon: arrow-up, 14px, interactive.buttonPrimaryText
```

---

## 8. 连接线 (ConnectionLine)

```yaml
stroke: border.focused (1px)
style: 贝塞尔曲线 (ReactFlow 默认)
```

节点间连接指示线 (toolbar↔node, node↔templateMenu):
```yaml
stroke: border.focused (1px)
长度: 4–10px, 垂直方向
```

---

## 9. 主题切换映射表

> 用于 CSS 变量或 Tailwind 主题配置

| Token Path | Dark | Light |
|---|---|---|
| `canvas.background` | `#131313` | `#F5F5F5` |
| `surface.primary` | `#2A2A2A` | `#FFFFFF` |
| `surface.secondary` | `#353534` | `#EBEBEB` |
| `surface.elevated` | `#201F1F` | `#FFFFFF` |
| `surface.overlay` | `#1C1B1BDD` | `#FFFFFFEE` |
| `surface.popup` | `#1C1B1B` | `#FFFFFF` |
| `surface.code` | `#0E0E0E` | `#F0F0F0` |
| `text.primary` | `#E5E2E1` | `#1A1A1A` |
| `text.secondary` | `#BBC9CF` | `#4A5A62` |
| `text.muted` | `#859399` | `#7A8A92` |
| `text.placeholder` | `#85939930` | `#9AA5AD40` |
| `text.disabled` | `#85939960` | `#9AA5AD80` |
| `border.default` | `#3c494e20` | `#D0D0D040` |
| `border.subtle` | `#3c494e15` | `#D0D0D030` |
| `border.focused` | `#E5E2E130` | `#1A1A1A15` |
| `border.divider` | `#3c494e40` | `#D0D0D060` |
| `interactive.buttonPrimary` | `#E5E2E1` | `#1A1A1A` |
| `interactive.buttonPrimaryText` | `#131313` | `#FFFFFF` |

---

## 10. 聚焦面板定位规则 (Focus Panel Positioning)

> 核心交互原则：**有内容 → 上方，无内容 → 下方**

| 节点状态 | 节点类型 | 弹出面板 | 弹出方向 | 间距 |
|---------|---------|---------|---------|------|
| 空（无内容） | 所有类型 | AI 生成面板 (AIGeneratePanel) | **节点下方 ↓** | 12px |
| 有内容 | 文本 (text) | 文本编辑工具栏 (TextToolbar) | **节点上方 ↑** | 8px |
| 有内容 | 图片 (image) | 模板功能菜单 (TemplateMenu) | **节点上方 ↑** | 12px |
| 有内容 | 视频 (video) | 模板功能菜单 (TemplateMenu) | **节点上方 ↑** | 12px |
| 有内容 | 音频 (audio) | 模板功能菜单 (TemplateMenu) | **节点上方 ↑** | 12px |

### 定位算法

```typescript
function getPanelPosition(node: Node, panelHeight: number): { x: number; y: number } {
  const hasContent = node.data.resultText || node.data.resultUrl;

  if (hasContent) {
    // 有内容 → 面板在节点上方
    return {
      x: node.position.x,
      y: node.position.y - panelHeight - GAP_ABOVE, // 8-12px
    };
  } else {
    // 无内容 → 面板在节点下方
    return {
      x: node.position.x,
      y: node.position.y + nodeHeight + GAP_BELOW, // 12px
    };
  }
}
```
