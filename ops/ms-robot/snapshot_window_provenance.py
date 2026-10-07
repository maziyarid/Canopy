"""AAX-81 snapshot date-range and currency provenance boundary.

Sampling and route enablement stay on snapshot_provenance_gate.py. This module
only refuses a window or currency that cannot be shown as the requested
snapshot. It does not enable /api/v1/reporting/snapshot and does not read a
provider.
"""
from __future__ import annotations

import re
from datetime import date

DATE_RE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
CURRENCY_RE = re.compile(r"^[A-Z]{3}$")
MONETARY_METRICS = frozenset({
    "revenue",
    "purchaserevenue",
    "totalrevenue",
    "advertiseradcost",
    "adcost",
    "itemrevenue",
})


class SnapshotWindowRefused(RuntimeError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _date(value, code):
    text = str(value or "").strip()
    if not DATE_RE.fullmatch(text):
        raise SnapshotWindowRefused(code)
    year, month, day = (int(part) for part in text.split("-"))
    try:
        date(year, month, day)
    except ValueError:
        raise SnapshotWindowRefused("snapshot_calendar_invalid") from None
    return text


def classify_snapshot_window(snapshot, mode="inspect"):
    if not isinstance(snapshot, dict):
        raise SnapshotWindowRefused("snapshot_window_invalid")
    requested = str(mode or "").strip().lower()
    if requested in {"enable", "publish", "serve"}:
        raise SnapshotWindowRefused("snapshot_route_disabled")
    if requested != "inspect":
        raise SnapshotWindowRefused("snapshot_window_mode_unknown")
    if snapshot.get("reportingRouteEnabled") is True:
        raise SnapshotWindowRefused("snapshot_route_disabled")
    project_id = str(snapshot.get("projectId") or "").strip()
    bound_project_id = str(snapshot.get("boundProjectId") or "").strip()
    if not project_id or project_id != bound_project_id:
        raise SnapshotWindowRefused("snapshot_project_unbound")
    start = _date(snapshot.get("startDate"), "snapshot_window_invalid")
    end = _date(snapshot.get("endDate"), "snapshot_window_invalid")
    if end < start:
        raise SnapshotWindowRefused("snapshot_window_inverted")
    requested_start = snapshot.get("requestedStartDate")
    requested_end = snapshot.get("requestedEndDate")
    if requested_start is None or requested_end is None:
        raise SnapshotWindowRefused("snapshot_window_unspecified")
    if _date(requested_start, "snapshot_window_invalid") != start or _date(requested_end, "snapshot_window_invalid") != end:
        raise SnapshotWindowRefused("snapshot_window_mismatch")
    metrics = {str(metric).strip().casefold() for metric in (snapshot.get("metrics") or [])}
    requested_currency = str(snapshot.get("requestedCurrency") or "").strip().upper()
    response_currency = str(snapshot.get("currencyCode") or "").strip().upper()
    if metrics & MONETARY_METRICS:
        if not CURRENCY_RE.fullmatch(requested_currency) or requested_currency != response_currency:
            raise SnapshotWindowRefused("snapshot_currency_mismatch")
    elif requested_currency or response_currency:
        if not CURRENCY_RE.fullmatch(requested_currency) or requested_currency != response_currency:
            raise SnapshotWindowRefused("snapshot_currency_mismatch")
    return {
        "clientReady": False,
        "reportingRouteEnabled": False,
        "action": "none",
        "startDate": start,
        "endDate": end,
        "currencyCode": response_currency or None,
    }
