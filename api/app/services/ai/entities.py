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
    features: list[str] = []
    input_types: list[str] = []
    output_types: list[str] = []
    model_properties: dict | None = None
    parameter_rules: list[dict] = []
    input_token_limit: int | None = None
    output_token_limit: int | None = None
    deprecated: bool = False


def infer_model_type(
    output_types: list[str] | None = None,
    features: list[str] | None = None,
    model_name: str = "",
) -> ModelType:
    """Infer ModelType from output_types / features / model name."""
    outs = set(output_types or [])
    feats = set(features or [])
    name_lower = model_name.lower()

    if outs:
        if "video" in outs:
            return ModelType.VIDEO_GENERATION
        if "image" in outs:
            return ModelType.IMAGE_GENERATION
        if "audio" in outs and "text" not in outs:
            return ModelType.TEXT_TO_SPEECH

    if "embedding" in feats:
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
