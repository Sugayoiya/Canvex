# Phase 13: SkillDescriptor Enhancement + Pipeline Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 13-skilldescriptor-enhancement-pipeline-fix
**Areas discussed:** 描述符统一策略, Pipeline修复重新定义, 动态工具筛选策略, 安全元数据执行力度, SkillRegistry handler去留, skill_kind值域

---

## 描述符统一策略

| Option | Description | Selected |
|--------|-------------|----------|
| 并行扩展 | SkillDescriptor 加新字段，SKILL.md frontmatter 也加同名字段，SkillLoader 解析后生成统一内部表示。两套运行机制不变但元数据格式对齐 | ✓ |
| 仅扩展 SkillRegistry | SkillDescriptor 加新字段，SKILL.md 保持简单，通过约定命名推断属性 | |
| 合并为一套 | SKILL.md 也注册到 SkillRegistry，统一管理。大改造 | |

**User's choice:** 并行扩展
**Notes:** 用户首次选择时不理解问题含义。通过分析 FireRed-OpenStoryline（双轨工具系统：MCP 节点 + skillkit）和 libtv-skills 后，重新呈现问题并附带参考实现对比表，用户选择了"并行扩展"。

---

## Pipeline 修复重新定义

| Option | Description | Selected |
|--------|-------------|----------|
| 重新指向 Celery 异步链 | PIPE-01 改为 SkillRegistry 参数对齐，PIPE-02 改为 Agent 调 Celery 轮询修复 | |
| 标记废弃/延迟 | 旧 pipeline 不存在，需求移到 Out of Scope | |
| 采用 ToolInterceptor 模式 | 参考 OpenStoryline 加 ToolInterceptor，但依赖 ArtifactStore (Phase 14) | |
| 延迟到 Phase 14 | PIPE-01/02/04 全部延到 Phase 14 和 ArtifactStore 一起做 | ✓ |

**User's choice:** 延迟到 Phase 14
**Notes:** 用户认为 pipeline 本质是编排后的流程，LangChain/OpenStoryline 里应有这种模式。讨论后确认 ToolInterceptor + ArtifactStore（OpenStoryline 方案）是最佳路径，但依赖 Phase 14，因此将 PIPE 需求全部延迟。

---

## 动态工具筛选策略

| Option | Description | Selected |
|--------|-------------|----------|
| 元数据驱动 | 用 skill_tier 和 session 上下文将工具分组，只暴露当前场景需要的工具。保留现有 tool_middleware 逻辑但用元数据替代硬编码 | ✓ |
| 保持现状 + 微调 | 当前静态门控工作得很好，只需把硬编码集合改为从 skill_tier/category 读取 | |
| 不做过滤 | 像 OpenStoryline 一样全部给 Agent，靠元数据和 prompt 引导 | |

**User's choice:** 元数据驱动
**Notes:** 无额外说明。

---

## 安全元数据执行力度

| Option | Description | Selected |
|--------|-------------|----------|
| 运行时强制执行 | timeout 用 asyncio.wait_for 强制，max_result_size_chars 截断返回，is_destructive 在 system prompt 标注"需确认" | |
| 仅标注 | 先只加字段，注入 system prompt 让模型自己判断，后续 Phase 再做强制执行 | ✓ |

**User's choice:** 仅标注，参考 Claude Code 的标注模式
**Notes:** 用户明确说"可以先参考 Claude Code 这样标注先"。

---

## SkillRegistry 4 个 handler 去留

| Option | Description | Selected |
|--------|-------------|----------|
| 保留但只用于非 Agent 场景 | Canvas 执行服务、未来外部调用可能需要 Celery 异步版本 | |
| 废弃，统一用 @tool | Agent 已有 ai_tools.py，Canvas 直接调 Provider，两份实现多余 | ✓ |
| 暂不处理 | Phase 13 只加字段，不改架构 | |

**User's choice:** 废弃 4 个 handler
**Notes:** 用户主动指出：Canvas 节点浮窗里的生成按钮直接调 Provider 即可，不需要走 Skill 系统。"直接调用对应 provider 不行吗"——确认后废弃这 4 个冗余 handler。

---

## skill_kind 值域

| Option | Description | Selected |
|--------|-------------|----------|
| 按产物类型（粗粒度） | script / character / scene / storyboard / shot_image / shot_video / project_info / canvas_state | |
| 按操作类型（细粒度） | split_clips / convert_screenplay / create_storyboard / generate_image 等，类似 OpenStoryline | ✓ |

**User's choice:** 按操作类型（细粒度）
**Notes:** 无额外说明。

---

## Claude's Discretion

- SKILL.md frontmatter 具体 YAML 字段命名（snake_case vs kebab-case）
- SkillLoader 内部类型升级细节
- tool_middleware 重构代码组织
- 各 SKILL.md 具体 skill_kind / require_prior_kind 值推断

## Deferred Ideas

- ToolInterceptor + ArtifactStore → Phase 14
- PIPE-01/02/04 → Phase 14
- 安全元数据运行时强制执行 → 后续 Phase
- Canvas 节点走 Agent Skill 路径 → v3.1
