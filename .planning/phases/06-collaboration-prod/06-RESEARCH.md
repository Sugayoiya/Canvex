# Phase 06: Collaboration + Versioning + Production Hardening - Research

**Researched:** 2026-03-30
**Domain:** Multi-tenant collaboration, OAuth social login, AI provider DB management, project CRUD, production hardening
**Confidence:** HIGH

## Summary

Phase 06 transforms Canvex from a single-user tool into a multi-user production platform. The scope covers six major domains: (1) organization hierarchy with Global Admin → Team → Group three-tier model, (2) team invitation via link + direct add, (3) AI Provider/Model DB-backed management with multi-key round-robin routing, (4) billing/quota expansion with AICallLog dimension enrichment, (5) project CRUD with ownership-scoped access and canvas one-to-many, (6) Google + GitHub OAuth social login with global AuthGuard.

The codebase already has strong foundations: `Team`/`TeamMember`/`TeamInvitation` models, `resolve_project_access` dependency, `ROLE_PRIORITY` dict, `AIModelEntity`/`ProviderEntity` entity system, `UserQuota`/`TeamQuota` quota models, and JWT auth with Axios auto-refresh. The primary work is *extending* existing patterns (add Group layer, upgrade ProviderManager from env-only to DB, expand AICallLog dimensions) plus *adding* new features (OAuth, project CRUD API, frontend teams/projects pages, admin dashboards).

**Primary recommendation:** Extend existing ORM models and permission dependencies incrementally. Use `httpx` (already installed) for OAuth token exchange. Implement round-robin with in-memory `itertools.cycle` + failover. AuthGuard as a client-side layout wrapper component (matching current Canvex pattern where auth is JWT-based with no server-side session).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 三层组织架构：全局管理员 (Global Admin) → 团队 (Team) → 小组 (Group)
- **D-02:** 全局管理员：独立系统级角色（`is_admin`），可配置全局 AI Provider/模型，管理所有团队和用户
- **D-03:** 团队角色：团队管理员 (team_admin) + 团队成员 (member)。团队管理员可创建/解散团队、邀请/移除成员
- **D-04:** 小组角色：组长 (leader) + 编辑者 (editor) + 审核者 (reviewer) + 只读 (viewer)。小组由团队内任意成员组成
- **D-05:** 审核者权限 = 只读 + 审批权（不能编辑内容，可对编辑者提交做"通过/打回"操作）
- **D-06:** 小组与项目关系：一对多 — 一个小组可负责多个项目
- **D-07:** 个人用户可升级开设团队，团队与个人互不干扰
- **D-08:** 邀请机制：链接邀请 + 用户搜索直邀（不做邮件服务）
- **D-09:** 链接邀请：团队管理员生成邀请链接，对方点击加入
- **D-10:** 搜索直邀：通过邮箱/昵称搜索已注册用户直接添加为成员
- **D-11:** 环境变量仅作初始化种子：启动时读取 env 写入 DB 作为系统全局 Provider/模型，之后不再实时读 env
- **D-12:** 全局管理员在后台管理系统级 Provider 配置（增删改）
- **D-13:** 团队/个人可自行为特定 Provider 配置 API Key，覆盖全局。凭据查找链：团队/个人自有 Key → 系统全局 Key
- **D-14:** 模型去重展示：用户只看到模型名（如 "Gemini 2.5 Flash"），不暴露供应商细节。系统后台维护模型→多供应商映射
- **D-15:** 多 Key 路由策略：Round-robin 轮换 + failover。多个供应商均匀轮换，某个失败自动跳到下一个
- **D-16:** 模型按任务能力类型筛选（沿用现有 ModelType + capabilities 体系）
- **D-17:** 双维度计费：费用记在 Key 所有者账上 + 同时追踪调用者/项目维度
- **D-18:** AICallLog 记录维度：user_id, team_id, group_id, project_id, canvas_id, node_id, model, provider, key_owner_type, key_owner_id, cost, tokens_in, tokens_out — 支持多角度聚合
- **D-19:** 配额控制：团队总配额 → 分配到团队成员个人配额（不按小组分，按人分）
- **D-20:** 前端入口：分开入口 — 左侧导航切换"个人"/"团队 X"，各自独立项目列表和新建按钮
- **D-21:** 项目 CRUD API：新增 projects.py 路由，沿用 `owner_type`/`owner_id` 归属模型
- **D-22:** 画布与项目：一对多 — 一个项目下可创建多个画布
- **D-23:** 项目克隆：仅支持克隆（复制到目标空间，原件保留），不支持转让/移动归属
- **D-24:** 新增 Google + GitHub OAuth 社交登录
- **D-25:** 全局 AuthGuard 组件包裹 layout 层，统一保护所有路由，未登录跳登录页

