"""script.split_clips — Split a story into numbered clip segments via LLM."""
import logging
from typing import Any

from pydantic import BaseModel, field_validator

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)


class ClipSegment(BaseModel):
    clip_number: int
    title: str
    content: str
    summary: str = ""

    @field_validator("clip_number")
    @classmethod
    def clip_number_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("clip_number must be >= 1")
        return v

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("content must not be empty")
        return v


descriptor = SkillDescriptor(
    name="script.split_clips",
    display_name="剧本分段",
    description="将故事文本按情节转折点分成若干片段（Clip），返回编号、标题、内容和摘要。",
    category=SkillCategory.SCRIPT,
    triggers=["分段", "拆分片段", "split clips", "split story"],
    execution_mode="async_celery",
    celery_queue="ai_generation",
    estimated_duration="medium",
    input_schema={
        "type": "object",
        "properties": {
            "story": {"type": "string", "description": "待拆分的故事文本"},
            "target_clips": {"type": "integer", "description": "目标片段数 (可选, 默认 10)", "default": 10},
            "provider": {"type": "string", "description": "AI 提供商 (可选, 默认 gemini)"},
            "model": {"type": "string", "description": "模型名称 (可选)"},
        },
        "required": ["story"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "clips": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "clip_number": {"type": "integer"},
                        "title": {"type": "string"},
                        "content": {"type": "string"},
                        "summary": {"type": "string"},
                    },
                },
            },
            "warnings": {"type": "array", "items": {"type": "string"}},
        },
    },
)

_SYSTEM_PROMPT = (
    "你是专业的剧本编剧。将以下故事按情节转折点分成 {target_clips} 个片段。\n"
    "以 JSON 数组返回，每个元素包含:\n"
    "clip_number(序号), title(标题), content(该段原文内容), summary(该段摘要)。\n"
    "仅返回 JSON 数组，不要其他文字。"
)


async def handle_split_clips(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    story = params.get("story", "")
    if not story:
        return SkillResult.failed("story 不能为空")

    target_clips = params.get("target_clips", 10)
    provider_name = params.get("provider", "gemini")
    model_name = params.get("model")

    from app.services.ai.ai_call_logger import set_ai_call_context
    set_ai_call_context(
        trace_id=ctx.trace_id,
        user_id=ctx.user_id,
        team_id=ctx.team_id,
        project_id=ctx.project_id,
    )

    from app.services.ai.provider_manager import resolve_llm_provider
    from app.services.ai.base import Message

    try:
        provider, _key_id = await resolve_llm_provider(provider_name, model_name, ctx)
        system_prompt = _SYSTEM_PROMPT.format(target_clips=target_clips)
        messages = [
            Message(role="system", content=system_prompt),
            Message(role="user", content=story),
        ]
        raw = await provider.generate(messages, temperature=0.5, max_tokens=8000)
    except ValueError as e:
        return SkillResult.failed(str(e))
    except Exception as e:
        logger.exception("script.split_clips LLM call failed")
        return SkillResult.failed(f"LLM 调用失败: {type(e).__name__}: {str(e)[:200]}")

    from app.skills.utils.json_parser import parse_llm_json, LLMJsonParseError

    try:
        parsed = parse_llm_json(raw, wrapper_key="clips")
    except LLMJsonParseError as e:
        return SkillResult.failed(f"JSON 解析失败: {e}")

    clips: list[dict[str, Any]] = []
    warnings: list[str] = []
    items = parsed if isinstance(parsed, list) else [parsed]
    for i, c in enumerate(items):
        try:
            clips.append(ClipSegment(**c).model_dump())
        except Exception as e:
            warnings.append(f"Clip {i} validation failed: {e}")

    if not clips:
        return SkillResult.failed(f"所有片段验证失败: {'; '.join(warnings)}")

    expected = list(range(1, len(clips) + 1))
    actual = [c["clip_number"] for c in clips]
    if actual != expected:
        warnings.append(f"clip_number 序列不连续: expected {expected}, got {actual}")
        for idx, clip in enumerate(clips):
            clip["clip_number"] = idx + 1

    msg = f"拆分为 {len(clips)} 个片段"
    if warnings:
        msg += f" ({len(warnings)} 项警告)"
    return SkillResult(
        status="completed",
        data={"clips": clips, "warnings": warnings},
        message=msg,
    )


def register_split_clips_skill():
    skill_registry.register(descriptor, handle_split_clips)
