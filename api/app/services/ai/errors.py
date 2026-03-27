"""
Provider error taxonomy for retry classification.

All downstream providers and Skills import from this module.
"""


class ProviderError(Exception):
    """Base class for provider errors."""
    retryable: bool = False

    def __init__(self, message: str = "", *, retryable: bool | None = None):
        super().__init__(message)
        if retryable is not None:
            self.retryable = retryable


class TransientError(ProviderError):
    """Temporary failures: connection timeout, 5xx, rate limit with retry-after."""
    retryable = True


class AuthError(ProviderError):
    """Invalid/expired credentials. Never retry."""
    retryable = False


class RateLimitError(ProviderError):
    """Rate limit exceeded. May retry after backoff."""
    retryable = True


class ValidationError(ProviderError):
    """Invalid request params (malformed prompt, unsupported model). Never retry."""
    retryable = False


class ContentBlockedError(ProviderError):
    """Content filtered by safety policy. Never retry."""
    retryable = False
