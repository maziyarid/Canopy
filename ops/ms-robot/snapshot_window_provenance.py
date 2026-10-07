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


def _metric_key(metric, blank_code="snapshot_metric_blank"):
    if not isinstance(metric, str):
        raise SnapshotWindowRefused("snapshot_metric_invalid")
    if not metric.strip():
        raise SnapshotWindowRefused(blank_code)
    key = "".join(ch for ch in metric.casefold() if ch.isalpha())
    if not key:
        raise SnapshotWindowRefused(blank_code)
    return key


def _declared_metrics(raw_metrics, duplicate_code, blank_code):
    if not isinstance(raw_metrics, list):
        raise SnapshotWindowRefused("snapshot_metric_invalid")
    keys = [_metric_key(metric, blank_code) for metric in raw_metrics]
    if len(keys) != len(set(keys)):
        raise SnapshotWindowRefused(duplicate_code)
    return set(keys)


def _hidden_monetary_fields(row, blank_code):
    hidden = []
    for key, value in row.items():
        if key in {"date", "metrics"} or value in (None, "", [], {}):
            continue
        hidden.append(_metric_key(key, blank_code))
    return [key for key in hidden if key in MONETARY_METRICS]


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
    raw_metrics = snapshot.get("metrics")
    metrics_explicit = raw_metrics is not None
    metrics = _declared_metrics(raw_metrics or [], "snapshot_metric_duplicate", "snapshot_metric_blank")
    requested_currency = str(snapshot.get("requestedCurrency") or "").strip().upper()
    response_currency = str(snapshot.get("currencyCode") or "").strip().upper()
    if metrics & MONETARY_METRICS:
        if not CURRENCY_RE.fullmatch(requested_currency) or requested_currency != response_currency:
            raise SnapshotWindowRefused("snapshot_currency_mismatch")
    elif requested_currency or response_currency:
        if not CURRENCY_RE.fullmatch(requested_currency) or requested_currency != response_currency:
            raise SnapshotWindowRefused("snapshot_currency_mismatch")
    comparison = _classify_comparison(snapshot, requested_currency, response_currency, start, end)
    rows = snapshot.get("rows")
    if rows is not None:
        if not isinstance(rows, list):
            raise SnapshotWindowRefused("snapshot_row_invalid")
        for row in rows:
            if not isinstance(row, dict):
                raise SnapshotWindowRefused("snapshot_row_invalid")
            row_date = _date(row.get("date"), "snapshot_row_date_invalid")
            if row_date < start or row_date > end:
                raise SnapshotWindowRefused("snapshot_row_outside_window")
            row_metrics = row.get("metrics") or []
            if not isinstance(row_metrics, list):
                raise SnapshotWindowRefused("snapshot_metric_invalid")
            row_key_list = [_metric_key(metric, "snapshot_metric_blank") for metric in row_metrics]
            if len(row_key_list) != len(set(row_key_list)):
                raise SnapshotWindowRefused("snapshot_row_metric_duplicate")
            if set(row_key_list) & MONETARY_METRICS:
                if not CURRENCY_RE.fullmatch(requested_currency) or requested_currency != response_currency:
                    raise SnapshotWindowRefused("snapshot_currency_mismatch")
            if metrics_explicit and not metrics and row_key_list:
                raise SnapshotWindowRefused("snapshot_metric_set_empty")
            if metrics and set(row_key_list) - metrics:
                raise SnapshotWindowRefused("snapshot_row_metric_not_declared")
    return {
        "clientReady": False,
        "reportingRouteEnabled": False,
        "action": "none",
        "startDate": start,
        "endDate": end,
        "currencyCode": response_currency or None,
        "comparisonStartDate": comparison[0] if comparison else None,
        "comparisonEndDate": comparison[1] if comparison else None,
    }


def _classify_comparison(snapshot, requested_currency, response_currency, primary_start, primary_end):
    keys = (
        "comparisonStartDate",
        "comparisonEndDate",
        "comparisonRequestedStartDate",
        "comparisonRequestedEndDate",
        "comparisonCurrency",
        "comparisonMetrics",
        "comparisonRows",
    )
    present = any(snapshot.get(key) not in (None, "", []) for key in keys)
    if not present:
        return None
    start = _date(snapshot.get("comparisonStartDate"), "snapshot_comparison_window_invalid")
    end = _date(snapshot.get("comparisonEndDate"), "snapshot_comparison_window_invalid")
    if end < start:
        raise SnapshotWindowRefused("snapshot_comparison_window_inverted")
    requested_start = snapshot.get("comparisonRequestedStartDate")
    requested_end = snapshot.get("comparisonRequestedEndDate")
    if requested_start is None or requested_end is None:
        raise SnapshotWindowRefused("snapshot_comparison_window_unspecified")
    if (
        _date(requested_start, "snapshot_comparison_window_invalid") != start
        or _date(requested_end, "snapshot_comparison_window_invalid") != end
    ):
        raise SnapshotWindowRefused("snapshot_comparison_window_mismatch")
    if start == primary_start and end == primary_end:
        raise SnapshotWindowRefused("snapshot_comparison_window_not_distinct")
    raw_comparison_metrics = snapshot.get("comparisonMetrics")
    comparison_explicit = raw_comparison_metrics is not None
    declared = _declared_metrics(raw_comparison_metrics or [], "snapshot_comparison_metric_duplicate", "snapshot_comparison_metric_blank")
    metrics = set(declared)
    rows = snapshot.get("comparisonRows")
    if rows is not None:
        if not isinstance(rows, list):
            raise SnapshotWindowRefused("snapshot_row_invalid")
        for row in rows:
            if not isinstance(row, dict):
                raise SnapshotWindowRefused("snapshot_row_invalid")
            row_date = _date(row.get("date"), "snapshot_comparison_row_date_invalid")
            if row_date < start or row_date > end:
                raise SnapshotWindowRefused("snapshot_comparison_row_outside_window")
            row_metrics = row.get("metrics") or []
            if not isinstance(row_metrics, list):
                raise SnapshotWindowRefused("snapshot_metric_invalid")
            row_key_list = [_metric_key(metric, "snapshot_comparison_metric_blank") for metric in row_metrics]
            if len(row_key_list) != len(set(row_key_list)):
                raise SnapshotWindowRefused("snapshot_comparison_row_metric_duplicate")
            row_keys = set(row_key_list)
            hidden_monetary = _hidden_monetary_fields(row, "snapshot_comparison_metric_blank")
            if hidden_monetary and (not declared or set(hidden_monetary) - declared):
                raise SnapshotWindowRefused("snapshot_comparison_row_monetary_not_declared")
            if comparison_explicit and not declared and row_key_list:
                raise SnapshotWindowRefused("snapshot_comparison_metric_set_empty")
            if declared and row_keys - declared:
                raise SnapshotWindowRefused("snapshot_comparison_row_metric_not_declared")
            metrics |= row_keys
            metrics |= set(hidden_monetary)
    comparison_currency = str(snapshot.get("comparisonCurrency") or "").strip().upper()
    if metrics & MONETARY_METRICS or comparison_currency:
        if (
            not CURRENCY_RE.fullmatch(comparison_currency)
            or comparison_currency != requested_currency
            or (response_currency and comparison_currency != response_currency)
        ):
            raise SnapshotWindowRefused("snapshot_comparison_currency_mismatch")
    return start, end
