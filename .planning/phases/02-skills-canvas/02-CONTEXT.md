# Phase 02: Full Skill Migration + Base Canvas + Billing Baseline — Context

**Gathered:** 2026-03-27
**Status:** Ready for planning
**Source:** PRD Express Path (canvas_studio_重构方案_v2 + 原项目 Short-Drama-Studio 代码分析)

<domain>
## Phase Boundary

Phase 02 在 Phase 01 骨架基础上完成三件事：
1. **Skill 迁移** — 将原项目 5 类业务服务 (TEXT/EXTRACT/SCRIPT/STORYBOARD/VISUAL) 迁移为 Canvex Skill
2. **基础画布** — 用 @xyflow/react 搭建画布 UI + 5 种核心节点 + 通过 SkillRegistry 执行
3. **计费基线** — ModelPricing 价格表 + AICallLog 写入路径自动计算费用

Phase 01 已交付：SkillRegistry/Executor/Celery 骨架、5 个占位 Skill、Auth/User/Team/Project 模型、auth/skills/logs API、structlog trace_id 中间件、前端登录/注册/项目列表壳。
</domain>

<decisions>
## Implementation Decisions

### LLM Provider 迁移策略
- 从原项目 `api/app/services/ai/` 迁移 LLM Provider 基础设施
- 源文件：`base.py` (Message + AIProviderBase), `provider_manager.py` (ProviderManager), `entities.py` (ModelType/AIModelEntity)
- 三个 LLM Provider 都使用 OpenAI-compatible SDK：Gemini (base_url=generativelanguage.googleapis.com), OpenAI, DeepSeek (base_url=api.deepseek.com)
- Phase 02 仅支持 env var 凭证查找，不实现团队级凭证回退
- Provider generate() 必须有 retry (1 次重试 on transient error) + timeout (默认 60s)
- AICallLog 写入必须 fail-open (try/except, 日志写失败不能影响 Provider 调用)
- ContextVar 在 Celery worker 中必须在 handler 调用前 rehydrate

### Skill 迁移范围 (从原项目 business services)
- **TEXT**: 从 `text_workshop_service.py` 迁移 → `text.refine`, `text.llm_generate` (已有占位)
- **EXTRACT**: 从 `character_service.py` + `scene_service.py` 迁移 → `extract.characters` (已有占位), `extract.scenes` (已有占位)
- **SCRIPT**: 从 `story_to_script_service.py` 迁移 → `script.split_clips`, `script.convert_screenplay`
- **STORYBOARD**: 从 `script_to_storyboard_service.py` 迁移 → `storyboard.plan`, `storyboard.detail`
- **VISUAL**: 从 `image_service.py` + 原 providers 迁移 → `visual.generate_image`, `visual.character_prompt`, `visual.scene_prompt`
- 所有 Skill handler 必须调用真实 LLM Provider，不是占位返回
- 每个 Skill 使用 Pydantic schema 做输入输出校验
- Prompt 暂时硬编码在 Skill handler 中，不依赖 PromptTemplateService

### 画布后端模型
- 从原项目 `api/app/models/canvas.py` 迁移 Canvas/CanvasNode/CanvasEdge 模型
- 原项目已有成熟的画布模型结构：Canvas (project-scoped), CanvasNode (type, config JSON, position), CanvasEdge (source/target/handles)
- 添加 project-scoped 授权检查到所有 Canvas CRUD 端点 (通过 resolve_project_access)
- Canvas API: CRUD for canvas/nodes/edges + node execution endpoint

### 画布前端架构
- 从原项目 `web/src/components/canvas/` 参考但不直接复制（Canvex 是简化重构）
- 5 种核心节点类型：text-input (被动), llm-generate (text.llm_generate), extract (extract.characters/scenes), image-gen (visual.generate_image), output (被动展示)
- nodeTypes 必须定义为模块级常量（避免 xyflow 无限重渲染）
- 使用 xyflow 内置 useNodesState/useEdgesState 管理图状态，zustand 仅管理应用级状态
- 节点执行流程：读取输入 → skillsApi.invoke() → 同步直接显示 / 异步 poll with backoff → 更新节点数据
- Polling 规则：初始 3s，指数退避到 15s max，最多 60 次，unmount 时清理
- 连接规则：类型兼容矩阵 (text/json/image/any)，前后端双重校验

### 计费基线
- ModelPricing 表 (provider, model, pricing_model, 各类单价, effective_from/to, is_active)
- 使用 Python Decimal + DB Numeric(12,8) 避免浮点精度问题
- AICallLog 写入时自动从 pricing 表查价计算 cost
- Admin-only 价格管理 API (require_admin 依赖)
- 用量统计 API：按时间/provider/model 聚合 AICallLog
- 不在 Phase 02 实现配额控制和用量聚合任务（推迟到 Phase 04）

