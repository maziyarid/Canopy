"""Fail-closed provider sync retry stages.

This module records the next queue checkpoint for a provider sync attempt.
It does not start scheduled portfolio ingestion and does not assign sites.
"""

from __future__ import annotations

STAGES = ("queued", "running", "retry_wait", "failed_closed", "completed")
MAX_ATTEMPTS = 3

RETRYABLE = frozenset({
    "rate_limited",
    "timeout",
    "sqlite_busy",
    "provider_unavailable",
})

FAIL_CLOSED = frozenset({
    "not_configured",
    "adapter_not_implemented",
    "site_map_missing",
    "gsc_property_not_authorised",
    "ambiguous_schema",
    "unknown",
})

SCHEDULED_PORTFOLIO_SYNC_ENABLED = False


class ProviderRetryError(ValueError):
    pass


def next_checkpoint(stage: str, error_class: str | None, attempt: int) -> dict:
    if stage not in STAGES:
        raise ProviderRetryError("unknown_stage")
    if attempt < 1:
        raise ProviderRetryError("attempt_must_be_positive")
    if SCHEDULED_PORTFOLIO_SYNC_ENABLED:
        raise ProviderRetryError("scheduled_portfolio_sync_forbidden")
    if stage == "completed":
        return _result("completed", error_class or "", attempt, retryable=False)
    if error_class is None:
        if stage in ("queued", "running", "retry_wait"):
            return _result("completed", "", attempt, retryable=False)
        raise ProviderRetryError("error_class_required")
    classification = error_class if error_class in RETRYABLE or error_class in FAIL_CLOSED else "unknown"
    if classification in FAIL_CLOSED or classification == "unknown":
        return _result("failed_closed", classification, attempt, retryable=False)
    if attempt >= MAX_ATTEMPTS:
        return _result("failed_closed", classification, attempt, retryable=False)
    return _result("retry_wait", classification, attempt, retryable=True)


def _result(stage: str, error_class: str, attempt: int, retryable: bool) -> dict:
    return {
        "stage": stage,
        "errorClass": error_class,
        "attempt": attempt,
        "retryable": retryable,
        "maxAttempts": MAX_ATTEMPTS,
        "scheduledPortfolioSyncEnabled": False,
    }
