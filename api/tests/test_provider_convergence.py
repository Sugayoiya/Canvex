"""Integration tests verifying all AI call paths converge to unified ProviderManager async chain."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.skills.context import SkillContext


def _make_ctx(**kwargs) -> SkillContext:
    defaults = {"user_id": "u1", "team_id": "t1", "project_id": "p1"}
    defaults.update(kwargs)
    return SkillContext(**defaults)


@pytest.mark.asyncio
async def test_llm_skill_uses_async_provider():
    """CONV-01: LLM skills resolve credentials via resolve_llm_provider, not get_provider_sync."""
    fake_provider = AsyncMock()
    fake_provider.generate = AsyncMock(return_value="generated text")

    with patch(
        "app.services.ai.provider_manager.resolve_llm_provider",
        new_callable=AsyncMock,
        return_value=(fake_provider, "key-1"),
    ) as mock_resolve, patch(
        "app.services.ai.ai_call_logger.set_ai_call_context",
    ):
        from app.skills.text.llm_generate import handle_llm_generate

        ctx = _make_ctx()
        result = await handle_llm_generate({"prompt": "test prompt"}, ctx)

        mock_resolve.assert_called_once_with("gemini", None, ctx)
        assert result.status == "completed"
        assert "text" in result.data


@pytest.mark.asyncio
async def test_agent_uses_db_credentials():
    """CONV-02: Agent resolves credentials via ProviderManager.get_provider(), not settings.*_API_KEY."""
    fake_provider_inst = MagicMock()
    fake_provider_inst.api_key = "test-key-from-db"

    mock_pm = AsyncMock()
    mock_pm.get_provider = AsyncMock(return_value=(fake_provider_inst, "system:", "key-1"))

    with patch(
        "app.services.ai.provider_manager.get_provider_manager",
        return_value=mock_pm,
    ):
        from app.agent.agent_service import resolve_pydantic_model

        model = await resolve_pydantic_model("gemini", "gemini-2.5-flash", team_id="t1")

        mock_pm.get_provider.assert_called_once_with(
            "gemini", model="gemini-2.5-flash", team_id="t1", user_id=None,
        )
        assert model is not None


@pytest.mark.asyncio
async def test_image_skill_uses_async_provider():
    """CONV-03: Image skill resolves credentials via get_provider(), not settings.GEMINI_API_KEY."""
    fake_provider_inst = MagicMock()
    fake_provider_inst.api_key = "test-key-from-db"

    mock_pm = AsyncMock()
    mock_pm.get_provider = AsyncMock(return_value=(fake_provider_inst, "system:", "key-img"))

    mock_khm = AsyncMock()
    mock_khm.report_success = AsyncMock()

    fake_image_result = {"url": "http://example.com/img.png", "filename": "img.png"}

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
    ), patch(
        "app.services.ai.model_providers.gemini_image.GeminiImageProvider"
    ) as MockImageProvider:
        mock_img_inst = AsyncMock()
        mock_img_inst.generate_image = AsyncMock(return_value=fake_image_result)
        MockImageProvider.return_value = mock_img_inst

        from app.skills.visual.generate_image import handle_generate_image

        ctx = _make_ctx()
        result = await handle_generate_image({"prompt": "a beautiful sunset"}, ctx)

        mock_pm.get_provider.assert_called_once()
        call_kwargs = mock_pm.get_provider.call_args
        assert call_kwargs[1]["team_id"] == "t1"
        assert result.status == "completed"
        mock_khm.report_success.assert_called_once_with("key-img")


@pytest.mark.asyncio
async def test_video_skill_uses_async_provider():
    """CONV-04: Video skill resolves credentials via get_provider(), not settings.GEMINI_API_KEY."""
    fake_provider_inst = MagicMock()
    fake_provider_inst.api_key = "test-key-from-db"

    mock_pm = AsyncMock()
    mock_pm.get_provider = AsyncMock(return_value=(fake_provider_inst, "system:", "key-vid"))

    mock_khm = AsyncMock()
    mock_khm.report_success = AsyncMock()

    fake_video_result = {"url": "http://example.com/vid.mp4", "filename": "vid.mp4", "duration_seconds": 5}

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
    ), patch(
        "app.services.ai.model_providers.gemini_video.GeminiVideoProvider"
    ) as MockVideoProvider:
        mock_vid_inst = AsyncMock()
        mock_vid_inst.generate_video = AsyncMock(return_value=fake_video_result)
        MockVideoProvider.return_value = mock_vid_inst

        from app.skills.video.generate_video import handle_generate_video

        ctx = _make_ctx()
        result = await handle_generate_video({"prompt": "a cinematic scene"}, ctx)

        mock_pm.get_provider.assert_called_once()
        call_kwargs = mock_pm.get_provider.call_args
        assert call_kwargs[1]["team_id"] == "t1"
        assert result.status == "completed"
        mock_khm.report_success.assert_called_once_with("key-vid")


def test_all_skills_registered():
    """CONV-06: All 14+ skills register without errors after migration."""
    from app.skills.register_all import register_all_skills
    from app.skills.registry import skill_registry

    register_all_skills()
    names = skill_registry.list_names()
    assert len(names) >= 14, f"Expected >= 14 skills, got {len(names)}: {names}"


def test_get_provider_sync_removed():
    """Verify get_provider_sync() no longer exists on ProviderManager."""
    from app.services.ai.provider_manager import ProviderManager

    assert not hasattr(ProviderManager, "get_provider_sync"), (
        "get_provider_sync should be removed from ProviderManager"
    )
