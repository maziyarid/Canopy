"""AAX-81 snapshot provenance boundary for promotion readiness.

This module does not enable /api/v1/reporting/snapshot, does not read a
provider, and does not replace the TypeScript sampled-metric fail-closed on
feat/aax-81-snapshot-provenance-20261006. It only classifies whether a
snapshot may be treated as client-ready.
"""
from __future__ import annotations

SAMPLED_KINDS = frozenset({"sampled", "incomplete", "estimated", "partial"})


class SnapshotProvenanceRefused(RuntimeError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def classify_snapshot(snapshot, mode="inspect"):
    if not isinstance(snapshot, dict):
        raise SnapshotProvenanceRefused("snapshot_invalid")
    requested = str(mode or "").strip().lower()
    # Fail closed on any non-ASCII after normalisation so confusables and format characters
    # cannot be accepted even if a future exact-match check is loosened.
    if any(ord(char) > 127 for char in requested):
        raise SnapshotProvenanceRefused("snapshot_mode_unknown")
    if requested in {"enable", "publish", "serve"}:
        raise SnapshotProvenanceRefused("snapshot_route_disabled")
    if requested != "inspect":
        raise SnapshotProvenanceRefused("snapshot_mode_unknown")
    if snapshot.get("reportingRouteEnabled") is True:
        raise SnapshotProvenanceRefused("snapshot_route_disabled")
    project_id = str(snapshot.get("projectId") or "").strip()
    bound_project_id = str(snapshot.get("boundProjectId") or "").strip()
    # Fail closed on control characters or non-ASCII in identity fields so confusables and
    # injection residues cannot be treated as bound.
    for field in (project_id, bound_project_id):
        if any(ord(c) < 32 or ord(c) == 127 or ord(c) > 127 for c in field):
            raise SnapshotProvenanceRefused("snapshot_project_unbound")
    if not project_id or project_id != bound_project_id:
        raise SnapshotProvenanceRefused("snapshot_project_unbound")
    provenance = str(snapshot.get("provenance") or "").strip()
    if provenance not in {"first_party", "third_party_estimate"}:
        raise SnapshotProvenanceRefused("snapshot_provenance_missing")
    measurement = str(snapshot.get("measurementKind") or "").strip().lower()
    if measurement in SAMPLED_KINDS:
        raise SnapshotProvenanceRefused("snapshot_sampled_not_client_ready")
    source_ref = str(snapshot.get("sourceRef") or "").strip()
    if any(ord(c) < 32 or ord(c) == 127 or ord(c) > 127 for c in source_ref):
        raise SnapshotProvenanceRefused("snapshot_source_missing")
    if not source_ref:
        raise SnapshotProvenanceRefused("snapshot_source_missing")
    return {
        "clientReady": False,
        "reportingRouteEnabled": False,
        "action": "none",
        "provenance": provenance,
    }
