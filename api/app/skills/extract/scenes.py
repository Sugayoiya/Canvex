"""extract.scenes — Extract scene list from text using AI."""
import logging
from typing import Any

from pydantic import BaseModel

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)


class ExtractedScene(BaseModel):
    name: str
    description: str = ""
    location: str = ""
    time_of_day: str = ""
    mood: str = ""


descriptor = SkillDescriptor(
    name="extract.scenes",
    display_name="场景提取",
    description="从剧本或故事文本中使用 AI 提取场景列表，返回结构化场景数据（名称、描述、时间、地点等）。",
    category=SkillCategory.EXTRACT,
    triggers=["提取场景", "分析场景", "场景列表", "extract scenes"],
    execution_mode="async_celery",
    celery_queue="ai_generation",
    estimated_duration="medium",
    requires_project=True,
    input_schema={
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "待分析的剧本/故事文本"},
            "project_id": {"type": "string", "description": "项目 ID"},
            "provider": {"type": "string", "description": "AI 提供商 (可选, 默认 gemini)"},
            "model": {"type": "string", "description": "模型名称 (可选)"},
        },
        "required": ["text"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "scenes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "location": {"type": "string"},
                        "time_of_day": {"type": "string"},
                        "mood": {"type": "string"},
                    },
                },
            },
            "warnings": {"type": "array", "items": {"type": "string"}},
        },
    },
)


_SYSTEM_PROMPT = (
    "你是专业的剧本分析师。从给定文本中提取所有场景/地点信息。"
    "以 JSON 数组返回，每个场景包含: name(名称), description(描述), "
    "location(具体地点), time_of_day(时间), mood(氛围)。"
    "仅返回 JSON，不要其他文字。"
)


async def handle_extract_scenes(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
    text = params.get("text", "")
    if not text:
        return SkillResult.failed("text 不能为空")

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
        messages = [
            Message(role="system", content=_SYSTEM_PROMPT),
            Message(role="user", content=f"请从以下文本中提取场景：\n\n{text[:8000]}"),
        ]
        raw = await provider.generate(messages, temperature=0.3, max_tokens=4000)
    except ValueError as e:
        return SkillResult.failed(str(e))
    except Exception as e:
        logger.exception("extract.scenes LLM call failed")
        return SkillResult.failed(f"LLM 调用失败: {type(e).__name__}: {str(e)[:200]}")

    from app.skills.utils.json_parser import parse_llm_json, LLMJsonParseError

    try:
        parsed = parse_llm_json(raw, wrapper_key="scenes")
    except LLMJsonParseError as e:
        return SkillResult.failed(f"JSON 解析失败: {e}")

    scenes: list[dict[str, Any]] = []
    warnings: list[str] = []
    items = parsed if isinstance(parsed, list) else [parsed]
    for i, s in enumerate(items):
        try:
            scenes.append(ExtractedScene(**s).model_dump())
        except Exception as e:
            warnings.append(f"Item {i} validation failed: {e}")

    if not scenes:
        return SkillResult.failed(f"所有场景验证失败: {'; '.join(warnings)}")

    msg = f"提取到 {len(scenes)} 个场景"
    if warnings:
        msg += f" ({len(warnings)} 项验证跳过)"
    return SkillResult(
        status="completed",
        data={"scenes": scenes, "warnings": warnings},
        message=msg,
    )


def register_extract_scenes_skill():
    skill_registry.register(descriptor, handle_extract_scenes)
