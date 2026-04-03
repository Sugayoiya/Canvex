from pydantic import BaseModel
from decimal import Decimal


class AvailableModel(BaseModel):
    model_name: str
    display_name: str
    model_type: str
    provider_name: str
    features: list[str]
    input_price_per_1k: Decimal | None = None
    output_price_per_1k: Decimal | None = None
    price_per_image: Decimal | None = None


class AvailableModelsResponse(BaseModel):
    llm: list[AvailableModel]
    image: list[AvailableModel]


class DefaultModelSettings(BaseModel):
    default_llm_model: str | None = None
    default_image_model: str | None = None
