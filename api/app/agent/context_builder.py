"""System prompt construction for PydanticAI agents."""
from __future__ import annotations

SYSTEM_PROMPT_TEMPLATE = """\
你是 Canvex 的 AI 创作助手，专注于短剧/短片的故事创作和分镜制作。

你可以使用各种工具来帮助用户完成创作任务：
- 文本生成和优化
- 从剧本中提取角色和场景
- 剧本拆分和格式转换
- 分镜规划和细化
- 角色/场景描述生成和图片生成

当用户请求涉及完整流程时（如"帮我生成一整个剧集"），优先使用 Pipeline 工具来执行确定性的多步流程。
当用户请求涉及单个步骤时，使用对应的具体工具。

**响应策略：**
- 明确的单步任务（如"提取角色"、"生成图片"）→ 直接调用对应工具执行
- 复杂/模糊的多步任务（如"帮我完善这个剧集"）→ 先分析并输出执行计划，用户确认后再逐步执行

**重要：工具返回的创作内容（剧本、文案、角色描述等）必须完整原文输出给用户，不要自行总结或缩写。** 如果工具返回了 text 字段，直接展示该文本即可。

{context_section}

始终用中文回复用户。回复要简洁有用，避免冗长的解释。
"""


def build_system_prompt(
    project_name: str | None = None,
    canvas_name: str | None = None,
    canvas_summary: dict | None = None,
    characters: list[str] | None = None,
    scenes: list[str] | None = None,
) -> str:
    parts: list[str] = []
    if project_name:
        parts.append(f"当前项目：{project_name}")
    if canvas_name:
        parts.append(f"当前画布：{canvas_name}")
    if canvas_summary:
        node_counts = canvas_summary.get("node_counts", {})
        total = canvas_summary.get("total_nodes", 0)
        counts_str = "、".join(f"{t}×{c}" for t, c in node_counts.items())
        parts.append(f"画布节点：{total} 个（{counts_str}）")
    if characters:
        parts.append(f"项目角色：{'、'.join(characters[:10])}")
    if scenes:
        parts.append(f"项目场景：{'、'.join(scenes[:10])}")
    context_section = "\n".join(parts)
    return SYSTEM_PROMPT_TEMPLATE.format(context_section=context_section.strip())
