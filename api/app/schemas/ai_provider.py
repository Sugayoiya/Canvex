import json
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class ProviderConfigCreate(BaseModel):
    provider_name: str
    display_name: str
    is_enabled: bool = True
    priority: int = 0
    owner_type: str = "system"
    owner_id: str | None = None


class ProviderConfigUpdate(BaseModel):
    display_name: str | None = None
    is_enabled: bool | None = None
    priority: int | None = None


class ProviderKeyCreate(BaseModel):
    api_key: str
    label: str | None = None


class ProviderKeyResponse(BaseModel):
    id: str
    label: str | None = None
    key_hint: str | None = None
    is_active: bool
    last_used_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProviderConfigResponse(BaseModel):
    id: str
    provider_name: str
    display_name: str
    is_enabled: bool
    priority: int
    owner_type: str
    owner_id: str | None = None
    key_count: int = 0
    active_key_count: int = 0
    keys: list[ProviderKeyResponse] = []
    created_at: datetime
    description: str | None = None
    icon: str | None = None
    sdk_type: str = "native"
    default_base_url: str | None = None
    base_url: str | None = None
    is_preset: bool = False

    model_config = {"from_attributes": True}


class KeyHealthResponse(BaseModel):
    key_id: str
    error_count: int
    last_used_at: datetime | None = None
    is_healthy: bool
    health_badge: str  # "healthy" | "degraded" | "unhealthy"
    recent_errors: list[dict] = []
    usage_trend: list[dict] = []


class KeyUpdateRequest(BaseModel):
    is_active: bool | None = None
    reset_error_count: bool | None = None


class ProviderHealthResponse(BaseModel):
    """Batch health response for all keys of a provider."""
    provider_id: str
    keys: list[KeyHealthResponse] = []


class ModelPricingBrief(BaseModel):
    id: str
    pricing_model: str
    input_price_per_1k: Decimal | None = None
    output_price_per_1k: Decimal | None = None
    price_per_image: Decimal | None = None
    price_per_second: Decimal | None = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class ProviderModelResponse(BaseModel):
    id: str
    display_name: str
    model_name: str
    model_type: str
    capabilities: list[str] = []
    is_enabled: bool
    is_preset: bool = False
    input_token_limit: int | None = None
    output_token_limit: int | None = None
    pricing: ModelPricingBrief | None = None

    model_config = {"from_attributes": True}


class ModelCreateRequest(BaseModel):
    model_name: str
    display_name: str
    model_type: str = "llm"


class ModelUpdateRequest(BaseModel):
    is_enabled: bool | None = None
    display_name: str | None = None


class ModelConfigResponse(BaseModel):
    id: str
    display_name: str
    model_name: str
    model_type: str
    capabilities: list[str] = []
    is_enabled: bool
    providers: list[str] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_model_config(cls, mc, provider_names: list[str] | None = None):
        caps = []
        if mc.capabilities:
            try:
                caps = json.loads(mc.capabilities) if isinstance(mc.capabilities, str) else mc.capabilities
            except (json.JSONDecodeError, TypeError):
                caps = []
        return cls(
            id=mc.id,
            display_name=mc.display_name,
            model_name=mc.model_name,
            model_type=mc.model_type,
            capabilities=caps,
            is_enabled=mc.is_enabled,
            providers=provider_names or [],
        )
