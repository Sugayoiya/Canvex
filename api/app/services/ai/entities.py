"""
AI Provider & Model Entities — standardized data contracts.
"""
from enum import StrEnum
from typing import Sequence

from pydantic import BaseModel


class ModelType(StrEnum):
    LLM = "llm"
    IMAGE_GENERATION = "image_generation"
    VIDEO_GENERATION = "video_generation"
    TEXT_TO_SPEECH = "text_to_speech"
    SPEECH_TO_TEXT = "speech_to_text"
    TEXT_EMBEDDING = "text_embedding"


class AIModelEntity(BaseModel):
    name: str
    display_name: str
    description: str | None = None
    model_type: ModelType = ModelType.LLM
    capabilities: list[str] = []

    input_token_limit: int | None = None
    output_token_limit: int | None = None
    default_temperature: float | None = None
    max_temperature: float | None = None
    top_p: float | None = None
    top_k: int | None = None
    supported_actions: list[str] | None = None

    input_types: list[str] | None = None
    output_types: list[str] | None = None
    thinking: bool | None = None

    extra_params: dict | None = None


def infer_model_type(
    output_types: list[str] | None = None,
    capabilities: list[str] | None = None,
    model_name: str = "",
) -> ModelType:
    """Infer ModelType from output_types / capabilities / model name."""
    outs = set(output_types or [])
    caps = set(capabilities or [])
    name_lower = model_name.lower()

    if outs:
        if "video" in outs:
            return ModelType.VIDEO_GENERATION
        if "image" in outs:
            return ModelType.IMAGE_GENERATION
        if "audio" in outs and "text" not in outs:
            return ModelType.TEXT_TO_SPEECH

    if "embedding" in caps:
        return ModelType.TEXT_EMBEDDING

    if "imagen" in name_lower:
        return ModelType.IMAGE_GENERATION
    if "veo" in name_lower:
        return ModelType.VIDEO_GENERATION
    if "tts" in name_lower:
        return ModelType.TEXT_TO_SPEECH
    if "whisper" in name_lower or "stt" in name_lower:
        return ModelType.SPEECH_TO_TEXT
    if "embed" in name_lower:
        return ModelType.TEXT_EMBEDDING

    return ModelType.LLM


class ProviderEntity(BaseModel):
    provider: str
    name: str
    description: str | None = None
    supported_model_types: Sequence[ModelType] = []
    models: list[AIModelEntity] = []