### Claude's Discretion
- AuthGuard 具体实现方式（middleware vs layout wrapper）由 Claude 根据 Next.js 16 最佳实践决定
- Round-robin 路由的具体实现（内存计数器 vs Redis）根据部署场景决定
- 审批流的具体 UI 交互细节

### Deferred Ideas (OUT OF SCOPE)
- 小组级 AI Key 配置（当前仅支持团队/个人级）
- 邮件邀请服务（当前仅链接+搜索直邀）
- 项目转让/移动归属（当前仅支持克隆）
- 纯内网部署场景的 OAuth 降级开关
- 版本历史（Version History）功能细节
- 生产部署/运维基线（REQ-12 部分）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-11 | Multi-role collaboration and version history are implemented | Organization hierarchy (D-01~D-07), Group model, role-based access control, invitation system (D-08~D-10), project ownership CRUD (D-20~D-23), OAuth (D-24~D-25) |
| REQ-12 | Production deployment/ops baseline is complete | AI Provider DB management (D-11~D-16), billing enrichment (D-17~D-18), quota adaptation (D-19), multi-key routing (D-15) — Note: per CONTEXT.md deferred items, full ops baseline (beat/monitoring/retention/export) is deferred |
</phase_requirements>

## Project Constraints (from .cursor/rules/)

- **Aspect ratio feature rules** (`.cursor/rules/aspect-ratio-feature.mdc`): Aspect ratio inheritance chain and Gemini mapping rules. Not directly impacted by this phase, but project CRUD must preserve `aspect_ratio` field on Project model.
- **CLAUDE.md conventions**: Follow existing CRUD patterns (`model_dump(exclude_unset=True)` + `setattr`), React Query for server state, Zustand for client state, JWT auth with auto-refresh, no Alembic migrations (use `metadata.create_all()`).
- **Next.js 16 AGENTS.md**: Read `node_modules/next/dist/docs/` before writing code. APIs may differ from training data. Heed deprecation notices. Critical: `middleware.ts` replaced by `proxy.ts` in Next.js 16; auth should NOT be in middleware.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115.0 | API framework | Already production-proven in Canvex |
| SQLAlchemy async | >=2.0.46 | ORM + async DB | Existing data layer, extend with new models |
| python-jose | >=3.5.0 | JWT encoding/decoding | Existing auth infrastructure |
| bcrypt (passlib) | >=1.7.4 | Password hashing | Existing auth |
| httpx | >=0.28.1 | Async HTTP client | Already in deps; use for OAuth token exchange with Google/GitHub |
| Pydantic v2 | >=2.12.5 | Request/response validation | Existing schema layer |
| Next.js 16 | 16.2.1 | Frontend framework | Existing |
| React 19 | 19.2.4 | UI library | Existing |
| Zustand | >=5.0.12 | Client state | Existing auth store |
| @tanstack/react-query | >=5.95.2 | Server state | Existing data fetching |
| axios | >=1.13.6 | HTTP client | Existing with JWT interceptors |
| lucide-react | >=1.7.0 | Icons | Existing icon library |

### New Dependencies Required
| Library | Purpose | When to Use |
|---------|---------|-------------|
| None | — | All required libraries already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw httpx for OAuth | authlib / fastapi-sso | authlib adds SessionMiddleware dependency; httpx is already installed and OAuth flow is simple enough (2 endpoints per provider) |
| In-memory round-robin | Redis-backed round-robin | Redis adds operational dependency; in-memory `itertools.cycle` is sufficient for single-process deployment; upgrade to Redis only if multi-process needed |
| Client-side AuthGuard | Next.js layout-level server guard | Canvex uses JWT stored in localStorage (not cookies) with Axios interceptors; server-side guard would require cookie-based sessions — mismatch with existing auth model |

