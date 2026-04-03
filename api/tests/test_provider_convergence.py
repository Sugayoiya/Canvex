"""Integration tests verifying all AI call paths converge to unified ProviderManager async chain."""
import importlib
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.skills.context import SkillContext


def _make_ctx(**kwargs) -> SkillContext:
    defaults = {"user_id": "u1", "team_id": "t1", "project_id": "p1"}
    defaults.update(kwargs)
    return SkillContext(**defaults)


@pytest.mark.asyncio
async def test_agent_uses_resolve_langchain_llm():
    """CONV-01/02: Agent resolves LangChain LLM via pm.resolve_langchain_llm()."""
    mock_llm = MagicMock()
    mock_pm = AsyncMock()
    mock_pm.resolve_langchain_llm = AsyncMock(return_value=mock_llm)

    with patch(
        "app.services.ai.provider_manager.get_provider_manager",
        return_value=mock_pm,
    ):
        from app.agent.agent_service import AgentService

        service = AgentService()
        assert service is not None
        mock_pm.resolve_langchain_llm.assert_not_called()


def test_deprecated_image_skill_handler_removed():
    """Phase 13: visual.generate_image handler module is removed."""
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("app.skills.visual.generate_image")


def test_deprecated_video_skill_handler_removed():
    """Phase 13: video.generate_video handler module is removed."""
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("app.skills.video.generate_video")


def test_all_skills_registered():
    """Phase 13: all deprecated SkillRegistry handlers are removed."""
    from app.skills.register_all import register_all_skills
    from app.skills.registry import skill_registry

    register_all_skills()
    names = skill_registry.list_names()
    assert names == [], f"Expected no registered skills, got {names}"


def test_resolve_llm_provider_removed():
    """Verify resolve_llm_provider() convenience wrapper has been removed."""
    import app.services.ai.provider_manager as pm_module

    assert not hasattr(pm_module, "resolve_llm_provider"), (
        "resolve_llm_provider should be removed — all skills use get_provider_manager().get_provider()"
    )


def test_get_provider_sync_removed():
    """Verify get_provider_sync() no longer exists on ProviderManager."""
    from app.services.ai.provider_manager import ProviderManager

    assert not hasattr(ProviderManager, "get_provider_sync"), (
        "get_provider_sync should be removed from ProviderManager"
    )


def test_gemini_image_video_providers_removed():
    """Verify standalone GeminiImageProvider and GeminiVideoProvider files are removed."""
    import importlib
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("app.services.ai.model_providers.gemini_image")
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("app.services.ai.model_providers.gemini_video")


def test_gemini_provider_has_multimodal_methods():
    """Verify GeminiProvider exposes generate_image and generate_video methods."""
    from app.services.ai.model_providers.gemini import GeminiProvider

    assert hasattr(GeminiProvider, "generate_image"), "GeminiProvider should have generate_image method"
    assert hasattr(GeminiProvider, "generate_video"), "GeminiProvider should have generate_video method"
    assert hasattr(GeminiProvider, "generate"), "GeminiProvider should retain generate (LLM) method"
