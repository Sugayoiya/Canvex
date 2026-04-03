# Phase 13: SkillDescriptor Enhancement + Pipeline Fix - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

增强 Skill 元数据系统：给 SkillDescriptor 和 SKILL.md frontmatter 添加依赖声明、分层分类和安全元数据字段。废弃 4 个冗余 SkillRegistry handler。将 tool_middleware 从硬编码集合重构为元数据驱动的动态工具筛选。

**不在此 Phase 范围内：**
- ArtifactStore + ToolInterceptor（Phase 14）
- Pipeline 修复 PIPE-01/02/04（延迟到 Phase 14，与 ArtifactStore 一起实现）
- QueryEngine + 成本跟踪（Phase 15）
- Admin Skill 管理页面（Phase 16）
- Canvas 节点执行路径不受影响——Canvas 生成按钮直接调 Provider，不走 Skill 系统

</domain>

<decisions>
## Implementation Decisions

### 描述符统一策略
- **D-01:** 并行扩展——SkillDescriptor (Python dataclass) 和 SKILL.md (YAML frontmatter) 统一字段名，两套运行机制不变。SkillLoader 解析 frontmatter 后生成与 SkillDescriptor 兼容的内部表示
- **D-02:** SkillDescriptor 新增字段（对标 OpenStoryline NodeMeta + Claude Code 工具标记）：
  - `skill_kind: str` — 操作类别（细粒度，如 `split_clips` / `convert_screenplay` / `generate_image`）
  - `require_prior_kind: list[str]` — auto 模式下的前置依赖 kind 列表
  - `default_require_prior_kind: list[str]` — default/skip 模式下的前置依赖
  - `supports_skip: bool` — 是否支持 skip 模式
  - `skill_tier: str` — 三层分类：`workflow` / `capability` / `meta`
  - `is_read_only: bool` — Claude Code 风格安全标注
  - `is_destructive: bool` — Claude Code 风格安全标注
  - `timeout: int` — 超时秒数标注
  - `max_result_size_chars: int` — 结果最大字符数标注
- **D-03:** SKILL.md YAML frontmatter 扩展同名字段，SkillLoader 解析并生成 SkillMeta（扩展为包含所有新字段）

### SkillRegistry 4 个 handler 废弃
- **D-04:** Phase 13 废弃 `visual.generate_image`、`video.generate_video`、`canvas.get_state`、`asset.get_project_info` 这 4 个 SkillRegistry handler（标记 deprecated 或删除注册）
- **D-05:** 原因：Agent 聊天走 `ai_tools.py` @tool 直接调 ProviderManager；Canvas 节点浮窗直接调 Provider；`context_tools.py` 已有等价 @tool。两份实现多余
- **D-06:** SkillRegistry / SkillDescriptor 基础设施保留——Phase 14 ArtifactStore、Phase 16 Admin 管理仍需要注册表机制

### Pipeline 修复延迟
- **D-07:** PIPE-01（参数对齐）、PIPE-02（Celery 异步轮询）、PIPE-04（SSE 步骤进度）全部延迟到 Phase 14，与 ArtifactStore + ToolInterceptor 一起实现
- **D-08:** 参考 OpenStoryline 的 ToolInterceptor 模式：调用前自动检查 `require_prior_kind` 并递归补跑缺失依赖节点，调用后自动存储产物。这替代了旧 pipeline_tools.py 的硬编码编排

### 动态工具筛选
- **D-09:** 元数据驱动——用 `skill_tier` 和 session 上下文（has_canvas / has_episode 等）决定暴露哪些工具，替代 `tool_middleware.py` 中的硬编码集合（`_ALWAYS_TOOLS` / `_CANVAS_TOOLS` / `_STORYBOARD_TOOLS` / `_SCRIPT_TOOLS`）
- **D-10:** 目标仍是 ≤10~14 tools per context window，但筛选逻辑从工具名改为读取工具元数据

### 安全元数据
- **D-11:** Phase 13 仅标注——`is_read_only` / `is_destructive` / `timeout` / `max_result_size_chars` 作为描述字段写入 system prompt，让模型感知。暂不做运行时强制执行
- **D-12:** 参考 Claude Code 的标注模式：Agent 在 system prompt 中看到工具标记后自行判断是否需要确认

### skill_kind 值域
- **D-13:** 按操作类型细粒度定义（类似 OpenStoryline 的 `node_kind`），而非按业务实体粗粒度。值如：`split_clips` / `convert_screenplay` / `create_storyboard` / `detail_storyboard` / `extract_characters` / `extract_scenes` / `generate_shot_image` / `generate_shot_video` / `episode_pipeline` / `refine_text`

### "14 skills" 重新定义
- **D-14:** DESC-07 "existing 14 skills annotated" 重新理解为：10 个 SKILL.md 全部在 frontmatter 加新字段 + 4 个 @tool（`generate_image` / `generate_video` / `read_skill` / `read_resource`）通过代码注解（或 SkillDescriptor wrapper）标注。废弃的 4 个 SkillRegistry handler 不计入

