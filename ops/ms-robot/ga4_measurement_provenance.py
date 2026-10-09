"""GA4 measurement provenance boundary.

A bound property is not enough to treat a Data API response as client-ready.
Sampling metadata, thresholding, or a missing response property id stays
refused. This does not call Google, does not enable client reporting, and
does not hunk-merge draft PR #28 sync correctness.
"""
from __future__ import annotations

import re
import unicodedata

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
