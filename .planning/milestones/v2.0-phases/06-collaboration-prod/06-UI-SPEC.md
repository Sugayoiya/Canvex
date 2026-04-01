# Phase 06: Collaboration + Production — UI Design Specification

**Phase:** 06-collaboration-prod
**Created:** 2026-03-30
**Design Source:** Stitch project `13144963552008146136` (Refined screens)
**Design System:** "The Obsidian Lens" — extends Phase 04/05 Canvas V4/V5

---

## 1. Design Overview

### 1.1 Creative Direction

品牌名 **"Obsidian Lens"**，定位 **"Cinematic Production Suite"**。设计哲学延续 Phase 04/05 的 "The Cinematic Canvas" 理念：UI 应像高端摄影机体一样——专业、克制、让内容成为主角。

Phase 06 将设计语言从画布工作台扩展到管理面板，引入以下视觉增强：

- **赛博青 `#00D1FF`** 作为品牌主色（替代画布中的中性白按钮）
- **毛玻璃卡片 (Glassmorphism)** 取代实心背景卡片
- **点阵网格背景** 贯穿所有页面，增强"科幻控制台"氛围
- **Material Symbols** 图标系统（管理页面），与画布的 Lucide 图标互补

### 1.2 设计文件清单

| 文件 | 说明 |
|------|------|
| `designs/design-tokens.json` | 统一设计令牌（Dark + Light，桥接 Phase 04/05） |
| `designs/component-specs.md` | 组件结构化规格（YAML 格式，供编码引用） |
| **V2 版本（最新，以此为准）** | |
| `designs/01-project-dashboard-v2.png` | 项目中心截图（V2 — 简洁网格布局） |
| `designs/02-team-management-v2.png` | 团队管理截图（V2 — 纯表格布局） |
| `designs/03-ai-console-v2.png` | AI 控制台截图（V2 — Provider 卡片 + 计费概览） |
| `designs/04-auth-v2.png` | 登录与认证截图（V2 — 中性色调按钮） |
| **Refined 版本（参考）** | |
| `designs/01-project-dashboard-refined.png` | 项目中心截图（Refined — 特色项目布局） |
| `designs/01-project-dashboard-refined.html` | 项目中心 HTML 参考实现 |
| `designs/02-team-management-refined.png` | 团队管理截图（Refined — 组织树 + 表格） |
| `designs/02-team-management-refined.html` | 团队管理 HTML 参考实现 |
| `designs/03-ai-console-refined.png` | AI 配置与计费截图（Refined — 复合面板） |
| `designs/03-ai-console-refined.html` | AI 配置与计费 HTML 参考实现 |
| `designs/04-auth-refined.png` | 登录与认证截图（Refined — 青色按钮） |
| `designs/04-auth-refined.html` | 登录与认证 HTML 参考实现 |

---

## 2. Design Tokens Summary

> 完整令牌定义见 `designs/design-tokens.json`

### 2.1 色彩体系 (Dark Mode)

```
Surface 层级 (从深到浅):
  base:              #0E0E0E  ← 页面底色
  containerLowest:   #080808  ← 最深嵌套
  containerLow:      #111111  ← 侧边栏/面板底色
  container:         #141414  ← 中间层
  containerHigh:     #1A1A1A  ← 卡片/输入框
  containerHighest:  #222222  ← 弹出/下拉
  bright:            #2A2A2A  ← 高亮元素

Accent 色彩:
  primary:           #00D1FF  ← 品牌青 (CTA、链接、激活态)
  primaryGradient:   #00D1FF → #0087A3 (135°)
  tertiary:          #FFD59C  ← 暖金 (次要指标、警告)
  error:             #FFB4AB  ← 错误

Text 色彩:
  primary:           #E5E2E1  ← 正文
  secondary:         #BBC9CF  ← 辅助
  muted:             #8E9192  ← 次要
  onPrimary:         #000000  ← 主按钮文字
```

### 2.2 Typography

| 级别 | 字体 | 大小 | 权重 | 用途 |
|------|------|------|------|------|
| displayMd | Space Grotesk | 36px | 700 | 页面标题 |
| headlineMd | Space Grotesk | 24px | 700 | 区块标题 |
| titleMd | Manrope | 16px | 600 | 卡片标题 |
| bodyMd | Manrope | 13px | 400 | 正文内容 |
| labelMd | Space Grotesk | 10px | 700 | 标签 (大写+宽字距) |
| labelSm | Space Grotesk | 9px | 700 | 元数据标签 |

