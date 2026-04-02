# Canvex

短剧/短片分镜制作工作台，支持项目大纲、多集剧本、角色场景设定、AI 分镜图生成、视频参考分析、视觉风格库、AI Canvas 工作流编排，以及多租户团队协作。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16 (App Router), React 19, TypeScript, TailwindCSS 4, Zustand, React Query, TipTap, XYFlow |
| 后端 | FastAPI, SQLAlchemy (async), Pydantic, Celery |
| 数据库 | PostgreSQL 16 (生产) / SQLite (本地开发) |
| 缓存/队列 | Redis 7 |
| 反向代理 | Nginx Proxy Manager |
| AI | OpenAI, Google Gemini, DeepSeek, ComfyUI |

## 快速开始 (Docker)

### 前置要求

- [Docker](https://www.docker.com/) & Docker Compose v2+
- Git

### 1. 克隆并配置

```bash
git clone <repo-url> && cd canvas-studio
cp .env.example .env
```

编辑 `.env`，填入你的配置（API Key 等）。所有配置集中在这一个文件：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `POSTGRES_USER` | 数据库用户 | `postgres` |
| `POSTGRES_PASSWORD` | 数据库密码 | `postgres` |
| `POSTGRES_DB` | 数据库名 | `canvex` |
| `POSTGRES_PORT` | 数据库端口 (宿主机映射) | `5432` |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `SECRET_KEY` | JWT 签名密钥 | 请修改 |
| `OPENAI_API_KEY` | OpenAI API Key | 空 |
| `GEMINI_API_KEY` | Gemini API Key | 空 |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | 空 |
| `DEFAULT_ADMIN_EMAIL` | 初始管理员邮箱 | `admin@canvex.studio` |
| `DEFAULT_ADMIN_PASSWORD` | 初始管理员密码 | `Admin123!` |
| `NPM_EMAIL` | NPM 管理面板账号 | `admin@canvex.studio` |
| `NPM_PASSWORD` | NPM 管理面板密码 | 请修改 |
| `HTTP_PORT` | HTTP 对外端口 | `80` |
| `HTTPS_PORT` | HTTPS 对外端口 | `443` |
| `NPM_ADMIN_PORT` | NPM 管理面板端口 | `81` |

### 2. 启动服务

```bash
docker compose up -d
```

### 3. 初始化反向代理

首次部署需要运行一次初始化脚本，配置 Nginx Proxy Manager 的代理规则：

```bash
bash scripts/init-npm.sh
```

脚本自动读取 `.env` 配置，完成以下操作：
- 等待 NPM 启动就绪
- 创建/更新管理员账号（使用 `NPM_EMAIL` / `NPM_PASSWORD`）
- 设置默认页面为 404
- 创建代理规则：`localhost` → 前端，`/api` → 后端

> 后续重启只需 `docker compose up -d`，NPM 数据持久化在 Docker Volume 中，不需要重新初始化。

### 4. 访问

| 服务 | 地址 |
|------|------|
| 前端 | `http://localhost` (或你配置的 `HTTP_PORT`) |
| API | `http://localhost/api/v1/...` |
| API 文档 (Swagger) | `http://localhost/api/docs` |
| NPM 管理面板 | `http://localhost:81` (或你配置的 `NPM_ADMIN_PORT`) |
| 数据库 (外部连接) | `localhost:5432`，用户/密码/库名见 `.env` |

默认管理员账号：见 `.env` 中 `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD`。

## Docker 服务架构

```
                    ┌─────────────────────────────────┐
                    │    Nginx Proxy Manager (NPM)    │
                    │    :80 / :443 / :81(管理面板)     │
                    └──────┬──────────────┬───────────┘
                           │              │
                    /api/* │              │ /*
                           ▼              ▼
                  ┌──────────────┐  ┌──────────────┐
                  │   canvex-api │  │   canvex-web │
                  │   FastAPI    │  │   Next.js    │
                  │   :8000      │  │   :3000      │
                  └──────┬───────┘  └──────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
      ┌────────────┐ ┌────────┐ ┌────────────────┐
      │  canvex-   │ │ canvex-│ │ canvex-worker- │
      │  postgres  │ │ redis  │ │ ai/media/quick │
      │  :5432     │ │ :6379  │ │ + beat + flower│
      └────────────┘ └────────┘ └────────────────┘
```

所有容器名以 `canvex-` 为前缀：

| 容器 | 说明 |
|------|------|
| `canvex-postgres` | PostgreSQL 数据库 |
| `canvex-redis` | Redis 缓存/消息队列 |
| `canvex-api` | FastAPI 后端 |
| `canvex-web` | Next.js 前端 |
| `canvex-npm` | Nginx Proxy Manager 反向代理 |
| `canvex-worker-ai` | Celery Worker — AI 生成任务 |
| `canvex-worker-media` | Celery Worker — 媒体处理任务 |
| `canvex-worker-quick` | Celery Worker — 快速/管道任务 |
| `canvex-beat` | Celery Beat — 定时任务调度 |
| `canvex-flower` | Celery Flower — 任务监控面板 |

## 本地开发 (不使用 Docker)

### 后端

```bash
cd api
cp ../.env.example ../.env
# 需要先启动 PostgreSQL 和 Redis (docker compose up -d postgres redis)
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd web
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > .env.local
npm install
npm run dev
```

前端访问 `http://localhost:3000`，API 访问 `http://localhost:8000/docs`。

## 常用命令

```bash
# 启动全部服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f api        # 后端日志
docker compose logs -f web        # 前端日志
docker compose logs -f worker-ai  # AI Worker 日志

# 重建镜像（代码更新后）
docker compose build
docker compose up -d

# 仅重建某个服务
docker compose build api && docker compose up -d api

# 停止全部服务
docker compose down

# 停止并清除数据卷（慎用，会删除数据库数据）
docker compose down -v
```

## 目录结构

```
canvas-studio/
├── api/                    # FastAPI 后端
│   ├── app/
│   │   ├── api/v1/         # API 路由
│   │   ├── core/           # 核心配置 (数据库, 认证, 依赖注入)
│   │   ├── models/         # SQLAlchemy ORM 模型
│   │   ├── schemas/        # Pydantic 请求/响应模型
│   │   └── services/       # 业务逻辑层
│   │       ├── ai/         # AI 服务 (LLM, 图像生成)
│   │       └── video/      # 视频处理
│   ├── Dockerfile
│   └── pyproject.toml
├── web/                    # Next.js 前端
│   ├── src/
│   │   ├── app/            # App Router 页面
│   │   ├── components/     # 功能组件
│   │   ├── lib/api.ts      # API 客户端
│   │   └── stores/         # Zustand 状态管理
│   ├── Dockerfile
│   └── package.json
├── scripts/
│   └── init-npm.sh         # NPM 代理初始化脚本
├── docker-compose.yml      # Docker Compose 编排
├── .env.example            # 环境变量模板
└── .env                    # 本地环境变量 (git ignored)
```

## License

Private
