"""
AI Provider Base Interface — unified provider abstraction.
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator

from pydantic import BaseModel


class Message(BaseModel):
    role: str  # "system", "user", "assistant"
    content: str
    image_b64: str | None = None
    image_mime_type: str | None = None


class AIProviderBase(ABC):
    """Base class for all AI providers (LLM)."""

    @abstractmethod
    async def generate(
        self,
        messages: list[Message],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        """Generate a response from the AI model."""
        ...

    @abstractmethod
    async def stream_generate(
        self,
        messages: list[Message],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        """Stream generate a response from the AI model."""
        ...

    @abstractmethod
    async def list_models(self) -> list:
        """Return available models for this provider."""
        ...

    @classmethod
    @abstractmethod
    def get_predefined_models(cls) -> list:
        """Offline fallback model list."""
        ...

    @classmethod
    @abstractmethod
    def get_provider_entity(cls):
        """Provider metadata."""
        ...