### 2.3 关键视觉效果

| 效果 | 实现 |
|------|------|
| 毛玻璃卡片 | `bg: rgba(18,18,18,0.8); backdrop-filter: blur(12px); border: rgba(255,255,255,0.08)` |
| 点阵背景 | `background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0); background-size: 24px 24px` |
| 品牌辉光 | `box-shadow: 0 0 8px #00D1FF` (状态点), `0 0 32px rgba(0,209,255,0.3)` (FAB) |
| 主按钮渐变 | `background: linear-gradient(135deg, #00D1FF 0%, #0087A3 100%)` |
| 登录卡辉光 | `box-shadow: 0 0 40px -10px rgba(0,209,255,0.15)` |

---

## 3. Page Specifications

### 3.1 项目中心 (Project Dashboard)

**路由:** `/projects`
**布局:** AppShell (侧边栏 + 顶栏 + 内容区)
**设计参考:** `designs/01-project-dashboard-v2.png`

**关键区域:**

| 区域 | 位置 | 内容 |
|------|------|------|
| 面包屑 + 搜索 | 顶栏 | `Home > Projects` 面包屑导航, 搜索框, 通知图标, 用户头像 |
| 页面标题 | 内容区顶部 | "Project Dashboard" + 摘要 (如 "12 active projects · 3 team members") + "New Project" 按钮 |
| 项目卡网格 | 内容区主体 | 3 列等宽网格，每卡含缩略图 + 项目名 + 集数 + 更新时间 + 状态徽章 |
| 新建卡 | 网格末位 | 虚线边框 + "+" 图标 + "Create New" 空状态卡 |
| 统计条 | 内容区底部 | 4 张统计卡 (Frames Generated / Storyboards / AI Uptime / Credits Used) |

**数据映射:**
- 项目列表 → `GET /api/v1/projects` (按 `owner_type`/`owner_id` 过滤)
- 统计数据 → `GET /api/v1/quota/summary` (新增统计字段)
- 侧边栏空间切换 → `auth-store.currentTeam` / personal

**项目卡结构:**
```
┌─────────────────────────┐
│  [缩略图 w=100% h=160]  │
├─────────────────────────┤
│  项目名 (titleMd)       │
│  X episodes · Updated Xd ago  │
│  ● 状态徽章 (In Production / Pre-Production / Draft / On Hold)  │
└─────────────────────────┘
```

