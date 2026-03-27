# Canvas Studio

AI 驱动的分镜与视频创作工作台，采用 Agent-as-Orchestrator 架构，通过 Skill 体系 + Celery 异步任务编排实现端到端的影视创作流程。

## 架构概览

```
用户 → 系统内 Agent (理解意图 + 画布感知) → SkillRegistry (发现 + 调用 Skill)
     → Celery (异步执行) → 画布节点 (结果回写)
```

**核心设计：**
- **Skill 体系**：每个核心能力封装为带描述、输入/输出 schema、生命周期管理的 Skill 单元
- **Agent-as-Orchestrator**：AI Agent 通过 Tool Calling 调用 Skills，不直接操作业务逻辑
- **企业级 Celery**：4 队列路由 (ai_generation / media_processing / pipeline / quick)
- **完备日志**：structlog 结构化日志 + trace_id 链路追踪 + AI 调用审计

## 技术栈

- **前端**：Next.js 16, React 19, TypeScript, TailwindCSS, Zustand, React Query, XYFlow
- **后端**：FastAPI, SQLAlchemy (async), Pydantic, Celery
- **数据库**：PostgreSQL (生产) / SQLite (开发)
- **队列**：Redis (Celery broker & result backend)
- **AI**：OpenAI, Gemini, DeepSeek (可扩展)

## 快速开始

### SQLite 模式 (无 Docker)

```bash
# 后端
cd api
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000

# 前端
cd web
npm install
npm run dev
```

> SQLite 模式下无需 Redis，Celery async Skills 会降级为同步调用。

### 完整模式 (Docker)

```bash
docker compose up -d          # 启动 Redis + PostgreSQL
cd api && uv run uvicorn app.main:app --reload --port 8000
cd web && npm run dev

# 启动 Celery workers (单独终端)
cd api && celery -A app.celery_app worker -Q ai_generation,quick -c 4 --loglevel=info
```

## API 文档

启动后端后访问：http://localhost:8000/docs

### 核心端点

| 端点 | 说明 |
|------|------|
| `POST /api/v1/auth/register` | 注册 |
| `POST /api/v1/auth/login` | 登录 |
| `GET /api/v1/skills/` | 列出所有 Skills |
| `GET /api/v1/skills/tools` | 获取 Tool Calling 格式定义 |
| `POST /api/v1/skills/invoke` | 调用 Skill |
| `POST /api/v1/skills/poll` | 轮询异步 Skill 进度 |
| `GET /api/v1/logs/skills` | Skill 执行日志 |
| `GET /api/v1/logs/ai-calls` | AI 调用日志 |
| `GET /api/v1/logs/trace/{id}` | 完整链路追踪 |
| `GET /health` | 健康检查 |

## 已注册 Skills (Phase 1)

| Skill | 类别 | 模式 | 说明 |
|-------|------|------|------|
| `text.llm_generate` | TEXT | async | 通用 LLM 文本生成 |
| `extract.characters` | EXTRACT | async | 从文本提取角色 |
| `extract.scenes` | EXTRACT | async | 从文本提取场景 |
| `canvas.get_state` | CANVAS | sync | 获取画布状态 |
| `asset.get_project_info` | ASSET | sync | 获取项目信息 |

## 目录结构

```
canvas-studio/
├── api/                          # 后端 (FastAPI)
│   ├── app/
│   │   ├── main.py               # 入口
│   │   ├── celery_app.py         # Celery 实例
│   │   ├── api/v1/               # API 路由
│   │   ├── skills/               # Skill 体系 (核心)
│   │   │   ├── registry.py       # SkillRegistry
│   │   │   ├── descriptor.py     # SkillDescriptor + SkillResult
│   │   │   ├── executor.py       # SkillExecutor
│   │   │   ├── context.py        # SkillContext
│   │   │   └── text/extract/...  # 各类 Skill 实现
│   │   ├── tasks/                # Celery 任务
│   │   ├── models/               # 数据库模型
│   │   ├── core/                 # 配置/认证/日志
│   │   └── services/             # 底层服务
│   └── pyproject.toml
├── web/                          # 前端 (Next.js)
│   └── src/
├── docker-compose.yml
└── README.md
```
