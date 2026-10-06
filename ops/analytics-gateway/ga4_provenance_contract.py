"""Pure GA4 provenance reconciliation contract.

This module does not touch the Google provider, GSC MCP adapter, delegated
OAuth writer, or SQLite schema. It records the rules that must survive a later
hunk-level merge of PR #28 onto the PR #21/#23 stack.
"""

from __future__ import annotations


class ProvenanceError(ValueError):
    """Fail closed when measurements cannot be labelled safely."""


def reconcile_source_summary(rows):
    """Return one source identity, or None when provenance is incomplete.

    Mixed property/timezone identities and missing row provenance must not be
    replaced with the latest mutable site snapshot.
    """
    sources = [row.get("source") for row in rows]
    if not sources or any(not source for source in sources):
        return None
    identities = {
        (source.get("provider"), source.get("property"), source.get("timeZone"))
        for source in sources
    }
    if len(identities) != 1:
        raise ProvenanceError("ambiguous_source_identity")
    provider, property_ref, time_zone = next(iter(identities))
    if provider != "ga4" or not property_ref:
        raise ProvenanceError("invalid_ga4_property")
    retrieved = [source.get("retrievedAt") or "" for source in sources]
    return {
        "provider": provider,
        "property": property_ref,
        "timeZone": time_zone,
        "retrievedAt": max(retrieved) or None,
        "backfilled": False,
    }


def period_unique_users(summary_metrics, daily_rows):
    """Period unique users come only from an exact-window provider summary."""
    if not isinstance(summary_metrics, dict) or "totalUsers" not in summary_metrics:
        return None
    value = summary_metrics.get("totalUsers")
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return value


def omit_landing_collisions(rows):
    """Every member of a sanitized landing-page collision group is omitted."""
    counts = {}
    for row in rows:
        key = str((row.get("dimensions") or {}).get("landingPage") or "").strip()
        counts[key] = counts.get(key, 0) + 1
    collisions = {key for key, count in counts.items() if count > 1}
    kept = []
    omitted = 0
    for row in rows:
        key = str((row.get("dimensions") or {}).get("landingPage") or "").strip()
        if not key or key in collisions or row.get("metrics") is None:
            omitted += 1
            continue
        kept.append(row)
    return {
        "rows": kept,
        "omittedRows": omitted,
        "complete": not collisions and omitted == 0,
    }