**状态徽章颜色:**
| 状态 | 颜色 |
|------|------|
| In Production | `accent.primary` (#00D1FF) |
| Pre-Production | `accent.primary` (#00D1FF) |
| Draft | `text.muted` (#8E9192) |
| On Hold | `text.muted` (#8E9192) |

**统计卡结构:**
每张统计卡包含大号数字 (headlineMd) + 描述标签 (bodySm, text.muted)，使用 glass card 样式。

**交互:**
- 侧边栏显示当前团队名 (如 "Cyanide Studio / TEAM SPACE") 作为空间标识
- 项目卡 hover 时缩略图轻微放大 + 边框高亮 (300ms transition)
- 点击项目卡进入项目详情 `/projects/[id]`
- "New Project" 按钮 (outline 样式) 弹出项目创建 dialog
- "Create New" 空状态卡点击同 "New Project"

### 3.2 团队管理 (Team & Roles)

**路由:** `/teams/[id]`
**布局:** AppShell
**设计参考:** `designs/02-team-management-v2.png`

**关键区域:**

| 区域 | 位置 | 内容 |
|------|------|------|
| 面包屑 | 顶栏 | `Home > Team & Roles` |
| 页面标题 | 内容区顶部 | "Team & Roles" + 副标题 "Manage members and permissions" + "Invite Member" 按钮 |
| 成员表格 | 内容区主体 | 全宽表格，列: MEMBER / ROLE / GROUP / STATUS |

**数据映射:**
- 成员列表 → `GET /api/v1/teams/{id}/members`
- 搜索用户 → `GET /api/v1/users/search?q=`
- 邀请链接 → `POST /api/v1/teams/{id}/invitations`

**表格列定义:**

| 列名 | 宽度 | 内容 |
|------|------|------|
| MEMBER | ~40% | 头像 (32px 圆形) + 姓名 (titleSm) + 邮箱 (bodySm, text.muted) |
| ROLE | ~15% | 角色徽章 (filled badge) |
| GROUP | ~25% | 所属小组名 (如 "Production A", "All Groups") |
| STATUS | ~20% | 状态点 + 状态文字 |

**角色徽章样式:**
| 角色 | 背景色 | 文字色 | 边角 |
|------|------|------|------|
| Owner | `surface.containerHighest` | `text.primary` | rounded-md |
| Admin | `surface.containerHighest` | `text.primary` | rounded-md |
| Editor | `surface.containerHighest` | `text.primary` | rounded-md |
| Viewer | `surface.containerHighest` | `text.muted` | rounded-md |

**状态显示:**
| 状态 | 样式 |
|------|------|
| Active | 绿点 (`semantic.success`) + "Active" 文字 |
| Pending | 黄点 (`accent.tertiary`) + "Pending" 文字 |
| Inactive | 灰点 (`text.muted`) + "Inactive" 文字 |

**交互:**
- "Invite Member" 按钮 (outline 样式) 弹出邀请 dialog（链接邀请 / 用户搜索直邀）
- 角色徽章可点击触发下拉菜单修改角色（需 admin+ 权限）
- 表格行 hover 高亮
- 支持按角色/状态筛选

### 3.3 AI 控制台 (AI Console)

**路由:** `/settings/ai`
**布局:** AppShell
**设计参考:** `designs/03-ai-console-v2.png`

**关键区域:**

| 区域 | 位置 | 内容 |
|------|------|------|
| 面包屑 | 顶栏 | `Home > AI Console` |
| 页面标题 | 内容区顶部 | "AI Console" + 副标题 "Model providers, billing & usage" + "Add Provider" 按钮 |
| Provider 卡片 | 3 列网格 | 每个 Provider 一张卡（图标 + 名称 + 状态 + 模型标签 + 用量条 + 费用） |
| 计费概览 | 全宽 4 列 | 4 张统计卡: Total Spend / API Calls / Service Health / Monthly Budget |

**数据映射:**
- Provider 列表 → `GET /api/v1/ai-providers` (带 team_id 过滤)
- 模型列表 → `GET /api/v1/ai-models`
- 用量/计费 → `GET /api/v1/quota/summary` (扩展)

**Provider 卡片结构:**
```
┌──────────────────────────────┐
│  [图标] Provider Name  ● Active │
│                              │
│  [Model Tag] [Model Tag] ... │
│                              │
│  Usage this month   $42.80/$100 │
│  ████████░░░░░░ (进度条)       │
└──────────────────────────────┘
```

**Provider 状态:**
| 状态 | 颜色 | 样式 |
|------|------|------|
| Active | `semantic.success` | 绿色圆点 + "Active" 文字 |
| Inactive | `text.muted` | 灰色圆点 + "Inactive" 文字 |

**模型标签:**
小型 pill/badge 样式（`surface.containerHighest` 背景），显示该 Provider 下的可用模型名（如 "GPT-4o", "DALL-E 3", "Whisper"）。

**用量进度条:**
- 背景: `surface.containerHigh`
- 填充: `accent.primary` 渐变
- 超出 80% 时填充变为 `accent.tertiary`

**计费概览统计卡:**
| 指标 | 示例值 | 图标/格式 |
|------|--------|----------|
| Total Spend This Month | $61.00 | 金额 (headlineMd) |
| API Calls | 1,847 | 数字 (headlineMd) |
| Service Health | 99.8% | 百分比 (headlineMd) |
| Monthly Budget | $150 | 金额 (headlineMd) |

**交互:**
- "Add Provider" 按钮 (outline 样式) 弹出新增 Provider dialog
- Provider 卡片点击展开详情/编辑 Key
- 无用量数据的 Provider 不显示进度条（如 DeepSeek Inactive 状态）

### 3.4 登录与认证 (Auth Login)

**路由:** `/login`
**布局:** 全屏居中，无 AppShell
**设计参考:** `designs/04-auth-v2.png`

**关键区域:**

| 区域 | 内容 |
|------|------|
| 背景 | 电影片场图片 (低亮度, 轻微模糊) + 暗角遮罩 |
| 登录卡片 | 毛玻璃卡 (440px 宽, 垂直居中) |
| Logo | 点阵品牌图标 + "Obsidian Lens" (headlineLg) + "CINEMATIC PRODUCTION SUITE" (labelMd, text.muted) |
| 社交登录 | Google + GitHub 按钮（glass card 样式, 半透明深色背景） |
| 分割线 | "OR EMAIL" (居中分割线, labelSm, text.muted) |
| 表单标签 | "EMAIL ADDRESS" / "PASSWORD" (labelMd, text.secondary) + "FORGOT?" (右对齐, text.secondary) |
| 输入框 | 深色半透明背景, 1px 边框, placeholder: text.placeholder |
| 提交按钮 | "Access Studio" — 中性白渐变背景 (非青色), 深色文字, 全宽, 圆角 |
| 底部链接 | "New to Obsidian?" (text.muted) + "Request early access" (text.secondary, 下划线) |
| 页脚 | 🛡️ "PROTECTED BY AUTHGUARD V2.4" (labelSm, text.muted, 底部居中) |

**V2 与 Refined 版本区别:**
- 提交按钮由青色渐变改为**中性白/浅色渐变**，更沉稳
- "FORGOT?" 链接由青色改为白色中性色
- "Request early access" 链接由青色改为中性下划线样式
- 背景片场图片色调更暖（偏琥珀/黄色灯光）

**数据映射:**
- 登录 → `POST /api/v1/auth/login`
- 注册 → `POST /api/v1/auth/register`
- Google OAuth → `GET /api/v1/auth/google`
- GitHub OAuth → `GET /api/v1/auth/github`
- Token 刷新 → `POST /api/v1/auth/refresh`

**交互:**
- 登录卡 hover 时边框从 `white/5` 变为 `white/10`
- 提交按钮点击时 `scale(0.98)` + 加载状态
- OAuth 按钮跳转外部授权后回调
- 输入框 focus 时显示 `accent.primary` 边框环
- 已登录用户访问 `/login` 自动重定向到 `/projects`

---

## 4. Shared Components

### 4.1 AppShell (全局布局)

所有非登录页面共享此布局。

```
┌──────┬───────────────────────────────────────────┐
│      │  [面包屑]         [搜索] [通知] [头像]     │
│ Side ├───────────────────────────────────────────┤
│ Bar  │                                           │
│      │           Content Area                    │
│(w=180│           (scrollable)                    │
│  px) │                                           │
│      │                                           │
│      │                                           │
└──────┴───────────────────────────────────────────┘
```

**V2 侧边栏 (简化版):**

V2 设计中侧边栏简化为 ~180px 宽，结构如下：
```
┌────────────────┐
│ [Logo] 团队名   │
│        TEAM SPACE │
├────────────────┤
│ WORKSPACE      │ ← 区段标签 (labelSm)
│ ■ Projects     │ ← 激活态: 高亮背景
│ 👥 Team & Roles│
│ 🤖 AI Console  │
│ ⚙ Settings     │
└────────────────┘
```

- 导航项: 图标 + 文字, bodyMd
- 激活态: `surface.containerHigh` 背景 + `text.primary` 文字 + 圆角
- 非激活态: `text.muted` 文字
- 顶部团队标识: 团队 Logo (32px) + 团队名 (titleSm) + "TEAM SPACE" (labelSm, text.muted)

**V2 顶栏 (简化版):**

顶栏与侧边栏平齐，不再包含品牌标识和导航 tab，仅含：
- 左侧: 面包屑导航 (如 `🏠 > Projects`)
- 右侧: 搜索框 + 通知图标 + 用户头像

### 4.2 Node Card (玻璃卡片)

所有管理页面中的卡片统一使用此基础样式：

```css
.node-card {
  background: rgba(18, 18, 18, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  transition: all 300ms ease;
}
.node-card:hover {
  border-color: rgba(0, 209, 255, 0.3);
  background: rgba(22, 22, 22, 0.9);
}
```

### 4.3 Primary CTA Button

```css
.btn-primary {
  background: linear-gradient(135deg, #00D1FF 0%, #0087A3 100%);
  color: #000000;
  font-family: 'Space Grotesk';
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  padding: 10px 24px;
  border-radius: 6px;
  box-shadow: 0 4px 20px -2px rgba(0, 209, 255, 0.5);
}
```

### 4.4 Section Header

所有区块标题共享的样式：青色圆点 + 大写标签。

```css
.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: 'Space Grotesk';
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
}
.section-header::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00D1FF;
}
```

---

## 5. Design-to-Code Mapping

### 5.1 Tailwind Config Extensions

```javascript
// tailwind.config.ts - Phase 06 扩展
{
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "obsidian": {
          "surface": "#0E0E0E",
          "container-low": "#111111",
          "container": "#141414",
          "container-high": "#1A1A1A",
          "container-highest": "#222222",
        },
        "cyan": {
          "DEFAULT": "#00D1FF",
          "dark": "#0087A3",
          "glow": "rgba(0,209,255,0.3)",
        }
      },
      fontFamily: {
        "headline": ["Space Grotesk", "sans-serif"],
        "body": ["Manrope", "sans-serif"],
      },
      backgroundImage: {
        "dot-grid": "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0)",
        "primary-gradient": "linear-gradient(135deg, #00D1FF 0%, #0087A3 100%)",
      },
      backgroundSize: {
        "dot-grid": "24px 24px",
      }
    }
  }
}
```

### 5.2 CSS Custom Properties

```css
:root {
  --obsidian-primary: #00D1FF;
  --obsidian-surface: #0E0E0E;
  --obsidian-text: #E5E2E1;
  --obsidian-muted: #8E9192;
  --obsidian-glass-bg: rgba(18, 18, 18, 0.8);
  --obsidian-glass-border: rgba(255, 255, 255, 0.08);
  --obsidian-glow: 0 0 8px #00D1FF;
}
```

---

## 6. Compatibility with Phase 04/05

Phase 06 管理面板与 Phase 04/05 画布工作台共存于同一应用。设计系统桥接规则：

1. **画布页面** (`/projects/[id]/episodes/[episodeId]`) 继续使用 Phase 04/05 tokens
2. **管理页面** (`/projects`, `/teams`, `/settings`) 使用 Phase 06 tokens
3. **共享元素**（字体、文本颜色、暗色基调）两者一致无需切换
4. **图标库**: 管理页面用 Material Symbols，画布用 Lucide（各自独立加载）
5. **按钮风格**: 画布中的 CTA 保持中性白，管理页面使用品牌青

---

## 7. Responsive Breakpoints

| 断点 | 宽度 | 变化 |
|------|------|------|
| Mobile | < 768px | 侧边栏收起为汉堡菜单, grid 切为 1 列 |
| Tablet | 768-1024px | 侧边栏收窄为图标模式, grid 切为 2 列 |
| Desktop | 1024-1440px | 完整 3 列 grid + 侧边栏 |
| Wide | > 1440px | 内容区 max-width=1280px, 居中 |

---

## 8. Version History

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-03-30 | 初始 UI-SPEC，基于 Refined 版设计稿 |
| v2.0 | 2026-03-30 | 新增 V2 设计稿（简洁实用风格），更新所有页面规格以匹配 V2 |

**V1 → V2 主要变更总结:**
- **项目中心**: 移除特色项目/系统分析/活动日志/FAB，改为等宽网格卡片 + 底部统计条
- **团队管理**: 移除组织树结构，改为全宽成员表格（MEMBER/ROLE/GROUP/STATUS 四列）
- **AI 控制台**: 移除复杂计费矩阵/配额分配/服务健康面板，改为 Provider 卡片网格 + 计费概览统计
- **登录认证**: 提交按钮从青色渐变改为中性白渐变，整体色调更沉稳
- **AppShell**: 侧边栏简化为 ~180px，移除顶部导航 tab，改为面包屑导航
- **整体方向**: 从"科幻控制台"美学转向"简洁专业工具"美学，降低视觉复杂度，提升可实现性

*Phase: 06-collaboration-prod*
*UI-SPEC updated: 2026-03-30*
*Design system: "The Obsidian Lens" v2.0*
*Active design reference: V2 screenshots*
