"""Fail-closed operational retention planner for AAX-55.

This module never deletes rows and never activates medical retention.
A caller may request a dry-run count for thesis/other domains only.
Any execute/apply mode, unknown domain, or medical domain fails closed.
"""
from __future__ import annotations

OPERATIONAL_DOMAINS = frozenset({"thesis", "other"})


class RetentionRefused(RuntimeError):
    pass


def plan_operational_retention(*, data_domain: str, mode: str, candidate_rows: int) -> dict:
    raw_domain = str(data_domain or "")
    domain = raw_domain.strip().lower()
    # Fail closed on any non-ASCII after normalisation so confusables and format characters
    # cannot be accepted even if a future set membership check is loosened.
    if any(ord(char) > 127 for char in domain):
        raise RetentionRefused("retention_refused_domain")
    requested = str(mode or "").strip().lower()
    # Same non-ASCII guard for mode so fullwidth/confusable modes cannot bypass the exact dry-run match.
    if any(ord(char) > 127 for char in requested):
        raise RetentionRefused("retention_execution_disabled")
    if domain == "medical" or domain not in OPERATIONAL_DOMAINS:
        raise RetentionRefused("retention_refused_domain")
    if requested != "dry-run":
        raise RetentionRefused("retention_execution_disabled")
    if isinstance(candidate_rows, bool) or not isinstance(candidate_rows, int) or candidate_rows < 0:
        raise RetentionRefused("retention_row_count_invalid")
    return {
        "action": "none",
        "executed": False,
        "dataDomain": domain,
        "mode": "dry-run",
        "candidateRows": candidate_rows,
        "medicalRetentionActivated": False,
    }
