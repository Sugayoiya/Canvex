# Canvas V5 节点重设计规格 (Node Redesign Component Specs)

> 基于 Phase 04 设计系统，配合 `../04-media-tools/designs/design-tokens.json` 使用。
> 所有颜色引用格式: `tokens.themes.{dark|light}.{path}`

---

## 核心变更：去掉 NodeHeader 横条

**V4 → V5 改动：**
- 移除节点卡片内的 NodeHeader（标题行）
- 节点类型图标 + 名称移至节点卡片**上方外侧**
- 节点卡片本体仅包含内容区
- 上方功能菜单与节点**居中对齐**

---

## 1. 节点标签 (NodeLabel) — 框外上方

```yaml
position: 节点上方 8px, 左对齐于节点左边缘
layout: horizontal, gap=6, alignItems=center
children:
  - icon: 对应类型图标, 14px, text.muted
  - title: "类型名 [+ 序号]", 12px, Space Grotesk, text.muted
```

| 节点类型 | 图标 | 默认标签 |
|---------|------|---------|
| 文本 | `file-text` | 文本节点 N |
| 图片 | `image` | 图片 |
| 视频 | `circle-play` | 视频节点 N |
| 音频 | `music` | 音频节点 N |

---

## 2. 节点卡片容器 (NodeCard) — V5

```yaml
width: 280–340px (同 V4)
layout: 按类型不同
background: surface.primary
cornerRadius: 12
border: border.default (1px, 默认) / border.focused (1.5px, 聚焦)
shadow: shadow.md (默认) / shadow.lg (聚焦)
```

**与 V4 的区别：** 无 NodeHeader 行，卡片顶部直接是内容区。

---

## 3. 图片节点上方功能菜单 (ImageToolbar)

```yaml
position: 节点上方 8px, 与节点水平居中对齐
width: fit_content (~596px)
height: 36px
background: surface.elevated
cornerRadius: 10
border: border.default (1px)
shadow: shadow.sm
layout: horizontal, gap=4, padding=[4, 8], alignItems=center
```

### 按钮分两组

**左侧 — 模板功能（图标+文字）：**

| 序号 | 图标 | 名称 | Skill |
|------|------|------|-------|
| 1 | `HD` (文字) | 高清 | visual.upscale |
| 2 | `expand` | 扩图 | visual.outpaint |
| 3 | `rotate-3d` | 多角度 | visual.multiview |
| 4 | `sun` | 打光 | visual.relight |
| 5 | `pencil` | 重绘 | visual.inpaint |
| 6 | `eraser` | 擦除 | visual.erase |
| 7 | `scissors` | 抠图 | visual.segment |

每个按钮: `frame, layout=horizontal, gap=4, padding=[4,8], cornerRadius=6, height=28`
- 图标: 12px, text.secondary
- 文字: 11px, Manrope, text.secondary

**分隔线：** `rectangle, 1×16px, border.divider`

**右侧 — 通用功能（纯图标）：**

| 图标 | 功能 |
|------|------|
| `grid-3x3` | 九宫格划分 |
| `pen-tool` | 画笔标注 |
| `crop` | 裁剪 |
| `download` | 下载 |
| `maximize-2` | 放大预览 |

每个按钮: `frame, 28×28px, cornerRadius=6, padding=[4,6], alignItems=center, justifyContent=center`
- 图标: 14px, text.secondary

---

## 4. 视频节点上方功能菜单 (VideoToolbar)

```yaml
position: 节点上方 8px, 与节点水平居中对齐
width: fit_content (~80px)
height: 36px
background: surface.elevated
cornerRadius: 10
border: border.default (1px)
shadow: shadow.sm
layout: horizontal, gap=6, padding=[4, 8], alignItems=center
```

### 按钮

| 内容 | 类型 | 功能 |
|------|------|------|
| `2x` | 文字按钮 | 倍速控制 |
| `download` | 图标按钮 | 下载 |

---

## 5. 音频节点 (AudioNode) — V5 新设计

```yaml
width: 340px
height: 180px (紧凑，无多余底部空间)
cornerRadius: 12
background: surface.primary
border: border.focused (1.5px, 聚焦态)
shadow: shadow.lg
layout: vertical, gap=12, padding=[16, 16]
```

### 5.1 波形区 (Waveform)

```yaml
width: fill_container
height: 100px
background: surface.secondary
cornerRadius: 8
clip: true
layout: none
children:
  - waveformBars: 竖条组(用 CSS 或 canvas 渲染，非 .pen 管)
  - playhead: rectangle, 2px wide, fill=#FF3B30 (红色), full height
  - uploadButton: 30×30px, cornerRadius=15, border=text.disabled(60%), 右侧居中
    - icon: arrow-up-from-line, 14px, text.muted
```

### 5.2 控制行 (Controls)

```yaml
width: fill_container
height: fit_content
layout: horizontal, gap=16, alignItems=center, justifyContent=center
children:
  - timeText: "00:07 / 00:12", 13px, Space Grotesk, text.muted
  - playButton: 36×36px, cornerRadius=18, bg=surface.secondary
    - icon: play, 16px, text.primary
```

### 5.3 音频节点上方功能菜单 (AudioToolbar)

与视频节点相同结构: `2x` + `download`

---

## 6. 文本节点 (TextNode) — 不变

与 V4 一致，仅移除 NodeHeader，内容区直接包含文本。

```yaml
width: 280px
cornerRadius: 12
background: surface.primary
border: border.default (1px)
shadow: shadow.md
layout: vertical, padding=[16, 16]
children:
  - textContent: 13px, Manrope, lineHeight=1.6, text.primary
```

---

## 7. 工具栏定位规则 (Toolbar Positioning) — V5

**核心变更：** 所有上方工具栏与节点**水平居中对齐**，而非左对齐。

```typescript
function getToolbarPosition(node: Node, toolbarWidth: number): { x: number; y: number } {
  const nodeCenter = node.position.x + node.width / 2;
  return {
    x: nodeCenter - toolbarWidth / 2,
    y: node.position.y - TOOLBAR_HEIGHT - GAP_ABOVE, // 8px gap
  };
}
```

| 节点类型 | 工具栏宽度 | 对齐方式 |
|---------|-----------|---------|
| 图片 | ~596px | 居中（可能超出节点两侧） |
| 视频 | ~80px | 居中 |
| 音频 | ~68px | 居中 |
| 文本(有内容) | ~310px (TextToolbar, 沿用 V4) | 居中 |

---

## 8. 节点标签定位规则 (Label Positioning)

```typescript
function getLabelPosition(node: Node): { x: number; y: number } {
  return {
    x: node.position.x, // 左对齐于节点
    y: node.position.y - LABEL_HEIGHT - GAP_LABEL, // 8px gap
  };
}
```

标签始终左对齐于节点左边缘。

---

*基于 Canvas V5 Node Redesign (pencil-new.pen, Frame 54PdO)*
*设计日期: 2026-03-30*
