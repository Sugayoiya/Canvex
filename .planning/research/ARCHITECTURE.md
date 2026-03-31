# Architecture Research — Admin Console

## Integration Points

### Backend

- **统一鉴权入口**：所有需登录的管理能力已通过 `get_current_user` 注入 `User`；系统级权限在路由内调用 `require_admin(user)`（`api/app/core/deps.py`），失败返回 **403**、`detail: "System administrator privileges required"`。
- **已存在的 admin 相关行为**（无需新造轮子即可部分对接前端）：
  - **配额**：`api/app/api/v1/quota.py` — `GET/PUT /quota/user/{user_id}`、`GET/PUT /quota/team/{team_id}` 均 `require_admin`；`/quota/my` 为普通用户。
  - **定价**：`api/app/api/v1/billing.py` — `POST/PATCH/DELETE /billing/pricing/` 需 admin；`GET /billing/pricing/` 对任意登录用户可读（`active_only`）；用量统计与时间序列在 **非 admin** 时按 `AICallLog.user_id == user.id` 过滤，**admin 可见全站聚合**。
  - **系统级 AI Provider**：`api/app/api/v1/ai_providers.py` — `owner_type == "system"` 的 list/create/update/delete 路径经 `_verify_config_ownership` / 分支内 `require_admin` 保护。
  - **任务监控**：`api/app/api/v1/logs.py` — `GET /logs/tasks` 与 `/logs/tasks/counts` 在 `user.is_admin` 时可不按 `user_id` 过滤，并支持 `user_id` 查询参数；**技能日志、AI 调用列表、trace** 仍 **固定按当前用户** 过滤，尚无全站管理员视图。
- **路由聚合**：新 admin 专用模块应通过 `api/app/api/v1/router.py` 的 `include_router` 注册，前缀建议 **`/admin`** 或保持 REST 资源路径但在标签与文档上归类为 admin，与现有 `/quota`、`/billing`、`/logs` 并列，便于 OpenAPI 分组。

### Frontend

- **身份字段**：`User.is_admin` 已在 `web/src/stores/auth-store.ts` 的 `User` 类型与持久化 store 中定义；登录/OAuth 回调通过 `authApi.me()`（`GET /api/v1/auth/me`）写入用户对象，`UserResponse` 含 `is_admin`（`api/app/schemas/auth.py`）。
- **全局壳层**：`web/src/components/providers.tsx` 用 `AuthGuard` 包住整棵应用树，目前仅校验 **是否登录**，不区分 admin。
- **布局与导航**：`AppShell`（`sidebar` + `topbar` + `main`）与 **空间切换器**（personal / team）是正交的维度；`sidebar.tsx` 中 `NAV_ITEMS` / `BOTTOM_ITEMS` 为静态列表，**无 admin 入口**。`topbar.tsx` 的 `SEGMENT_LABELS` 按路径段映射面包屑，需为 `admin` 段补充文案。
- **API 客户端**：`web/src/lib/api.ts` 已有 `billingApi`（用量与 **只读** `pricing`）、`taskApi`、`logsApi`、`aiProvidersApi`；**没有** `quotaApi`，也没有 billing 定价的 **写操作** 方法。
- **现状分散能力**：`/settings/ai` 按 `currentSpace` 拉取 `owner_type` 为 team 或 system 的 providers（system 仅 admin 可过）；`/billing` 自建 `Sidebar` 未用 `AppShell`；`/tasks` 使用已有 `taskApi`。Admin 控制台的目标之一是把 **用户/配额/定价/系统 Provider/全站监控/团队概览** 收拢到统一信息架构，而不是继续散落在底部导航与设置页。

### 与空间切换器的关系

