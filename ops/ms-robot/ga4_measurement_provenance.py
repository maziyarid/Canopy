"""GA4 measurement provenance boundary.

A bound property is not enough to treat a Data API response as client-ready.
Sampling metadata, thresholding, or a missing response property id stays
refused. This does not call Google, does not enable client reporting, and
does not hunk-merge draft PR #28 sync correctness.
"""
from __future__ import annotations

import re

PROPERTY_RE = re.compile(r"^properties/[1-9][0-9]{0,18}$")
REFUSED_FLAGS = frozenset({"sampled", "thresholded", "incomplete", "data_loss"})


class Ga4MeasurementProvenanceRefused(RuntimeError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


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
    flags = {str(flag).strip().lower() for flag in (measurement.get("qualityFlags") or [])}
    if flags & REFUSED_FLAGS or measurement.get("samplingMetadatas"):
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_not_observed")
    if measurement.get("subjectToThresholding") is True:
        raise Ga4MeasurementProvenanceRefused("ga4_measurement_not_observed")
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
