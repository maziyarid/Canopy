"""Fail-closed operational retention planner for AAX-55.

This module never deletes rows and never activates medical retention.
A caller may request a dry-run count for thesis/other domains only.
Any execute/apply mode, unknown domain, or medical domain fails closed.
Non-string inputs for domain or mode are refused before normalisation.
Raw control, DEL, or non-ASCII characters are refused before any strip/lower so they cannot be stripped away to smuggle a valid value.
"""
from __future__ import annotations

OPERATIONAL_DOMAINS = frozenset({"thesis", "other"})
MAX_CANDIDATE_ROWS = 1_000_000


class RetentionRefused(RuntimeError):
    pass


def _has_forbidden_chars(value: str) -> bool:
    return any(ord(char) < 32 or ord(char) == 127 or ord(char) > 127 for char in value)


def plan_operational_retention(*, data_domain: str, mode: str, candidate_rows: int) -> dict:
    if not isinstance(data_domain, str):
        raise RetentionRefused("retention_refused_domain")
    if not isinstance(mode, str):
        raise RetentionRefused("retention_execution_disabled")
    # Reject raw control/DEL/non-ASCII before strip so trailing controls that strip() removes cannot smuggle a valid domain or mode.
    if _has_forbidden_chars(data_domain):
        raise RetentionRefused("retention_refused_domain")
    if _has_forbidden_chars(mode):
        raise RetentionRefused("retention_execution_disabled")
    domain = data_domain.strip().lower()
    requested = mode.strip().lower()
    if domain == "medical" or domain not in OPERATIONAL_DOMAINS:
        raise RetentionRefused("retention_refused_domain")
    if requested != "dry-run":
        raise RetentionRefused("retention_execution_disabled")
    if isinstance(candidate_rows, bool) or not isinstance(candidate_rows, int) or candidate_rows < 0 or candidate_rows > MAX_CANDIDATE_ROWS:
        raise RetentionRefused("retention_row_count_invalid")
    plan = {
        "action": "none",
        "executed": False,
        "dataDomain": domain,
        "mode": "dry-run",
        "candidateRows": candidate_rows,
        "medicalRetentionActivated": False,
    }
    # Exact shape proof: no extra keys that could be misread as execution authority.
    expected = {"action", "executed", "dataDomain", "mode", "candidateRows", "medicalRetentionActivated"}
    if set(plan) != expected or plan["executed"] or plan["action"] != "none" or plan["medicalRetentionActivated"]:
        raise RetentionRefused("retention_result_shape_invalid")
    return plan