### Claude's Discretion
- Skill handler 内部的具体 prompt 措辞
- Canvas UI 的具体布局细节和样式
- 非关键的 API 响应格式细节
- 测试覆盖粒度
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 原项目迁移源 (Short-Drama-Studio)
- `api/app/services/ai/base.py` — Message dataclass + AIProviderBase 抽象类
- `api/app/services/ai/provider_manager.py` — ProviderManager 注册表与凭证回退
- `api/app/services/ai/entities.py` — ModelType 枚举 + AIModelEntity
- `api/app/services/ai/image_service.py` — ImageGenerationService 编排
- `api/app/services/ai/model_providers/__base/llm_provider.py` — LLMProviderBase 含 auto_log_generation
- `api/app/services/ai/model_providers/__base/image_provider.py` — ImageProviderBase
- `api/app/services/ai/model_providers/gemini/llm.py` — GeminiProvider
- `api/app/services/ai/model_providers/openai/llm.py` — OpenAIProvider
- `api/app/services/ai/model_providers/deepseek/llm.py` — DeepSeekProvider
- `api/app/services/ai/model_providers/gemini/image.py` — GeminiImageProvider
- `api/app/services/ai/business/text_workshop_service.py` — TextWorkshopService
- `api/app/services/ai/business/character_service.py` — CharacterService
- `api/app/services/ai/business/scene_service.py` — SceneService
- `api/app/services/ai/business/story_to_script_service.py` — StoryToScriptService
- `api/app/services/ai/business/script_to_storyboard_service.py` — ScriptToStoryboardService
- `api/app/services/ai/business/context_service.py` — ContextService (上下文合并)
- `api/app/models/canvas.py` — Canvas, CanvasNode, CanvasEdge, CanvasTemplate, CanvasVersion
- `web/src/components/canvas/` — 完整画布组件参考

### Canvex 现有基础 (Phase 01 交付)
- `api/app/skills/registry.py` — SkillRegistry 单例 + register/invoke/poll
- `api/app/skills/descriptor.py` — SkillDescriptor + SkillResult + SkillCategory
- `api/app/skills/context.py` — SkillContext dataclass
- `api/app/skills/executor.py` — SkillExecutor (sync/async 分发 + SkillExecutionLog)
- `api/app/tasks/skill_task.py` — Celery run_skill_task + event loop handling
- `api/app/models/ai_call_log.py` — AICallLog 表定义
- `api/app/models/skill_execution_log.py` — SkillExecutionLog 表定义
- `api/app/core/config.py` — Settings (含 GEMINI/OPENAI/DEEPSEEK API key)
- `api/app/core/database.py` — AsyncSessionLocal + Base + init_db
- `api/app/core/deps.py` — get_current_user, resolve_project_access
- `api/app/api/v1/skills.py` — 现有 skills list/invoke/poll API
- `web/src/lib/api.ts` — skillsApi (list/tools/invoke/poll), logsApi

### 重构方案
- `Canvex/canvas_studio_重构方案_v2_4ed204b5.plan.md` — Section 二 (Skill 体系), Section 三 (完整 Skill 清单), Section 七 (节点与 Skill 关系), Section 八 (日志体系), Section 九 (计费体系)
</canonical_refs>

<specifics>
## Specific Ideas

### 原项目关键文件大小参考
- `text_workshop_service.py` — 长文本分段、润色/改写，依赖 LLM provider
- `character_service.py` — 角色提取/生成，输出结构化 JSON (name/description/gender/age)
- `scene_service.py` — 场景提取/生成，输出结构化 JSON
- `story_to_script_service.py` — 原文→剧本 pipeline (split_clips + convert_screenplay)，含锁机制和 JSON 解析
- `script_to_storyboard_service.py` — 剧本→分镜 pipeline (plan + detail)，继承 PipelineExecutor
- `image_service.py` — ImageGenerationService 编排多 image provider

### 原项目 Canvas 组件参考
- `canvas-workspace.tsx` — ReactFlow 主容器 + SSE 执行
- `nodes/` — 6 种节点 (source-image, source-text, prompt-input, ai-image-process, ai-text-generate, output) + generic-workflow-node
- `hooks/use-canvas-state.ts` — 画布状态管理
- `hooks/use-canvas-execution.ts` — 执行/SSE/workflow 交互
- `types.ts` — 节点类型定义 + NODE_TYPE_METAS

### Review 反馈要点 (已纳入决策)
- 02-01: fail-open AICallLog + ContextVar rehydration in Celery ✓
- 02-02: project-scoped authz on Canvas CRUD ✓
- 02-03: Pydantic structured output contracts per skill ✓
- 02-04: Split visual.generate_image into separate plan ✓
- 02-05: Split frontend into 2-3 incremental units ✓
- 02-05: Polling backoff + max attempts + unmount cleanup ✓
- 02-06: Admin-only auth enforcement ✓
- Cross: Integration acceptance test gate ✓
</specifics>

<deferred>
## Deferred Ideas

- 团队级凭证回退 (3-tier: team → global → env) — Phase 06
- PromptTemplateService 数据库模板管理 — Phase 03+
- Pipeline Skills (chain/chord 编排) — Phase 03
- 配额控制 (TeamQuota/UserQuota) — Phase 04
- 用量聚合定时任务 (Celery Beat) — Phase 04
- 视频生成 Skills — Phase 05
- SSE 实时进度推送 — Phase 03 (Agent 系统)
- 画布交互打磨 (拖拽创建、框选、快捷键) — Phase 05
</deferred>

---

*Phase: 02-skills-canvas*
*Context gathered: 2026-03-27 via PRD Express Path (重构方案 v2 + 原项目分析)*
