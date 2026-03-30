# Phase 06: Collaboration + Versioning + Production Hardening - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the multi-tenant collaboration model (global admin → team → group), AI Provider/model DB management with multi-key routing, project/canvas CRUD with ownership, and authentication enhancements (OAuth + AuthGuard). This phase makes Canvas Studio a multi-user production platform.

</domain>

<decisions>
## Implementation Decisions

### 1. Organization Hierarchy

- **D-01:** 三层组织架构：全局管理员 (Global Admin) → 团队 (Team) → 小组 (Group)
- **D-02:** 全局管理员：独立系统级角色（`is_admin`），可配置全局 AI Provider/模型，管理所有团队和用户
- **D-03:** 团队角色：团队管理员 (team_admin) + 团队成员 (member)。团队管理员可创建/解散团队、邀请/移除成员
- **D-04:** 小组角色：组长 (leader) + 编辑者 (editor) + 审核者 (reviewer) + 只读 (viewer)。小组由团队内任意成员组成
- **D-05:** 审核者权限 = 只读 + 审批权（不能编辑内容，可对编辑者提交做"通过/打回"操作）
- **D-06:** 小组与项目关系：一对多 — 一个小组可负责多个项目
- **D-07:** 个人用户可升级开设团队，团队与个人互不干扰

### 2. Team Invitation

- **D-08:** 邀请机制：链接邀请 + 用户搜索直邀（不做邮件服务）
- **D-09:** 链接邀请：团队管理员生成邀请链接，对方点击加入
- **D-10:** 搜索直邀：通过邮箱/昵称搜索已注册用户直接添加为成员

### 3. AI Provider & Model Management

- **D-11:** 环境变量仅作初始化种子：启动时读取 env 写入 DB 作为系统全局 Provider/模型，之后不再实时读 env
- **D-12:** 全局管理员在后台管理系统级 Provider 配置（增删改）
- **D-13:** 团队/个人可自行为特定 Provider 配置 API Key，覆盖全局。凭据查找链：团队/个人自有 Key → 系统全局 Key
- **D-14:** 模型去重展示：用户只看到模型名（如 "Gemini 2.5 Flash"），不暴露供应商细节。系统后台维护模型→多供应商映射
- **D-15:** 多 Key 路由策略：Round-robin 轮换 + failover。多个供应商均匀轮换，某个失败自动跳到下一个
- **D-16:** 模型按任务能力类型筛选（沿用现有 ModelType + capabilities 体系）

### 4. Billing & Quota

- **D-17:** 双维度计费：费用记在 Key 所有者账上 + 同时追踪调用者/项目维度
- **D-18:** AICallLog 记录维度：user_id, team_id, group_id, project_id, canvas_id, node_id, model, provider, key_owner_type, key_owner_id, cost, tokens_in, tokens_out — 支持多角度聚合（项目花费、成员花费、成员在某项目花费等）
- **D-19:** 配额控制：团队总配额 → 分配到团队成员个人配额（不按小组分，按人分）

### 5. Project & Canvas

- **D-20:** 前端入口：分开入口 — 左侧导航切换"个人"/"团队 X"，各自独立项目列表和新建按钮
- **D-21:** 项目 CRUD API：新增 projects.py 路由（创建/列表/详情/更新/删除），沿用 `owner_type`/`owner_id` 归属模型
- **D-22:** 画布与项目：一对多 — 一个项目下可创建多个画布
- **D-23:** 项目克隆：仅支持克隆（复制到目标空间，原件保留），不支持转让/移动归属

### 6. Authentication

- **D-24:** 新增 Google + GitHub OAuth 社交登录（内网可通外网，正常 OAuth 流程）
- **D-25:** 全局 AuthGuard 组件包裹 layout 层，统一保护所有路由，未登录跳登录页

### Claude's Discretion

- AuthGuard 具体实现方式（middleware vs layout wrapper）由 Claude 根据 Next.js 16 最佳实践决定
- Round-robin 路由的具体实现（内存计数器 vs Redis）根据部署场景决定
- 审批流的具体 UI 交互细节

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Organization & Auth
- `api/app/models/user.py` — 现有 User 模型（email, password_hash, is_admin）
- `api/app/models/team.py` — 现有 Team/TeamMember/TeamInvitation 模型（需扩展 Group 层）
- `api/app/core/deps.py` — 现有权限依赖（get_current_user, require_admin, require_team_member, resolve_project_access）
- `api/app/core/config.py` — 现有 OAuth 占位配置（GOOGLE_CLIENT_ID 等）
- `api/app/api/v1/auth.py` — 现有认证路由（register/login/refresh/me）

