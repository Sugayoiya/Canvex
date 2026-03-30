"""extract.characters — Extract character list from text using AI."""
import logging
from typing import Any

from pydantic import BaseModel, field_validator

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext
from app.skills.registry import skill_registry

logger = logging.getLogger(__name__)


class ExtractedCharacter(BaseModel):
    name: str
    description: str = ""
    gender: str = "未知"
    age: str = "未知"
    personality: str = ""

    @field_validator("description", "gender", "age", "personality", mode="before")
    @classmethod
    def coerce_none_to_default(cls, v):
        if v is None:
            return ""
        return str(v)


descriptor = SkillDescriptor(
    name="extract.characters",
    display_name="角色提取",
    description="从剧本或故事文本中使用 AI 提取角色列表，返回结构化角色数据（名称、描述、性别、年龄等）。",
    category=SkillCategory.EXTRACT,
    triggers=["提取角色", "分析人物", "角色列表", "extract characters"],
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
            "characters": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "gender": {"type": "string"},
                        "age": {"type": "string"},
                        "personality": {"type": "string"},
                    },
                },
            },
            "warnings": {"type": "array", "items": {"type": "string"}},
        },
    },
)


_SYSTEM_PROMPT = (
    "你是专业的剧本分析师。从给定文本中提取所有角色信息。"
    "以 JSON 数组返回，每个角色包含: name(名称), description(外貌描述), "
    "gender(性别), age(年龄), personality(性格特征)。"
    "仅返回 JSON，不要其他文字。"
)


async def handle_extract_characters(params: dict[str, Any], ctx: SkillContext) -> SkillResult:
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

    from app.services.ai.provider_manager import get_provider_manager
    from app.services.ai.base import Message

    try:
        provider = get_provider_manager().get_provider_sync(provider_name, model=model_name)
        messages = [
            Message(role="system", content=_SYSTEM_PROMPT),
            Message(role="user", content=f"请从以下文本中提取角色：\n\n{text[:8000]}"),
        ]
        raw = await provider.generate(messages, temperature=0.3, max_tokens=4000)
    except ValueError as e:
        return SkillResult.failed(str(e))
    except Exception as e:
        logger.exception("extract.characters LLM call failed")
        return SkillResult.failed(f"LLM 调用失败: {type(e).__name__}: {str(e)[:200]}")

    from app.skills.utils.json_parser import parse_llm_json, LLMJsonParseError

    try:
        parsed = parse_llm_json(raw, wrapper_key="characters")
    except LLMJsonParseError as e:
        return SkillResult.failed(f"JSON 解析失败: {e}")

    characters: list[dict[str, Any]] = []
    warnings: list[str] = []
    items = parsed if isinstance(parsed, list) else [parsed]
    for i, c in enumerate(items):
        try:
            characters.append(ExtractedCharacter(**c).model_dump())
        except Exception as e:
            warnings.append(f"Item {i} validation failed: {e}")

    if not characters:
        return SkillResult.failed(f"所有角色验证失败: {'; '.join(warnings)}")

    msg = f"提取到 {len(characters)} 个角色"
    if warnings:
        msg += f" ({len(warnings)} 项验证跳过)"
    return SkillResult(
        status="completed",
        data={"characters": characters, "warnings": warnings},
        message=msg,
    )


def register_extract_characters_skill():
    skill_registry.register(descriptor, handle_extract_characters)
