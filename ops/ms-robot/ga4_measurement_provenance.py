"""GA4 measurement provenance boundary.

A bound property is not enough to treat a Data API response as client-ready.
Sampling metadata, thresholding, or a missing response property id stays
refused. This does not call Google, does not enable client reporting, and
does not hunk-merge draft PR #28 sync correctness.
"""
from __future__ import annotations

import re
import unicodedata
from datetime import date

PROPERTY_RE = re.compile(r"^properties/[1-9][0-9]{0,18}$")
ISO_CURRENCY = re.compile(r"^[A-Z]{3}$")
REFUSED_FLAGS = frozenset({"sampled", "thresholded", "incomplete", "data_loss"})


class Ga4MeasurementProvenanceRefused(RuntimeError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def require_currency(value, present):
    """Refuse a code whose NFKC fold is a three-letter ISO currency.

    Fullwidth or compatibility letters must not become USD after normalisation.
    A blank or non-ISO code stays ga4_measurement_currency_invalid.
    """
    if not present:
        return ""
    raw = str(value if value is not None else "")
    stripped = raw.strip()
    folded = unicodedata.normalize("NFKC", stripped).upper()
    if ISO_CURRENCY.fullmatch(folded) and any(
        ord(char) > 127 or unicodedata.normalize("NFKC", char) != char
        for char in stripped
    ):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_currency_confusable")
    literal = stripped.upper()
    if not ISO_CURRENCY.fullmatch(literal):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_currency_invalid")
    return literal



DATE_RE = re.compile(r"^([0-9]{4})-([0-9]{2})-([0-9]{2})$")
# Slash, dot, or compatibility-folded separators are not the ISO window.
# Fullwidth slash U+FF0F folds to "/" and must not become a hyphen date.
SEPARATOR_RE = re.compile(r"^\d{4}[./]\d{1,2}[./]\d{1,2}$")
# Compact YYYYMMDD is not the ISO window. NFKC folds fullwidth digits first.
COMPACT_RE = re.compile(r"^\d{8}$")
# Space-separated numeric dates are not the ISO window.
SPACED_RE = re.compile(r"^\d{4}\s+\d{1,2}\s+\d{1,2}$")
# Unpadded ISO-like dates (2026-9-1, 2026-09-1) are not the requested window.
UNPADDED_RE = re.compile(r"^\d{4}-\d{1,2}-\d{1,2}$")
# Datetime suffixes (2026-09-01T00:00:00, 2026-09-01 00:00) are not the date-only window.
DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[T ]")
# Timezone offset suffixes (2026-09-01+00:00, 2026-09-01Z) are not the date-only window.
OFFSET_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[+-Zz]")
# ISO week-year (2026-W36, 2026-W36-1) is not the date-only window.
WEEK_RE = re.compile(r"^\d{4}-W\d{1,2}(-\d)?$")



def require_iso_date(value):
    raw = str(value if value is not None else "").strip()
    folded = unicodedata.normalize("NFKC", raw)
    if SEPARATOR_RE.fullmatch(folded) or (folded != raw and SEPARATOR_RE.fullmatch(folded)):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_separator")
    if "/" in folded or (folded != raw and "/" in folded):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_separator")
    if SPACED_RE.fullmatch(folded):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_separator")
    if COMPACT_RE.fullmatch(folded):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_compact")
    # A value that becomes ISO only after compatibility folding is not the
    # requested window. Matching the raw string keeps fullwidth digits and
    # fullwidth hyphens from being accepted as 2026-09-01.
    if DATE_RE.fullmatch(folded) and not DATE_RE.fullmatch(raw):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_folded")
    # 2026-9-1 is calendar-shaped but not the zero-padded ISO window.
    # Check the folded form so fullwidth digits cannot skip the refusal.
    if UNPADDED_RE.fullmatch(folded) and not DATE_RE.fullmatch(folded):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_unpadded")
    # A datetime suffix is not the requested date-only window.
    # Check the folded form so fullwidth digits or separators cannot skip it.
    if DATETIME_RE.match(folded) or (folded != raw and DATETIME_RE.match(folded)):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_datetime")
    # A timezone offset suffix is not the requested date-only window.
    # Check the folded form so fullwidth digits cannot skip the refusal.
    if OFFSET_RE.match(folded) or (folded != raw and OFFSET_RE.match(folded)):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_offset")
    # An ISO week-year is not the requested date-only window.
    # Check the folded form so fullwidth digits cannot skip the refusal.
    if WEEK_RE.fullmatch(folded) or (folded != raw and WEEK_RE.fullmatch(folded)):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_week")

    match = DATE_RE.fullmatch(raw)
    if not match:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_invalid")
    year, month, day = (int(part) for part in match.groups())
    try:
        return date(year, month, day)
    except ValueError as exc:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_invalid") from exc


def require_date_range_complete(measurement):
    """Refuse a response window that is not exactly the requested range.

    Omitted date keys stay allowed so an already-observed row is not forced
    into a provider call. A partial set or an impossible calendar date fails
    closed. A response that starts later or ends earlier is incomplete. A
    response that starts earlier or ends later is wider and is not the
    requested window.
    """
    keys = ("requestedStartDate", "requestedEndDate", "responseStartDate", "responseEndDate")
    present = [key in measurement for key in keys]
    if not any(present):
        return
    if not all(present):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_invalid")
    requested_start = require_iso_date(measurement.get("requestedStartDate"))
    requested_end = require_iso_date(measurement.get("requestedEndDate"))
    response_start = require_iso_date(measurement.get("responseStartDate"))
    response_end = require_iso_date(measurement.get("responseEndDate"))
    if requested_start > requested_end or response_start > response_end:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_invalid")
    if response_start > requested_start or response_end < requested_end:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_incomplete")
    if response_start < requested_start or response_end > requested_end:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_date_range_wider")


def classify_ga4_measurement(measurement, mode="inspect"):
    if not isinstance(measurement, dict):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_invalid")
    requested = str(mode or "").strip().lower()
    if requested in {"enable", "sync", "schedule", "publish", "serve"}:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_reporting_disabled")
    if requested != "inspect":
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_mode_unknown")
    if measurement.get("clientReportingEnabled") is True or measurement.get("scheduledSyncEnabled") is True:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_reporting_disabled")
    property_ref = str(measurement.get("property") or "").strip()
    response_property = str(measurement.get("responseProperty") or "").strip()
    if not PROPERTY_RE.fullmatch(property_ref) or property_ref != response_property:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_property_mismatch")
    if "samplingMetadatas" not in measurement or "subjectToThresholding" not in measurement:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_quality_unspecified")
    flags = {str(flag).strip().lower() for flag in (measurement.get("qualityFlags") or [])}
    sampling = measurement.get("samplingMetadatas")
    if not isinstance(sampling, list) or sampling or flags & REFUSED_FLAGS:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_not_observed")
    if measurement.get("subjectToThresholding") is not False:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_not_observed")
    if measurement.get("dataLossFromOtherRow") is True:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_not_observed")
    require_date_range_complete(measurement)
    requested_present = "requestedCurrency" in measurement
    response_present = "currencyCode" in measurement
    requested_currency = require_currency(measurement.get("requestedCurrency"), requested_present)
    response_currency = require_currency(measurement.get("currencyCode"), response_present)
    if requested_currency and requested_currency != response_currency:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_currency_mismatch")
    source_ref = str(measurement.get("sourceRef") or "").strip()
    if not source_ref.startswith("ga4:"):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_source_missing")
    return {
        "clientReady": False,
        "providerReady": False,
        "scheduledSyncEnabled": False,
        "clientReportingEnabled": False,
        "action": "none",
        "observed": True,
    }