## Architecture Patterns

### Recommended Project Structure — Backend Additions
```
api/app/
├── models/
│   ├── team.py          # EXTEND: add Group, GroupMember models
│   ├── ai_provider.py   # NEW: AIProviderConfig, AIProviderKey, AIModelConfig
│   ├── ai_call_log.py   # EXTEND: add group_id, canvas_id, node_id, key_owner_type/id
│   └── oauth_account.py # NEW: OAuthAccount (provider + provider_user_id + user_id)
├── schemas/
│   ├── team.py          # NEW: Team/Group/Member CRUD schemas
│   ├── project.py       # NEW: Project CRUD schemas
│   ├── ai_provider.py   # NEW: Provider/Key/Model management schemas
│   └── auth.py          # EXTEND: OAuth callback schemas
├── api/v1/
│   ├── teams.py         # NEW: Team + Group + Invitation CRUD
│   ├── projects.py      # NEW: Project CRUD + clone
│   ├── ai_providers.py  # NEW: Provider/Key/Model admin API
│   ├── users.py         # NEW: User search/profile
│   └── auth.py          # EXTEND: OAuth login/callback endpoints
├── services/
│   └── ai/
│       └── provider_manager.py  # REWRITE: DB-backed + round-robin + failover
└── core/
    └── deps.py          # EXTEND: require_group_member, resolve_group_access
```

### Recommended Project Structure — Frontend Additions
```
web/src/
├── app/
│   ├── teams/
│   │   ├── page.tsx           # Team list
│   │   └── [id]/page.tsx      # Team detail + groups + members
│   ├── projects/
│   │   ├── page.tsx           # REWRITE: ownership-scoped project list
│   │   ├── new/page.tsx       # New project (team/personal selector)
│   │   └── [id]/page.tsx      # Project detail + canvas list
│   ├── settings/
│   │   └── page.tsx           # Admin settings (providers, models)
│   ├── invite/
│   │   └── [token]/page.tsx   # Invite acceptance
│   └── (auth)/
│       └── login/page.tsx     # EXTEND: OAuth buttons
├── components/
│   ├── auth/
│   │   └── auth-guard.tsx     # NEW: Global auth protection
│   └── layout/
│       └── sidebar.tsx        # EXTEND: personal/team space switcher
├── stores/
│   └── auth-store.ts          # EXTEND: teams, currentTeam, currentSpace
└── lib/
    └── api.ts                 # EXTEND: teamsApi, projectsApi, providersApi, usersApi
```

### Pattern 1: Organization Hierarchy (3 Tiers)

**What:** Global Admin → Team → Group model with role-based access at each level.

**Data Model:**

```python
# User.is_admin = True → Global Admin (system-level, not team-scoped)

# Team roles: team_admin, member
class TeamMember(Base):
    role: str  # "team_admin" | "member"

# NEW: Group (within a team)
class Group(Base):
    id, team_id, name, description

class GroupMember(Base):
    id, group_id, user_id, role  # "leader" | "editor" | "reviewer" | "viewer"

# Project assignment
class GroupProject(Base):
    group_id, project_id  # many-to-many
```

**Permission resolution chain:**
1. `is_admin` → full system access
2. Team-level: `require_team_member(team_id, user, db, min_role="member")`
3. Group-level: `require_group_member(group_id, user, db, min_role="editor")`
4. Project-level: `resolve_project_access(project_id, user, db)` — extend to check group membership

**Existing code to extend:**
- `deps.py` `ROLE_PRIORITY` currently: `{"owner": 4, "admin": 3, "editor": 2}`
- Rename to support both team and group contexts:
  - Team: `{"team_admin": 2, "member": 1}`
  - Group: `{"leader": 4, "editor": 3, "reviewer": 2, "viewer": 1}`

### Pattern 2: OAuth Social Login (Google + GitHub)

**What:** Authorization Code flow using `httpx` for token exchange, linking to existing User model via OAuthAccount.