- **Admin 不是第三种 space**：`currentSpace` 表示 **数据归属上下文**（个人资源 vs 某团队资源）；系统管理是 **全局角色能力**，不应写入 `SpaceContext`。
- **推荐 UX**：在侧栏增加 **仅当 `user?.is_admin` 时可见** 的分区（例如 `ADMIN` 标签下「Admin Console」链到 `/admin`），或空间下拉底部固定一项「系统管理」；进入 `/admin/*` 后仍保留顶部/侧栏壳子，但可在 admin 子布局中用 **二级侧栏** 展示用户/配额/定价/监控等，避免与 `WORKSPACE` 主导航混淆。
- **可选强化**：进入 admin 路由时在 UI 上弱化或禁用空间相关操作（或显示提示「全局管理视图」），防止误以为配额/团队操作仅作用于当前 space；具体产品取舍可在实现阶段定。

---

## New Components Needed

### Backend

| 领域 | 现状缺口 | 建议 |
|------|----------|------|
| **用户管理** | `users.py` 仅有 `/search`、`/me`；无列表、禁用/启用、`is_admin` 变更 | 新增 `api/app/api/v1/admin_users.py`（或 `admin.py` 下子路由）：分页列表+搜索、`PATCH` 更新 `status`（active/banned）、`is_admin`；全部 `require_admin`；响应使用专用 schema（勿把敏感字段暴露给普通 `/users`）。 |
| **团队概览** | `teams.py` 为成员视角 | 新增 admin 列表端点：全站团队分页、成员数摘要；`require_admin`。 |
| **监控 / 日志** | `logs.py` 中 skill/ai-call/trace 仍 user-scoped | 方案 A：在同文件为 admin 增加查询参数 `global=true` 或省略用户过滤；方案 B：新增 `/admin/logs/skills`、`/admin/logs/ai-calls`、`/admin/logs/trace/{id}` 避免改变现有客户端语义。**Trace** 需能按 `trace_id` 跨用户加载时校验 admin。 |
| **模型 / Schema** | `User` 已有 `status`、`is_admin` | 新增 Pydantic：`AdminUserListItem`、`AdminUserUpdate`、`AdminTeamSummary` 等；列表注意性能（索引 email/nickname/status）。 |

不在此里程碑强制要求、但可预留：**审计查询 API**（若 `QuotaUsageLog`、skill/ai 日志已足够可先只做只读导出）。

### Frontend

| 类型 | 建议 |
|------|------|
| **路由保护** | `AdminGuard`（或 `auth-guard` 内分支）：`useAuthStore` 的 `user?.is_admin`；未登录走现有逻辑；已登录非 admin 访问 `/admin` → 重定向 `/projects` 或专用 403 页。 |
| **布局** | `admin/layout.tsx`（App Router）：嵌套在根 layout 下，内层使用 `AppShell` 或 `AdminShell`（复用 `Topbar`/`Sidebar` 样式 token，侧栏第二列给 admin 子导航）。 |
| **页面** | `src/app/admin/page.tsx`（概览）、`admin/users`、`admin/quotas`、`admin/pricing`、`admin/providers`、`admin/monitoring`、`admin/teams` 等与 `PROJECT.md` 功能对齐。 |
| **组件** | `components/admin/*`：用户表、配额表单、定价表 CRUD、系统 provider 管理（可抽取与 `settings/ai` 共享的表格/卡片，通过 `owner_type="system"` 区分）。 |
| **API 层** | `api.ts` 增加 `quotaApi`、`billingApi` 的 pricing 变更方法；`logsApi`/`taskApi` 增加 admin 全局查询参数（与后端契约一致）；可选 `adminApi` 聚合用户/团队 admin 端点。 |
| **React Query** | `queryKey` 显式包含 `['admin', ...]`，与普通 workspace 查询隔离，避免缓存混淆。 |
| **状态** | **无需**新 Zustand store；`is_admin` 以 `auth-store` 为准。若后台修改了 admin 标志，需依赖 **重新登录** 或 **显式 refetch `/auth/me`** 刷新（可在进入 `/admin` 时 `useQuery` 拉一次 profile）。 |

