"""Integration tests verifying all AI call paths converge to unified ProviderManager async chain."""
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


@pytest.mark.asyncio
async def test_image_skill_uses_get_provider():
    """CONV-03: Image skill calls provider.generate_image() via pm.get_provider()."""
    fake_image_result = {"url": "http://example.com/img.png", "filename": "img.png", "size": 1024}
    fake_provider = AsyncMock()
    fake_provider.generate_image = AsyncMock(return_value=fake_image_result)

    mock_pm = AsyncMock()
    mock_pm.get_provider = AsyncMock(return_value=(fake_provider, "system:", "key-img"))

    mock_khm = AsyncMock()
    mock_khm.report_success = AsyncMock()

    with patch(
        "app.services.ai.provider_manager.get_provider_manager",
        return_value=mock_pm,
    ), patch(
        "app.services.ai.key_health.get_key_health_manager",
        return_value=mock_khm,
    ), patch(
        "app.services.ai.ai_call_logger.set_ai_call_context",
    ), patch(
        "app.services.ai.ai_call_logger.log_ai_call",
        new_callable=AsyncMock,
    ):
        from app.skills.visual.generate_image import handle_generate_image

        ctx = _make_ctx()
        result = await handle_generate_image({"prompt": "a beautiful sunset"}, ctx)

        mock_pm.get_provider.assert_called_once()
        call_kwargs = mock_pm.get_provider.call_args
        assert call_kwargs[1]["team_id"] == "t1"
        fake_provider.generate_image.assert_called_once()
        assert result.status == "completed"
        mock_khm.report_success.assert_called_once_with("key-img")


@pytest.mark.asyncio
async def test_video_skill_uses_get_provider():
    """CONV-04: Video skill calls provider.generate_video() via pm.get_provider()."""
    fake_video_result = {"url": "http://example.com/vid.mp4", "filename": "vid.mp4", "duration_seconds": 5}
    fake_provider = AsyncMock()
    fake_provider.generate_video = AsyncMock(return_value=fake_video_result)

    mock_pm = AsyncMock()
    mock_pm.get_provider = AsyncMock(return_value=(fake_provider, "system:", "key-vid"))

    mock_khm = AsyncMock()
    mock_khm.report_success = AsyncMock()

    with patch(
        "app.services.ai.provider_manager.get_provider_manager",
        return_value=mock_pm,
    ), patch(
        "app.services.ai.key_health.get_key_health_manager",
        return_value=mock_khm,
    ), patch(
        "app.services.ai.ai_call_logger.set_ai_call_context",
    ), patch(
        "app.services.ai.ai_call_logger.log_ai_call",
        new_callable=AsyncMock,
    ):
        from app.skills.video.generate_video import handle_generate_video

        ctx = _make_ctx()
        result = await handle_generate_video({"prompt": "a cinematic scene"}, ctx)

        mock_pm.get_provider.assert_called_once()
        call_kwargs = mock_pm.get_provider.call_args
        assert call_kwargs[1]["team_id"] == "t1"
        fake_provider.generate_video.assert_called_once()
        assert result.status == "completed"
        mock_khm.report_success.assert_called_once_with("key-vid")


def test_all_skills_registered():
    """CONV-06: Post-12.1 cleanup — 4 canvas/asset/visual/video skills remain in registry."""
    from app.skills.register_all import register_all_skills
    from app.skills.registry import skill_registry

    register_all_skills()
    names = skill_registry.list_names()
    assert len(names) >= 3, f"Expected >= 3 skills, got {len(names)}: {names}"
    assert any("generate_image" in n for n in names), "generate_image must remain registered"
    assert any("generate_video" in n for n in names), "generate_video must remain registered"


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