**Flow:**
1. Frontend redirects to `/api/v1/auth/oauth/{provider}/login` → backend returns redirect URL
2. User authenticates on Google/GitHub
3. Provider redirects to `/api/v1/auth/oauth/{provider}/callback?code=...&state=...`
4. Backend exchanges code for access token via `httpx.AsyncClient`
5. Backend fetches user profile (email, name, avatar)
6. If user exists (by email match) → link OAuthAccount + issue JWT
7. If new user → create User + OAuthAccount + issue JWT
8. Backend redirects to frontend with tokens as query params (or use a temporary code)

**Google endpoints:**
- Token: `https://oauth2.googleapis.com/token`
- UserInfo: `https://www.googleapis.com/oauth2/v2/userinfo`

**GitHub endpoints:**
- Token: `https://github.com/login/oauth/access_token`
- UserInfo: `https://api.github.com/user`
- Email: `https://api.github.com/user/emails` (if email is private)

**OAuthAccount model:**
```python
class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    id: str  # uuid
    user_id: str  # FK to users.id
    provider: str  # "google" | "github"
    provider_user_id: str  # Provider's unique user ID
    provider_email: str | None
    access_token: str | None  # For future API calls (optional)
    created_at: datetime
```

### Pattern 3: AI Provider DB Management + Multi-Key Routing

**What:** Upgrade `ProviderManager` from env-only to DB-backed with round-robin key rotation and failover.

**Data models:**
```python
class AIProviderConfig(Base):
    __tablename__ = "ai_provider_configs"
    id: str
    provider_name: str        # "gemini" | "openai" | "deepseek"
    display_name: str
    is_enabled: bool
    priority: int             # ordering for auto-select
    owner_type: str           # "system" | "team" | "personal"
    owner_id: str | None      # null for system, team_id or user_id

class AIProviderKey(Base):
    __tablename__ = "ai_provider_keys"
    id: str
    provider_config_id: str   # FK
    api_key_encrypted: str    # encrypted at rest
    label: str | None         # user-friendly name
    is_active: bool
    rate_limit_rpm: int | None
    last_used_at: datetime | None
    error_count: int          # for circuit breaker

class AIModelConfig(Base):
    __tablename__ = "ai_model_configs"
    id: str
    display_name: str         # user-facing name (e.g., "Gemini 2.5 Flash")
    model_name: str           # API model name (e.g., "gemini-2.5-flash")
    model_type: str           # ModelType enum value
    capabilities: JSON        # list of capability strings
    is_enabled: bool
    # Many-to-many: model can be served by multiple providers
    # Resolved via AIModelProviderMapping join table
```

**Round-robin implementation:**
```python
import itertools
from threading import Lock

class KeyRotator:
    def __init__(self):
        self._pools: dict[str, itertools.cycle] = {}
        self._lock = Lock()
    
    def next_key(self, provider: str, keys: list[AIProviderKey]) -> AIProviderKey:
        with self._lock:
            active = [k for k in keys if k.is_active and k.error_count < MAX_ERRORS]
            if not active:
                raise NoActiveKeysError(provider)
            pool_key = f"{provider}:{len(active)}"
            if pool_key not in self._pools:
                self._pools[pool_key] = itertools.cycle(active)
            return next(self._pools[pool_key])
```

**Credential resolution chain (D-13):**
1. Team/personal-scoped key for the provider → use if exists
2. System global key for the provider → fallback
3. No key → raise error

### Pattern 4: AuthGuard (Client-Side Layout Wrapper)

**What:** A React component that wraps the app layout, checking JWT presence and redirecting to login if unauthenticated.

**Decision rationale:** Canvex uses JWT tokens stored in `localStorage` with Axios interceptors for auto-refresh. This is a pure client-side auth model. Next.js 16 replaced `middleware.ts` with `proxy.ts` which is for routing only (not auth). Server-side layout guards require cookie-based sessions which would be a fundamental architecture change. Therefore: **client-side AuthGuard in the layout** is the correct approach for Canvex.

**Implementation:**
```tsx
// components/auth/auth-guard.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

const PUBLIC_PATHS = ["/login", "/register", "/invite"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !isAuthenticated && !PUBLIC_PATHS.some(p => pathname?.startsWith(p))) {
      router.replace("/login");
    }
  }, [mounted, isAuthenticated, pathname, router]);

  if (!mounted) return null;
  if (!isAuthenticated && !PUBLIC_PATHS.some(p => pathname?.startsWith(p))) return null;
  
  return <>{children}</>;
}
```