### Claude's Discretion
- SKILL.md frontmatter 的具体 YAML 字段命名细节（是否用 snake_case 还是 kebab-case）
- SkillLoader 内部从 SkillMeta NamedTuple 升级到 dataclass 的具体实现
- tool_middleware 重构的具体代码组织（是否抽取为独立模块）
- 各 SKILL.md 具体的 skill_kind / require_prior_kind 值（基于 SKILL.md 正文内容推断）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 现有 Skill 系统
- `api/app/skills/descriptor.py` — 当前 SkillDescriptor dataclass（需扩展新字段）
- `api/app/skills/registry.py` — SkillRegistry（保留基础设施，废弃 4 个 handler）
- `api/app/skills/register_all.py` — Skill 注册入口（需删除 4 个 handler 注册）
- `api/app/skills/context.py` — SkillContext dataclass
- `api/app/skills/visual/generate_image.py` — 废弃目标
- `api/app/skills/video/generate_video.py` — 废弃目标
- `api/app/skills/canvas_ops/get_state.py` — 废弃目标
- `api/app/skills/asset/get_project_info.py` — 废弃目标

### Agent SKILL.md 系统
- `api/app/agent/skill_loader.py` — SkillLoader 三级加载（需扩展 frontmatter 解析）
- `api/app/agent/skills/*/SKILL.md` — 10 个 SKILL.md 文件（需扩展 frontmatter）
- `api/app/agent/tools/skill_tools.py` — read_skill / read_resource @tool

### Agent 工具系统
- `api/app/agent/tool_middleware.py` — 静态工具门控（需重构为元数据驱动）
- `api/app/agent/tools/ai_tools.py` — generate_image / generate_video @tool（保留，不受影响）
- `api/app/agent/tools/context_tools.py` — 上下文查询 @tool
- `api/app/agent/tools/mutation_tools.py` — 写操作 @tool
- `api/app/agent/agent_service.py` — Agent 工厂（调用 get_tools_for_context）
- `api/app/agent/context_builder.py` — system prompt 构建（需注入安全元数据）

### 参考实现
- FireRed-OpenStoryline `NodeMeta` — `/Users/sugayoiya/Documents/github-repository/FireRed-OpenStoryline/src/open_storyline/nodes/core_nodes/base_node.py`
- FireRed-OpenStoryline `NodeManager` — `/Users/sugayoiya/Documents/github-repository/FireRed-OpenStoryline/src/open_storyline/nodes/node_manager.py`
- FireRed-OpenStoryline `ToolInterceptor` — `/Users/sugayoiya/Documents/github-repository/FireRed-OpenStoryline/src/open_storyline/mcp/hooks/node_interceptors.py`
- Canvex 优化规划文档 — `.cursor/plans/canvex_agent_优化规划_3c790983.plan.md`

### Requirements
- `.planning/REQUIREMENTS.md` §SkillDescriptor Enhancement — DESC-01 through DESC-08
- `.planning/REQUIREMENTS.md` §Pipeline Fix — PIPE-01, PIPE-02, PIPE-04（延迟到 Phase 14）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SkillDescriptor` dataclass (`descriptor.py`): 已有 name/display_name/description/category/input_schema/output_schema/triggers/execution_mode/celery_queue/estimated_duration 字段，需在此基础上新增
- `SkillLoader` (`skill_loader.py`): 已有 YAML frontmatter 解析逻辑，需扩展解析新字段
- `SkillMeta` NamedTuple: 仅 name+description+path，需升级为 dataclass 以容纳新字段
- `tool_middleware.py` 的 `get_tools_for_context()`: 已有上下文参数 (has_canvas/has_episode)，可复用作为元数据筛选的输入信号

### Established Patterns
- SKILL.md YAML frontmatter 格式: `---\nname: xxx\ndescription: >-\n  ...\n---`
- SkillLoader 使用 `yaml.safe_load` 解析 frontmatter
- `tool_middleware.py` 按集合名白名单过滤 `all_tools` 列表
- Agent @tool 函数使用 Pydantic `BaseModel` 作为 `args_schema`

### Integration Points
- `register_all.py` — 删除 4 个 handler 注册调用
- `skill_loader.py` `_parse_frontmatter()` — 扩展解析新 YAML 字段
- `skill_loader.py` `build_system_prompt_fragment()` — 注入安全元数据和 tier 信息
- `tool_middleware.py` `get_tools_for_context()` — 从硬编码集合改为读取工具 metadata
- `context_builder.py` `build_system_prompt()` — 在 prompt 中展示工具安全标记

</code_context>

<specifics>
## Specific Ideas

- 参考 OpenStoryline 的 `NodeMeta` 字段设计，特别是 `require_prior_kind` / `default_require_prior_kind` / `priority` 的三元组模式
- 参考 Claude Code 的工具安全标注（`isReadOnly` / `isDestructive` / `timeout` / `maxResultSizeChars`），Phase 13 仅做标注不做强制执行
- Canvas 节点浮窗（AI Image Process / AI Text Generate / AI Video Generate）的"生成"按钮直接调 Provider，不经过 Skill 系统——这是明确的架构边界
- skill_kind 值域参考 OpenStoryline 的细粒度 node_kind（如 `split_clips`、`generate_script`），而非 Canvex 当前的粗粒度 SkillCategory（如 `TEXT`、`VISUAL`）

</specifics>

<deferred>
## Deferred Ideas

- ToolInterceptor 自动补跑缺失依赖 + ArtifactStore 产物存储 — Phase 14
- PIPE-01/02/04 Pipeline 修复 — Phase 14（与 ArtifactStore 一起）
- 安全元数据运行时强制执行（timeout 掐断、max_result_size_chars 截断、is_destructive 确认弹窗）— 后续 Phase
- SkillRegistry 完全重构（是否与 SkillLoader 合并为单一注册表）— Phase 14+ 评估
- Canvas 节点执行走 Agent Skill 路径（AGENT_CHAT_FOR_CANVAS flag）— v3.1

</deferred>

---

*Phase: 13-skilldescriptor-enhancement-pipeline-fix*
*Context gathered: 2026-04-03*
