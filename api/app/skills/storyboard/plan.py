"""storyboard.plan — Generate shot plan list from screenplay via LLM."""
import logging
from typing import Any

from pydantic import BaseModel, field_validator

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)


class ShotPlan(BaseModel):
    shot_number: int
    description: str
    characters: list[str] = []
    scene: str = ""
    dialogue: str = ""

    @field_validator("shot_number")
    @classmethod
    def shot_number_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("shot_number must be >= 1")
        return v

    @field_validator("description")
    @classmethod
    def description_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("description must not be empty")
        return v


descriptor = SkillDescriptor(
    name="storyboard.plan",
    display_name="分镜规划",
    description="根据剧本内容规划分镜序列，生成每个镜头的画面描述、出场角色、场景和台词。",
    category=SkillCategory.STORYBOARD,
    triggers=["分镜规划", "规划镜头", "storyboard plan", "plan shots"],
    execution_mode="async_celery",
    celery_queue="ai_generation",
    estimated_duration="long",
    input_schema={
        "type": "object",
        "properties": {
            "screenplay": {"type": "string", "description": "剧本内容"},
            "characters": {"type": "string", "description": "角色上下文 (可选)"},
            "scenes": {"type": "string", "description": "场景上下文 (可选)"},
            "provider": {"type": "string", "description": "AI 提供商 (可选, 默认 gemini)"},
            "model": {"type": "string", "description": "模型名称 (可选)"},
        },
        "required": ["screenplay"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "shots": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "shot_number": {"type": "integer"},
                        "description": {"type": "string"},
                        "characters": {"type": "array", "items": {"type": "string"}},
                        "scene": {"type": "string"},
                        "dialogue": {"type": "string"},
                    },
                },
            },
            "warnings": {"type": "array", "items": {"type": "string"}},
        },
    },
)

_SYSTEM_PROMPT = (
    "你是专业的分镜师。根据以下剧本，规划分镜序列。\n"
    "每个分镜包含: shot_number(序号), description(画面描述), "
    "characters(出场角色列表), scene(场景), dialogue(台词)。\n"
    "{character_context}"
    "{scene_context}"
    "以 JSON 数组返回。仅返回 JSON，不要其他文字。"
)


async def handle_storyboard_plan(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    screenplay = params.get("screenplay", "")
    if not screenplay:
        return SkillResult.failed("screenplay 不能为空")

    characters = params.get("characters", "")
    scenes = params.get("scenes", "")
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

    char_ctx = f"参考角色信息:\n{characters}\n" if characters else ""
    scene_ctx = f"参考场景信息:\n{scenes}\n" if scenes else ""
    system_prompt = _SYSTEM_PROMPT.format(
        character_context=char_ctx,
        scene_context=scene_ctx,
    )

    try:
        provider, _key_id = await resolve_llm_provider(provider_name, model_name, ctx)
        messages = [
            Message(role="system", content=system_prompt),
            Message(role="user", content=screenplay),
        ]
        raw = await provider.generate(messages, temperature=0.5, max_tokens=8000)
    except ValueError as e:
        return SkillResult.failed(str(e))
    except Exception as e:
        logger.exception("storyboard.plan LLM call failed")
        return SkillResult.failed(f"LLM 调用失败: {type(e).__name__}: {str(e)[:200]}")

    from app.skills.utils.json_parser import parse_llm_json, LLMJsonParseError

    try:
        parsed = parse_llm_json(raw, wrapper_key="shots")
    except LLMJsonParseError as e:
        return SkillResult.failed(f"JSON 解析失败: {e}")

    shots: list[dict[str, Any]] = []
    warnings: list[str] = []
    items = parsed if isinstance(parsed, list) else [parsed]
    for i, s in enumerate(items):
        try:
            shots.append(ShotPlan(**s).model_dump())
        except Exception as e:
            warnings.append(f"Shot {i} validation failed: {e}")

    if not shots:
        return SkillResult.failed(f"所有分镜验证失败: {'; '.join(warnings)}")

    expected = list(range(1, len(shots) + 1))
    actual = [s["shot_number"] for s in shots]
    if actual != expected:
        warnings.append(f"shot_number 序列不连续: expected {expected}, got {actual}")
        for idx, shot in enumerate(shots):
            shot["shot_number"] = idx + 1

    msg = f"规划 {len(shots)} 个分镜"
    if warnings:
        msg += f" ({len(warnings)} 项警告)"
    return SkillResult(
        status="completed",
        data={"shots": shots, "warnings": warnings},
        message=msg,
    )


def register_storyboard_plan_skill():
    skill_registry.register(descriptor, handle_storyboard_plan)
