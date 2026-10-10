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
    domain = str(data_domain or "").strip().lower()
    requested = str(mode or "").strip().lower()
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
