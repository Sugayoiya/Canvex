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


class ParameterRuleSchema(BaseModel):
    name: str
    use_template: str | None = None
    label: str | None = None
    type: str | None = None
    help: str | None = None
    required: bool | None = None
    default: float | int | str | bool | None = None
    min: float | int | None = None
    max: float | int | None = None
    precision: int | None = None
    options: list[str] | None = None


class ProviderModelResponse(BaseModel):
    id: str
    display_name: str
    model_name: str
    model_type: str
    features: list[str] = []
    is_enabled: bool
    is_preset: bool = False
    input_token_limit: int | None = None
    output_token_limit: int | None = None
    input_types: list[str] = []
    output_types: list[str] = []
    model_properties: dict | None = None
    parameter_rules: list[dict] = []
    deprecated: bool = False
    pricing: ModelPricingBrief | None = None

    model_config = {"from_attributes": True}


class ModelCreateRequest(BaseModel):
    model_name: str
    display_name: str
    model_type: str = "llm"
    features: list[str] = []
    input_types: list[str] = []
    output_types: list[str] = ["text"]
    model_properties: dict | None = None
    parameter_rules: list[ParameterRuleSchema] = []
    input_token_limit: int | None = None
    output_token_limit: int | None = None
    deprecated: bool = False
    pricing_model: str | None = None
    input_price_per_1k: str | None = None
    output_price_per_1k: str | None = None
    price_per_image: str | None = None


class ModelUpdateRequest(BaseModel):
    display_name: str | None = None
    is_enabled: bool | None = None
    features: list[str] | None = None
    input_types: list[str] | None = None
    output_types: list[str] | None = None
    model_properties: dict | None = None
    parameter_rules: list[ParameterRuleSchema] | None = None
    input_token_limit: int | None = None
    output_token_limit: int | None = None
    deprecated: bool | None = None
    pricing_model: str | None = None
    input_price_per_1k: str | None = None
    output_price_per_1k: str | None = None
    price_per_image: str | None = None


class ModelConfigResponse(BaseModel):
    id: str
    display_name: str
    model_name: str
    model_type: str
    features: list[str] = []
    is_enabled: bool
    providers: list[str] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_model_config(cls, mc, provider_names: list[str] | None = None):
        feats = []
        if mc.features:
            try:
                feats = json.loads(mc.features) if isinstance(mc.features, str) else mc.features
            except (json.JSONDecodeError, TypeError):
                feats = []
        return cls(
            id=mc.id,
            display_name=mc.display_name,
            model_name=mc.model_name,
            model_type=mc.model_type,
            features=feats,
            is_enabled=mc.is_enabled,
            providers=provider_names or [],
        )