---

## Route Structure

建议的 **Next.js App Router** 层级（与现有 `src/app/projects/`、`settings/ai/` 并列）：

```
src/app/admin/
  layout.tsx          # AdminGuard + 管理区壳层（+ admin 子导航）
  page.tsx            # 仪表盘：快捷入口、关键指标（可聚合 billing stats / task counts）
  users/page.tsx      # 用户列表 / 搜索 / 状态与 is_admin
  quotas/page.tsx     # 按 user_id / team_id 查询与编辑配额（对接 /quota/...）
  pricing/page.tsx    # 模型定价 CRUD（对接 /billing/pricing/）
  providers/page.tsx  # 系统级 AI Provider（aiProvidersApi list owner_type=system）
  monitoring/page.tsx # 全站任务 +（后端就绪后）技能/AI 日志
  teams/page.tsx      # 全站团队概览
```

**后端** 可选两种风格（二选一保持一致即可）：

- **前缀聚合**：`APIRouter(prefix="/admin")`，下挂 `users`、`teams`、`logs` 等；或
- **资源保持**：继续用 `/quota`、`/billing`、`/ai-providers`，仅新增真正缺失的 `/admin/users` 类资源。

---

## Data Flow

1. **登录** → `authApi.login` / OAuth → `authApi.me()` → `setAuth(user, ...)`，`user.is_admin` 进入 Zustand（并持久化）。
2. **访问 `/admin/*`** → `AdminGuard` 读取 store；通过则渲染 admin layout。
3. **拉取数据** → React Query 调用 `api.ts` 封装的方法；Axios 拦截器附带 JWT；**403** 时可在 admin 页面统一 `onError` 提示无权限（并建议 refetch `/auth/me` 以防角色变更）。
4. **写操作**（配额、定价、用户状态）→ `PUT/PATCH/POST` → 后端 `require_admin` → 成功则 `invalidateQueries` 相关 `queryKey`。
5. **与普通控制台并存**：`/settings/ai` 仍服务 **当前 space** 的 team/personal provider；`/admin/providers` 专注 **system** 行，权限与数据面与 `owner_type` 一致，符合 `PROJECT.md` 的「权限隔离」约束。

---

## Build Order

1. **后端优先 — 用户与列表能力**：admin 用户列表 + 更新接口（否则前端无数据源）。可与 **logs 全站查询** 并行设计，但用户管理通常为 P0。
2. **前端基础 — 路由与守卫**：`/admin/layout.tsx` + `AdminGuard` + 侧栏入口（`user.is_admin`）+ `topbar` 面包屑 `admin` 标签。
3. **API 客户端**：`quotaApi`、billing pricing 写方法、扩展 `logsApi`/`taskApi`（与后端同步）。
4. **垂直切片按依赖**：
   - **配额页**（依赖 quota API + 用户/团队标识搜索，可先依赖用户页选 id）。
   - **定价页**（依赖 billing 已有 CRUD）。
   - **系统 Provider 页**（依赖现有 `ai-providers`，以 UI 聚合为主）。
   - **监控页**（依赖 logs 扩展；在接口未就绪前可先用已有 admin `taskApi` 做全局任务视图）。
   - **团队概览**（依赖 admin teams 列表接口）。
5. **打磨**：403/空状态、Obsidian Lens 样式统一、与 `AppShell`/`BillingPage` 布局不一致处逐步收敛（可选，非阻塞 admin MVP）。

---

*Research date: 2026-03-31 — Canvas Studio v2.1 Admin Console milestone. Sources: `api/app/core/deps.py`, `api/app/api/v1/router.py`, `quota.py`, `billing.py`, `logs.py`, `ai_providers.py`, `users.py`, `web/src/stores/auth-store.ts`, `web/src/lib/api.ts`, `web/src/components/layout/*`, `web/src/components/auth/auth-guard.tsx`, `.planning/PROJECT.md`.*