Wrap in `Providers` component (already wraps QueryClientProvider):
```tsx
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>{children}</AuthGuard>
    </QueryClientProvider>
  );
}
```

### Pattern 5: Project CRUD with Ownership Scoping

**What:** Standard REST API for projects with `owner_type`/`owner_id` polymorphic ownership, matching existing Canvas pattern.

**Existing model:** `Project` already has `owner_type` ("personal"|"team"), `owner_id`, `created_by` fields.

**API design:**
```
POST   /api/v1/projects/              # Create (owner_type + owner_id from body)
GET    /api/v1/projects/              # List (filtered by current space: personal or team)
GET    /api/v1/projects/{id}          # Get (with access check)
PATCH  /api/v1/projects/{id}          # Update
DELETE /api/v1/projects/{id}          # Soft delete
POST   /api/v1/projects/{id}/clone    # Clone to target space
```

**List filtering (D-20):**
- `?owner_type=personal` → projects where `owner_id == user.id`
- `?owner_type=team&owner_id={team_id}` → projects where `owner_id == team_id` (requires team membership)

### Anti-Patterns to Avoid
- **Hard-coding role checks inline:** Use dependency functions (`require_team_member`, `require_group_member`) not inline `if role != "admin"` checks
- **Storing API keys in plaintext:** Encrypt at rest using Fernet or similar
- **OAuth state stored in memory:** Use JWT-signed state parameter instead of server-side session for OAuth CSRF protection
- **Duplicating auth logic per page:** Use centralized AuthGuard, not per-page `useEffect` checks (current projects page pattern)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth token exchange | Custom HTTP parsing | `httpx.AsyncClient.post()` with standard OAuth2 params | Edge cases in token parsing, redirect handling |
| API key encryption | XOR or custom cipher | `cryptography.fernet.Fernet` (already available via python-jose deps) | Symmetric encryption with key rotation support |
| JWT state parameter | Server-side session store for OAuth state | Sign state with `jose.jwt.encode()` (already have JWT infra) | Stateless, no Redis dependency |
| Round-robin with failover | Custom linked-list tracker | `itertools.cycle` + error counter + threshold | Well-tested, thread-safe with Lock |
| Form validation | Manual field checks | Pydantic v2 validators (existing pattern) | Consistent error formats |

## Common Pitfalls

### Pitfall 1: OAuth Account Linking Collision
**What goes wrong:** User registers with email, then tries OAuth with same email — two accounts exist or login fails.
**Why it happens:** No email-matching logic during OAuth callback.
**How to avoid:** During OAuth callback, first search by `provider + provider_user_id` in OAuthAccount, then fall back to email match in User table. If User exists but no OAuthAccount → link automatically.
**Warning signs:** Users report "email already registered" when clicking Google login.

### Pitfall 2: Team Role vs Group Role Confusion
**What goes wrong:** Permission checks use wrong role context (checking team role for group-level operations).
**Why it happens:** Both team and group have role strings; easy to mix up which ROLE_PRIORITY to use.
**How to avoid:** Separate dependency functions: `require_team_member()` for team ops, `require_group_member()` for group ops. Never mix role contexts in a single check.
**Warning signs:** Team admins can't edit within groups, or group viewers can delete team resources.

### Pitfall 3: Round-Robin State Loss on Restart
**What goes wrong:** In-memory key rotation index resets on server restart, causing uneven distribution.
**Why it happens:** `itertools.cycle` state is ephemeral.
**How to avoid:** This is acceptable for Phase 06 scope (keys distribute evenly over time regardless of start position). For strict distribution, upgrade to Redis-backed counter later.
**Warning signs:** Temporary uneven load after restarts — acceptable trade-off.

### Pitfall 4: AICallLog Dimension Explosion
**What goes wrong:** Adding too many nullable foreign keys makes queries slow and indexes bloated.
**Why it happens:** D-18 requires many dimensions (user, team, group, project, canvas, node, key_owner).
**How to avoid:** Index only the commonly-queried dimensions (user_id, team_id, project_id). Use composite indexes for common query patterns (user_id + created_at, team_id + created_at). Don't index group_id/canvas_id/node_id unless query patterns demand it.
**Warning signs:** Billing dashboard queries take >1s on moderate data.

