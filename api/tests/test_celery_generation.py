import pytest
from unittest.mock import MagicMock


@pytest.mark.asyncio
async def test_poll_celery_result_success():
    """AsyncResult.ready() returns True, result is returned."""
    from app.agent.tools.ai_tools import _poll_celery_result
    mock_result = MagicMock()
    mock_result.ready.side_effect = [False, True, True]
    mock_result.failed.return_value = False
    mock_result.result = {"url": "http://example.com/img.png"}
    result = await _poll_celery_result(mock_result, timeout=10, tool_name="test")
    assert result == {"url": "http://example.com/img.png"}


@pytest.mark.asyncio
async def test_poll_celery_result_timeout():
    """AsyncResult never ready -> error dict."""
    from app.agent.tools.ai_tools import _poll_celery_result
    mock_result = MagicMock()
    mock_result.ready.return_value = False
    result = await _poll_celery_result(mock_result, timeout=2, tool_name="图片生成")
    assert "error" in result
    assert "超时" in result["error"]


@pytest.mark.asyncio
async def test_poll_celery_result_failure():
    """AsyncResult.failed() True -> error dict."""
    from app.agent.tools.ai_tools import _poll_celery_result
    mock_result = MagicMock()
    mock_result.ready.return_value = True
    mock_result.failed.return_value = True
    mock_result.result = Exception("Provider error")
    result = await _poll_celery_result(mock_result, timeout=10, tool_name="图片生成")
    assert "error" in result
    assert "失败" in result["error"]


def test_generate_image_task_config():
    """Verify task decorator config: acks_late, max_retries."""
    from app.tasks.ai_generation_task import generate_image_task
    assert generate_image_task.max_retries == 2
    assert generate_image_task.acks_late is True
    assert "generate_image_task" in generate_image_task.name


def test_generate_video_task_config():
    """Verify task decorator config: acks_late, max_retries."""
    from app.tasks.ai_generation_task import generate_video_task
    assert generate_video_task.max_retries == 2
    assert generate_video_task.acks_late is True
    assert "generate_video_task" in generate_video_task.name


def test_ai_tools_use_apply_async():
    """Verify generate_image/generate_video @tool source calls apply_async."""
    import inspect
    from app.agent.tools.ai_tools import generate_image, generate_video
    img_src = inspect.getsource(generate_image.coroutine)
    vid_src = inspect.getsource(generate_video.coroutine)
    assert "apply_async" in img_src
    assert "apply_async" in vid_src


def test_async_generate_image_has_wait_for():
    """Verify _async_generate_image wraps provider call with asyncio.wait_for."""
    import inspect
    from app.tasks.ai_generation_task import _async_generate_image
    src = inspect.getsource(_async_generate_image)
    assert "wait_for" in src
    assert "IMAGE_PROVIDER_TIMEOUT" in src or "110" in src


def test_async_generate_video_has_wait_for():
    """Verify _async_generate_video wraps provider call with asyncio.wait_for."""
    import inspect
    from app.tasks.ai_generation_task import _async_generate_video
    src = inspect.getsource(_async_generate_video)
    assert "wait_for" in src
    assert "VIDEO_PROVIDER_TIMEOUT" in src or "280" in src


def test_provider_timeout_constants():
    """Verify timeout constants are defined with correct values."""
    from app.tasks.ai_generation_task import IMAGE_PROVIDER_TIMEOUT, VIDEO_PROVIDER_TIMEOUT
    assert IMAGE_PROVIDER_TIMEOUT == 110
    assert VIDEO_PROVIDER_TIMEOUT == 280
