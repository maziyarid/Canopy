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
    "site_map_invalid",
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


def sync_error_class(message: str | None) -> str:
    """Map a gateway/portfolio failure message onto a checkpoint class.

    Missing site maps and unauthorised properties are never retryable.
    """
    raw = str(message or "").strip()
    lowered = raw.lower()
    if raw in ("not_configured", "adapter_not_implemented", "ambiguous_schema"):
        return raw
    if "site_map_missing" in lowered or "ms_robot_project_site_map_json is required" in lowered:
        return "site_map_missing"
    if (
        "must be valid json" in lowered
        or "non-empty object" in lowered
        or "empty site" in lowered
        or "invalid project id" in lowered
        or "more than one project" in lowered
        or "site_map_invalid" in lowered
    ):
        return "site_map_invalid"
    if raw.startswith("gsc_property_not_authorised") or "gsc_property_not_authorised" in lowered:
        return "gsc_property_not_authorised"
    if ("rate" in lowered and "limit" in lowered) or "429" in lowered or "quota" in lowered:
        return "rate_limited"
    if "timeout" in lowered or "unreachable" in lowered:
        return "timeout"
    if "database is locked" in lowered or "sqlite_busy" in lowered or "analytics_schema_migration_busy" in lowered:
        return "sqlite_busy"
    if raw.startswith("google_provider_5") or "provider_unavailable" in lowered:
        return "provider_unavailable"
    if raw == "adapter_not_implemented":
        return raw
    return "unknown"


def checkpoint_for_sync_failure(message: str | None, attempt: int = 1, stage: str = "running") -> dict:
    return next_checkpoint(stage, sync_error_class(message), attempt)
