"""Fail-closed operational retention planner for AAX-55.

This module never deletes rows and never activates medical retention.
A caller may request a dry-run count for thesis/other domains only.
Any execute/apply mode, unknown domain, medical domain, or domain containing
zero-width / control characters fails closed.
"""
from __future__ import annotations

OPERATIONAL_DOMAINS = frozenset({"thesis", "other"})
ZERO_WIDTH = frozenset({"\u200b", "\u200c", "\u200d", "\ufeff"})


class RetentionRefused(RuntimeError):
    pass


def plan_operational_retention(*, data_domain: str, mode: str, candidate_rows: int) -> dict:
    raw = str(data_domain or "")
    if any(ch in ZERO_WIDTH for ch in raw) or any(ord(ch) < 32 for ch in raw if ch not in "\t\n\r "):
        raise RetentionRefused("retention_refused_domain")
    domain = raw.strip().lower()
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
