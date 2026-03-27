"""storyboard.detail — Enrich shots with camera/composition details via LLM."""
import json
import logging
from typing import Any

from pydantic import BaseModel, field_validator

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)


class DetailedShot(BaseModel):
    shot_number: int
    shot_type: str = ""
    camera_move: str = ""
    composition: str = ""
    lighting: str = ""
    video_prompt: str = ""

    @field_validator("shot_number")
    @classmethod
    def shot_number_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("shot_number must be >= 1")
        return v


descriptor = SkillDescriptor(
    name="storyboard.detail",
    display_name="分镜细化",
    description="为分镜添加摄影细节：景别、运镜、构图、光线和视觉提示词。",
    category=SkillCategory.STORYBOARD,
    triggers=["分镜细化", "细化镜头", "storyboard detail", "shot detail"],
    execution_mode="async_celery",
    celery_queue="ai_generation",
    estimated_duration="long",
    input_schema={
        "type": "object",
        "properties": {
            "shots": {"type": "string", "description": "分镜规划 JSON (字符串或数组)"},
            "style": {"type": "string", "description": "视觉风格提示 (可选)"},
            "provider": {"type": "string", "description": "AI 提供商 (可选, 默认 gemini)"},
            "model": {"type": "string", "description": "模型名称 (可选)"},
        },
        "required": ["shots"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "detailed_shots": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "shot_number": {"type": "integer"},
                        "shot_type": {"type": "string"},
                        "camera_move": {"type": "string"},
                        "composition": {"type": "string"},
                        "lighting": {"type": "string"},
                        "video_prompt": {"type": "string"},
                    },
                },
            },
            "warnings": {"type": "array", "items": {"type": "string"}},
        },
    },
)

_SYSTEM_PROMPT = (
    "你是专业的电影摄影指导。为每个分镜添加摄影细节:\n"
    "shot_type(景别: 特写/中景/远景/全景等), camera_move(运镜: 推/拉/摇/移/固定等), "
    "composition(构图描述), lighting(光线描述), video_prompt(视觉提示词)。\n"
    "{style_context}"
    "以 JSON 数组返回，每个元素必须包含 shot_number 以对应原分镜。\n"
    "仅返回 JSON，不要其他文字。"
)


async def handle_storyboard_detail(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    shots_input = params.get("shots", "")
    if not shots_input:
        return SkillResult.failed("shots 不能为空")

    if isinstance(shots_input, list):
        shots_text = json.dumps(shots_input, ensure_ascii=False)
    else:
        shots_text = shots_input

    style = params.get("style", "")
    provider_name = params.get("provider", "gemini")
    model_name = params.get("model")

    from app.services.ai.ai_call_logger import set_ai_call_context
    set_ai_call_context(
        trace_id=ctx.trace_id,
        user_id=ctx.user_id,
        team_id=ctx.team_id,
        project_id=ctx.project_id,
    )

    from app.services.ai.provider_manager import get_provider_manager
    from app.services.ai.base import Message

    style_ctx = f"视觉风格参考: {style}\n" if style else ""
    system_prompt = _SYSTEM_PROMPT.format(style_context=style_ctx)

    try:
        provider = get_provider_manager().get_provider(provider_name, model=model_name)
        messages = [
            Message(role="system", content=system_prompt),
            Message(role="user", content=shots_text),
        ]
        raw = await provider.generate(messages, temperature=0.5, max_tokens=8000)
    except ValueError as e:
        return SkillResult.failed(str(e))
    except Exception as e:
        logger.exception("storyboard.detail LLM call failed")
        return SkillResult.failed(f"LLM 调用失败: {type(e).__name__}: {str(e)[:200]}")

    from app.skills.utils.json_parser import parse_llm_json, LLMJsonParseError

    try:
        parsed = parse_llm_json(raw, wrapper_key="detailed_shots")
    except LLMJsonParseError as e:
        return SkillResult.failed(f"JSON 解析失败: {e}")

    detailed_shots: list[dict[str, Any]] = []
    warnings: list[str] = []
    items = parsed if isinstance(parsed, list) else [parsed]
    for i, s in enumerate(items):
        try:
            detailed_shots.append(DetailedShot(**s).model_dump())
        except Exception as e:
            warnings.append(f"DetailedShot {i} validation failed: {e}")

    if not detailed_shots:
        return SkillResult.failed(f"所有分镜细化验证失败: {'; '.join(warnings)}")

    msg = f"细化 {len(detailed_shots)} 个分镜"
    if warnings:
        msg += f" ({len(warnings)} 项警告)"
    return SkillResult(
        status="completed",
        data={"detailed_shots": detailed_shots, "warnings": warnings},
        message=msg,
    )


def register_storyboard_detail_skill():
    skill_registry.register(descriptor, handle_storyboard_detail)