### Pitfall 5: Frontend Space-Switching State Leak
**What goes wrong:** Switching between personal and team spaces shows stale project lists or wrong permissions.
**Why it happens:** React Query cache keys don't include the current space context.
**How to avoid:** Include `owner_type` + `owner_id` in all query keys. Use `queryClient.invalidateQueries` on space switch. Store `currentSpace` in Zustand auth store.
**Warning signs:** Team projects appear in personal list after switching.

### Pitfall 6: OAuth Redirect URI Mismatch
**What goes wrong:** OAuth callback fails with "redirect_uri_mismatch" error.
**Why it happens:** Callback URL in code doesn't match what's registered in Google/GitHub OAuth app settings.
**How to avoid:** Use `FRONTEND_URL` from settings to construct redirect URI dynamically. Document exact URI patterns that must be registered.
**Warning signs:** OAuth works in dev but fails in production (different base URLs).

## Code Examples

### OAuth Callback (Google)
```python
# Source: Standard OAuth2 Authorization Code Flow
async def google_callback(code: str, state: str, db: AsyncSession):
    # 1. Verify state JWT
    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(400, "Invalid state")
    
    # 2. Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": f"{settings.FRONTEND_URL}/api/v1/auth/oauth/google/callback",
                "grant_type": "authorization_code",
            },
        )
        tokens = token_resp.json()
    
    # 3. Fetch user info
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        user_info = user_resp.json()
    
    # 4. Find or create user + link OAuthAccount
    # ... (see Pattern 2 above)
```

### DB-backed Provider Resolution
```python
# Source: Adapted from existing ProviderManager pattern
async def resolve_provider_key(
    provider: str,
    team_id: str | None,
    user_id: str,
    db: AsyncSession,
) -> tuple[str, str]:  # (api_key, key_owner_description)
    """D-13 credential chain: team/personal → system global."""
    
    # 1. Team-scoped key
    if team_id:
        key = await _find_active_key(db, provider, "team", team_id)
        if key:
            return key.api_key_encrypted, f"team:{team_id}"
    
    # 2. Personal key
    key = await _find_active_key(db, provider, "personal", user_id)
    if key:
        return key.api_key_encrypted, f"personal:{user_id}"
    
    # 3. System global
    key = await _find_active_key(db, provider, "system", None)
    if key:
        return key.api_key_encrypted, "system"
    
    raise ValueError(f"No API key configured for provider '{provider}'")
```

