"""
LLM Provider Base — wraps generate()/stream_generate() with automatic
timing, fail-open AICallLog writes, and 1-retry on transient errors.
"""
import asyncio
import functools
import logging
import time

from app.services.ai.base import AIProviderBase

logger = logging.getLogger(__name__)

_GENERATE_TIMEOUT_S = 60


def _truncate(s: str | None, limit: int) -> str | None:
    if s is None:
        return None
    return s[:limit] if len(s) > limit else s


def _classify_exception(exc: Exception):
    """Map raw SDK/network exceptions to our error taxonomy."""
    from app.services.ai.errors import (
        AuthError,
        RateLimitError,
        TransientError,
    )

    if isinstance(exc, (ConnectionError, TimeoutError, asyncio.TimeoutError)):
        return TransientError(str(exc))

    try:
        import httpx

        if isinstance(exc, httpx.ReadTimeout):
            return TransientError(str(exc))
        if isinstance(exc, httpx.HTTPStatusError):
            code = exc.response.status_code
            if code == 429:
                return RateLimitError(str(exc))
            if code in (401, 403):
                return AuthError(str(exc))
            if code >= 500:
                return TransientError(str(exc))
    except ImportError:
        pass

    return exc


class LLMProviderBase(AIProviderBase):
    """LLM provider base class.

    __init_subclass__ automatically wraps generate() with:
    - timing measurement
    - fail-open AICallLog write
    - 1-retry on TransientError / RateLimitError
    - 60s timeout enforcement
    """

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)

        if "generate" in cls.__dict__:
            _orig = cls.__dict__["generate"]
            if getattr(_orig, "_ai_logged", False):
                return

            @functools.wraps(_orig)
            async def _wrapped_generate(
                self, messages, temperature=0.7, max_tokens=4096, *, _fn=_orig
            ):
                from app.services.ai.ai_call_logger import log_ai_call
                from app.services.ai.errors import TransientError, RateLimitError

                provider_name = getattr(self, "provider_name", "unknown")
                model_name = getattr(self, "model", "unknown")

                last_exc: Exception | None = None
                for attempt in range(2):  # 0 = first try, 1 = retry
                    start = time.monotonic()
                    try:
                        result = await asyncio.wait_for(
                            _fn(self, messages, temperature, max_tokens),
                            timeout=_GENERATE_TIMEOUT_S,
                        )
                        duration_ms = int((time.monotonic() - start) * 1000)
                        await log_ai_call(
                            provider=provider_name,
                            model=model_name,
                            input_tokens=None,
                            output_tokens=None,
                            duration_ms=duration_ms,
                            status="success",
                        )
                        from app.services.ai.provider_manager import _current_key_id_var
                        _key_id = _current_key_id_var.get(None)
                        if _key_id:
                            from app.services.ai.key_health import get_key_health_manager
                            try:
                                await get_key_health_manager().report_success(_key_id)
                            except Exception:
                                pass
                        return result
                    except Exception as raw_exc:
                        duration_ms = int((time.monotonic() - start) * 1000)
                        exc = _classify_exception(raw_exc)
                        await log_ai_call(
                            provider=provider_name,
                            model=model_name,
                            duration_ms=duration_ms,
                            status="error",
                            error_message=_truncate(str(exc), 2000),
                        )
                        from app.services.ai.provider_manager import _current_key_id_var
                        _key_id = _current_key_id_var.get(None)
                        if _key_id:
                            from app.services.ai.key_health import get_key_health_manager
                            try:
                                await get_key_health_manager().report_error(
                                    _key_id, type(exc).__name__, str(exc)[:200]
                                )
                            except Exception:
                                pass
                        if isinstance(exc, (TransientError, RateLimitError)) and attempt == 0:
                            logger.warning(
                                "Retrying %s/%s after %s (attempt %d)",
                                provider_name, model_name, type(exc).__name__, attempt + 1,
                            )
                            last_exc = exc
                            continue
                        raise exc from raw_exc

                raise last_exc  # type: ignore[misc]

            _wrapped_generate._ai_logged = True  # type: ignore[attr-defined]
            cls.generate = _wrapped_generate

        if "stream_generate" in cls.__dict__:
            _orig_stream = cls.__dict__["stream_generate"]
            if getattr(_orig_stream, "_ai_logged", False):
                return

            @functools.wraps(_orig_stream)
            async def _wrapped_stream(
                self, messages, temperature=0.7, max_tokens=4096, *, _fn=_orig_stream
            ):
                from app.services.ai.ai_call_logger import log_ai_call

                provider_name = getattr(self, "provider_name", "unknown")
                model_name = getattr(self, "model", "unknown")
                start = time.monotonic()
                chunks: list[str] = []
                try:
                    async for chunk in _fn(self, messages, temperature, max_tokens):
                        chunks.append(chunk)
                        yield chunk
                    duration_ms = int((time.monotonic() - start) * 1000)
                    await log_ai_call(
                        provider=provider_name,
                        model=model_name,
                        duration_ms=duration_ms,
                        status="success",
                    )
                except Exception as e:
                    duration_ms = int((time.monotonic() - start) * 1000)
                    await log_ai_call(
                        provider=provider_name,
                        model=model_name,
                        duration_ms=duration_ms,
                        status="error",
                        error_message=_truncate(str(e), 2000),
                    )
                    raise

            _wrapped_stream._ai_logged = True  # type: ignore[attr-defined]
            cls.stream_generate = _wrapped_stream
