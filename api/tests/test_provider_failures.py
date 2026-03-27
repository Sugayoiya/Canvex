import pytest
from app.services.ai.errors import (
    ProviderError,
    TransientError,
    AuthError,
    RateLimitError,
    ValidationError,
    ContentBlockedError,
)


def test_error_hierarchy():
    """All provider errors inherit from ProviderError."""
    assert issubclass(TransientError, ProviderError)
    assert issubclass(AuthError, ProviderError)
    assert issubclass(RateLimitError, ProviderError)
    assert issubclass(ValidationError, ProviderError)
    assert issubclass(ContentBlockedError, ProviderError)


def test_transient_error_is_retryable():
    err = TransientError("timeout")
    assert err.retryable is True


def test_rate_limit_is_retryable():
    err = RateLimitError("429")
    assert err.retryable is True


def test_auth_error_not_retryable():
    err = AuthError("invalid key")
    assert err.retryable is False


def test_validation_error_not_retryable():
    err = ValidationError("bad input")
    assert err.retryable is False


def test_content_blocked_not_retryable():
    err = ContentBlockedError("safety filter")
    assert err.retryable is False


def test_provider_error_default_not_retryable():
    err = ProviderError("generic error")
    assert err.retryable is False


def test_provider_error_retryable_override():
    """retryable can be overridden at construction time."""
    err = ProviderError("custom", retryable=True)
    assert err.retryable is True


def test_error_message_preserved():
    err = TransientError("connection timed out after 30s")
    assert "connection timed out" in str(err)


def test_all_errors_are_exceptions():
    """All error types can be raised and caught."""
    for cls in [TransientError, AuthError, RateLimitError, ValidationError, ContentBlockedError]:
        with pytest.raises(ProviderError):
            raise cls("test")
