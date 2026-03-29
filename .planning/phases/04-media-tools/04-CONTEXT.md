---
phase: "04"
name: "media-tools"
created: 2026-03-27
updated: 2026-03-30
---

# Phase 04: Media/Slash Skills + Quota Controls — Context

**Gathered:** 2026-03-30
**Status:** Ready for re-planning (--reviews mode)

<domain>
## Phase Boundary

Replace 5 functional-type canvas nodes with 4 material-type nodes (text/image/video/audio), add focus-panel interaction system, template-driven workflows, asset library, video generation skill, and enforce quota constraints.

</domain>

<decisions>
## Implementation Decisions

### Backward Compatibility — DROPPED
- **旧节点不需要了** — 不保留旧节点类型（text-input, llm-generate, extract, image-gen, output, source-text, ai-text-generate, prompt-input, source-image, ai-image-process）的向后兼容映射
- 删除 LEGACY_TYPE_MAP 和 14 条 nodeTypes 注册表中的 10 条旧映射
- 现有画布中的旧节点数据需要执行一次性迁移（更新 node_type 字段为新材料类型）
- 前端 connection-rules.ts 只需支持 4 种材料类型，无需兼容旧类型

### Quota Enforcement (from Codex review)
- 将 fail-open 改为 **fail-closed**（Codex HIGH 级建议）
- 使用原子计数器递增（SELECT ... FOR UPDATE）
- 用 skill_execution_id 做 update_usage 幂等去重
- Quota admin 端点需要角色权限检查 + 审计日志

### Asset Library Security (from Codex review)
- Asset CRUD 端点需要项目成员权限检查
- 添加分页/过滤/排序
- 添加 PATCH /assets/{id} 端点
- JSON payload 大小限制

### Template System Safety (from Codex review)
- 模板应用时做图验证（环检测 + NODE_IO 兼容性检查）

### Integration Strategy (from Codex review)
- canvas-workspace.tsx 增量集成，避免一次性全量重写

### Claude's Discretion
- 具体的数据库迁移脚本实现方式
- CSS token 数量和命名细节
- 面板定位和 z-index 策略
- 视频 provider 可用性探测方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Contracts
- `.planning/phases/04-media-tools/04-CANVAS-NODE-DESIGN.md` — Canvas node redesign 4-wave specification
- `.planning/phases/04-media-tools/04-UI-SPEC.md` — UI design contract with interaction specs
- `.planning/phases/04-media-tools/designs/component-specs.md` — Pixel-precise component specifications
- `.planning/phases/04-media-tools/designs/design-tokens.json` — Dual-theme token system

### Cross-AI Review Feedback
- `.planning/phases/04-media-tools/04-REVIEWS.md` — Codex review with per-plan concerns and suggestions

### Research
- `.planning/phases/04-media-tools/04-RESEARCH.md` — Domain research with architecture patterns and pitfalls

</canonical_refs>

<deferred>
## Deferred Ideas

- Audio node 完整实现（Phase 04 仅做占位符）
- 精确 quota 执行（accept minor overshoot for Phase 04 MVP → Phase 05 加强）

</deferred>

---

*Phase: 04-media-tools*
*Context gathered: 2026-03-30 via --reviews mode + user decision (旧节点不需要了)*
