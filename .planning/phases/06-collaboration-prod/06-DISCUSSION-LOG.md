# Phase 06: Collaboration + Versioning + Production Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 06-collaboration-prod
**Areas discussed:** 团队与个人工作空间, AI Provider/模型配置, 项目与画布创建流程, 认证体系增强

---

## 团队与个人工作空间

### 团队角色体系

| Option | Description | Selected |
|--------|-------------|----------|
| 三级角色（owner/admin/editor） | 与现有模型一致，所有成员都能编辑 | |
| 四级角色（owner/admin/editor/viewer） | 加只读角色 | |
| 你来决定 | Claude 自行选择 | |

**User's choice:** 自定义方案 — 全局管理员 + 团队（管理员/成员）+ 小组（组长/编辑者/审核者/Viewer）三层架构
**Notes:** 系统有全局管理员等级配置全局AI provider和模型，也能创建团队/个人，操作团队添加移除成员。团队管理员可创建/解散团队、邀请/移除成员。小组由任意团队成员组成，包含组长/编辑者/审核者/只读viewer，小组负责对应项目。项目可转让，个人可升级开设团队，个人项目可克隆到团队项目。

### 小组与项目关系

| Option | Description | Selected |
|--------|-------------|----------|
| 一对一 | 每个小组对应一个项目 | |
| 一对多 | 一个小组可以负责多个项目 | ✓ |
| 多对多 | 多个小组可协作同一项目 | |

**User's choice:** 一对多
**Notes:** 无

### 团队邀请机制

| Option | Description | Selected |
|--------|-------------|----------|
| 仅链接邀请 | 生成邀请链接分享 | |
| 链接 + 用户搜索直邀 | 生成链接 + 搜索已注册用户直接添加 | ✓ |
| 全套（链接+搜索+邮件） | 三种方式都支持 | |

**User's choice:** 链接 + 用户搜索直邀
**Notes:** 不做邮件服务

### 审核者角色权限

| Option | Description | Selected |
|--------|-------------|----------|
| 只读 + 审批权 | 不能编辑，可通过/打回 | ✓ |
| 编辑 + 审批权 | 既能编辑也能审批 | |
| 只读 + 评论 | 不能编辑不做审批，仅留评论 | |

**User's choice:** 只读 + 审批权
**Notes:** 无

---

## AI Provider/模型配置

### 凭据管理层级

| Option | Description | Selected |
|--------|-------------|----------|
| 两级：全局 + env 回退 | 全局管理员配置，所有人共用 | |
| 三级：团队→全局→env | 团队可自带 Key，逐级回退 | |
| 四级：小组→团队→全局→env | 小组也能配 Key | |

**User's choice:** 自定义方案 — env 仅初始化种子写入 DB，之后全局管理员管理。团队/个人可自配 Key 覆盖全局。
**Notes:** 环境变量只做初始项目使用，只在项目初始化时读取并加入到系统全局供应商/模型中。凭据链：团队/个人自有 Key → 系统全局 Key。

### 同模型多供应商展示

| Option | Description | Selected |
|--------|-------------|----------|
| 只显示一个 + 后台负载均衡 | 用户看一个模型名，系统自动路由 | ✓ |
| 显示多个带供应商标签 | 分别列出让用户选 | |
| 合并显示 + 展开选供应商 | 默认一个，可展开选偏好 | |

**User's choice:** 只显示一个 + 后台负载均衡
**Notes:** 用户侧看到的信息越少越好。系统维护模型→多供应商映射，调用时自动选可用供应商。

### 多 Key 路由策略

| Option | Description | Selected |
|--------|-------------|----------|
| 优先级 + failover | 按优先级排，失败切下一个 | |
| Round-robin + failover | 均匀轮换，失败跳过 | ✓ |
| 你来决定 | Claude 自行设计 | |

**User's choice:** Round-robin + failover
**Notes:** 无

### 计费分摊方式

| Option | Description | Selected |
|--------|-------------|----------|
| 按 Key 归属计费 | 谁的 Key 算谁的 | |
| 按调用者计费 | 算实际发起调用的人 | |
| 双维度：Key归属+调用者追踪 | 费用算 Key 所有者，同时记录调用者 | ✓ |

**User's choice:** 双维度
**Notes:** 计费记录维度要全面，支持项目花费、成员花费、成员在某项目花费等多角度统计。

### 配额控制层级

| Option | Description | Selected |
|--------|-------------|----------|
| 团队总配额 + 小组子配额 | 团队→小组 | |
| 仅团队级配额 | 小组共享团队配额 | |
| 三级：团队→小组→个人 | 最细粒度 | |

**User's choice:** 自定义方案 — 团队总配额分配到团队成员个人配额（按人分，不按小组分）
**Notes:** 无

---

## 项目与画布创建流程

### 项目创建入口

| Option | Description | Selected |
|--------|-------------|----------|
| 统一入口 | 新建时选归属 | |
| 分开入口 | 左侧导航切换个人/团队，各自独立 | ✓ |

**User's choice:** 分开入口
**Notes:** 个人空间和团队空间完全隔离

### 画布与项目关系

| Option | Description | Selected |
|--------|-------------|----------|
| 一对一 | 每个项目自动带一个画布 | |
| 一对多 | 一个项目下可创建多个画布 | ✓ |
| 画布独立于项目 | 画布可不挂项目 | |

**User's choice:** 一对多
**Notes:** 无

### 项目转让与克隆

| Option | Description | Selected |
|--------|-------------|----------|
| 转让 = 移动归属 | 剪切 | |
| 转让 + 克隆并存 | 两种操作都支持 | |
| 仅克隆无转让 | 只能复制，原件保留 | ✓ |

**User's choice:** 仅克隆无转让
**Notes:** 避免误操作丢失

---

## 认证体系增强

### OAuth 社交登录

| Option | Description | Selected |
|--------|-------------|----------|
| 暂不需要 | 保持邮箱密码 | |
| 仅 Google | 一个社交登录 | |
| Google + GitHub | 两个都加 | ✓ |

**User's choice:** Google + GitHub
**Notes:** 内网可通外网，正常 OAuth 流程

### 前端路由守卫

| Option | Description | Selected |
|--------|-------------|----------|
| 全局 AuthGuard | layout 层统一保护 | ✓ |
| 页面级守卫 | 每页自行判断 | |
| 你来决定 | Claude 自行选择 | |

**User's choice:** 你来决定（Claude 选择全局 AuthGuard，符合 Next.js 最佳实践和父项目模式）
**Notes:** 用户不熟悉前端，委托 Claude 决定

---

## Claude's Discretion

- AuthGuard 实现方式（middleware vs layout wrapper）
- Round-robin 路由具体实现
- 审批流 UI 交互细节

## Deferred Ideas

- 小组级 AI Key 配置
- 邮件邀请服务
- 项目转让/移动归属
- 纯内网 OAuth 降级开关
- 版本历史功能细节
- 生产部署/运维基线（REQ-12）
