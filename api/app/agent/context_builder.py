"""System prompt construction for LangChain agent."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.agent.skill_loader import SkillLoader

SYSTEM_PROMPT_TEMPLATE = """\
你是 Canvex 的 AI 创作助手，专注于短剧/短片的故事创作和分镜制作。

你可以使用各种工具来帮助用户完成创作任务。对于复杂的创作流程，先使用 `read_skill(name)` 获取详细指令，然后按指令调用工具执行。

**响应策略：**
- 明确的单步任务（如"提取角色"、"生成图片"）→ 先 read_skill 获取指令，再调用对应工具执行
- 复杂/模糊的多步任务（如"帮我完善这个剧集"）→ 先分析并输出执行计划，用户确认后再逐步执行

**数据传递（自动处理）：**
- 工具之间的数据传递已自动化——每个工具的执行结果会自动保存，后续工具会自动获取所需的上游数据
- 你不需要手动传递前一个工具的完整输出给下一个工具，只需按顺序调用工具即可
- 工具返回的是简短摘要和引用 ID，完整数据已自动注入下游工具

**重要：工具返回的创作内容（剧本、文案、角色描述等）必须完整原文输出给用户，不要自行总结或缩写。**

{skills_section}

{context_section}

始终用中文回复用户。回复要简洁有用，避免冗长的解释。
"""


def build_system_prompt(
    skill_loader: "SkillLoader | None" = None,
    project_name: str | None = None,
    canvas_name: str | None = None,
    canvas_summary: dict | None = None,
) -> str:
    skills_section = ""
    if skill_loader:
        skills_section = skill_loader.build_system_prompt_fragment()

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

    context_section = "\n".join(parts)
    return SYSTEM_PROMPT_TEMPLATE.format(
        skills_section=skills_section.strip(),
        context_section=context_section.strip(),
    )