### AI Provider & Model
- `api/app/services/ai/provider_manager.py` — 现有 ProviderManager（env-only，需升级为 DB）
- `api/app/services/ai/entities.py` — ModelType/AIModelEntity/ProviderEntity 数据定义
- `api/app/services/ai/model_providers/gemini.py` — _KNOWN_MODELS 格式参考
- `api/app/services/ai/model_providers/openai_provider.py` — _KNOWN_MODELS 格式参考
- `api/app/services/ai/model_providers/deepseek.py` — _KNOWN_MODELS 格式参考

### Billing & Quota
- `api/app/models/quota.py` — 现有 UserQuota/TeamQuota 模型
- `api/app/services/ai/ai_call_logger.py` — 现有 AICallLog 记录（需扩展维度字段）

### Project & Canvas
- `api/app/models/project.py` — 现有 Project 模型（owner_type/owner_id）
- `api/app/models/canvas.py` — 现有 Canvas/CanvasNode/CanvasEdge 模型
- `api/app/api/v1/canvas.py` — 现有 Canvas API（resolve_project_access 校验）
- `api/app/core/database.py` — _seed_demo_project 种子逻辑（需替换为正式项目创建流程）

### Frontend
- `web/src/stores/auth-store.ts` — 现有 auth store（仅 user+tokens，需扩展 teams/currentTeam）
- `web/src/lib/api.ts` — 现有 API client（仅 authApi+canvasApi，需新增 teams/projects/providers）
- `web/src/app/projects/page.tsx` — 现有工作台页面（需重构为项目列表）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Team`/`TeamMember`/`TeamInvitation` ORM 模型已存在，可扩展加入 Group 层
- `resolve_project_access` 已支持 personal/team 两种归属路径
- `ROLE_PRIORITY` dict 已有 owner/admin/editor，需扩展小组角色
- `AIModelEntity` + `ModelType` 能力分类体系可直接沿用
- `_KNOWN_MODELS` 元数据格式统一，迁移到 DB 后结构可对齐
- `UserQuota`/`TeamQuota` 配额模型已存在（Phase 04），需调整为"团队总配额→成员个人配额"
- Billing Dashboard（Phase 05）的 Recharts 图表组件可复用

### Established Patterns
- JWT HS256 auth + Axios interceptor auto-refresh（沿用）
- Zustand persist for client auth state（沿用并扩展）
- React Query for server state fetching（沿用）
- fail-closed quota enforcement（Phase 04 决定，沿用）
- Celery async execution + SkillContext 携带 user_id/project_id/canvas_id/node_id

### Integration Points
- `api/app/api/v1/router.py` — 需新增 teams/projects/ai_providers 路由
- `web/src/app/` — 需新增 teams/, projects/ 页面路由
- `web/src/components/layout/sidebar.tsx` — 需加入个人/团队空间切换
- `ProviderManager` — 需从 env-only 升级为 DB 查找 + round-robin 路由
- `SkillExecutor` — quota check 需适配新的团队→成员配额模型

</code_context>

<specifics>
## Specific Ideas

- 用户侧看到的模型信息越少越好，供应商细节对普通用户隐藏
- 计费记录维度要全面，支持项目花费、成员花费、成员在某项目花费等多角度统计
- 个人空间和团队空间完全隔离互不干扰，通过导航切换

</specifics>

<deferred>
## Deferred Ideas

- 小组级 AI Key 配置（当前仅支持团队/个人级，第四级小组 Key 过于复杂）
- 邮件邀请服务（当前仅链接+搜索直邀）
- 项目转让/移动归属（当前仅支持克隆）
- 纯内网部署场景的 OAuth 降级开关
- 版本历史（Version History）功能细节（Phase 06 roadmap 提及但本次未讨论）
- 生产部署/运维基线（Phase 06 roadmap 的 REQ-12 部分）

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-collaboration-prod*
*Context gathered: 2026-03-30*