### AuthGuard with Space Context
```tsx
// Source: Extending existing Canvex auth store pattern
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  teams: Team[];
  currentSpace: { type: "personal" } | { type: "team"; teamId: string };
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setTeams: (teams: Team[]) => void;
  switchSpace: (space: AuthState["currentSpace"]) => void;
  logout: () => void;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js middleware.ts for auth | proxy.ts for routing + layout guards for auth | Next.js 15+ (CVE-2025-29927) | Auth must NOT go in middleware/proxy |
| Authlib with SessionMiddleware | httpx direct OAuth + JWT state | 2024+ for API-first apps | Simpler, no session dependency |
| Env-only AI provider config | DB-backed with admin UI | Industry trend 2024-2025 | Essential for multi-tenant |
| Single API key per provider | Multi-key rotation + failover | LLM rate limit era 2024+ | Required for production reliability |

**Deprecated/outdated:**
- `middleware.ts` for auth in Next.js 16 — security vulnerability, use layout-level guards
- `SessionMiddleware` for OAuth state in API-first apps — use JWT-signed state parameter

## Open Questions

1. **API Key Encryption Key Management**
   - What we know: Fernet symmetric encryption is standard for at-rest key encryption
   - What's unclear: Where to store the encryption key (env var `ENCRYPTION_KEY`? Derived from `SECRET_KEY`?)
   - Recommendation: Use `SECRET_KEY` as seed to derive a Fernet key via HKDF. Simple, no new env var needed.

2. **OAuth Callback URL Pattern**
   - What we know: Backend handles token exchange, frontend needs the JWT result
   - What's unclear: Whether to redirect back to frontend with tokens in URL params (simple but tokens in URL history) or use a temporary code exchange
   - Recommendation: Redirect to `{FRONTEND_URL}/login?access_token=...&refresh_token=...` — frontend picks up tokens from URL params, stores in localStorage, cleans URL. Simple and matches existing JWT flow.

3. **Group-Project Assignment Granularity**
   - What we know: D-06 says one group can manage multiple projects
   - What's unclear: Whether project access should be ONLY through groups, or teams grant baseline access too
   - Recommendation: Team members get read access to all team projects. Group membership grants edit access to assigned projects. This avoids overly complex permission chains.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). All required tools and runtimes are already configured in the Canvex development environment. httpx is already a project dependency. No new system-level tools needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >=8.3.5 + pytest-asyncio >=0.25.2 |
| Config file | `api/pyproject.toml` [tool.pytest.ini_options] asyncio_mode = "auto" |
| Quick run command | `cd api && uv run pytest tests/ -x --timeout=30` |
| Full suite command | `cd api && uv run pytest tests/ -v` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-11a | Team CRUD + member management | integration | `pytest tests/test_teams_api.py -x` | ❌ Wave 0 |
| REQ-11b | Group CRUD + role enforcement | integration | `pytest tests/test_groups_api.py -x` | ❌ Wave 0 |
| REQ-11c | Project CRUD with ownership scoping | integration | `pytest tests/test_projects_api.py -x` | ❌ Wave 0 |
| REQ-11d | OAuth login (Google + GitHub) | integration | `pytest tests/test_oauth_api.py -x` | ❌ Wave 0 |
| REQ-11e | AuthGuard route protection | manual | Frontend manual test | N/A |
| REQ-12a | AI Provider DB management + key routing | integration | `pytest tests/test_provider_management.py -x` | ❌ Wave 0 |
| REQ-12b | AICallLog enriched dimensions | unit | `pytest tests/test_ai_call_logger.py -x` | ❌ Wave 0 |
| REQ-12c | Quota adaptation (team→member) | unit | `pytest tests/test_quota_service.py -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd api && uv run pytest tests/ -x --timeout=30`
- **Per wave merge:** `cd api && uv run pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_teams_api.py` — covers REQ-11a (Team CRUD)
- [ ] `tests/test_groups_api.py` — covers REQ-11b (Group roles)
- [ ] `tests/test_projects_api.py` — covers REQ-11c (Project ownership)
- [ ] `tests/test_oauth_api.py` — covers REQ-11d (OAuth flow mock)
- [ ] `tests/test_provider_management.py` — covers REQ-12a (DB provider + routing)
- [ ] `tests/conftest.py` — extend existing fixtures for team/group/project factory helpers

## Sources

### Primary (HIGH confidence)
- Canvex codebase direct inspection: `api/app/models/`, `api/app/core/deps.py`, `api/app/services/ai/provider_manager.py`, `web/src/`
- Next.js 16 bundled docs: `node_modules/next/dist/docs/01-app/02-guides/authentication.md` — confirms layout-level auth pattern
- Next.js 16 AGENTS.md: middleware.ts replaced by proxy.ts, auth NOT in middleware

### Secondary (MEDIUM confidence)
- Google OAuth2 endpoints: standard, well-documented (`oauth2.googleapis.com/token`, `googleapis.com/oauth2/v2/userinfo`)
- GitHub OAuth endpoints: standard (`github.com/login/oauth/access_token`, `api.github.com/user`)
- CVE-2025-29927 Next.js middleware auth bypass: confirmed by multiple sources

### Tertiary (LOW confidence)
- fastapi-sso library (v0.21.0): alternative but not recommended (unnecessary dependency)
- authlib starlette integration: docs returned 404, demo repo last updated 2023

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, well-understood
- Architecture: HIGH — extends existing patterns with clear data models
- Organization model: HIGH — CONTEXT.md provides explicit decisions for all roles/relationships
- OAuth implementation: HIGH — standard Authorization Code flow, httpx already available
- AI Provider DB: MEDIUM — data model design is sound but round-robin failover needs runtime validation
- Pitfalls: HIGH — based on direct codebase inspection and common multi-tenant patterns

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain, no fast-moving dependencies)
