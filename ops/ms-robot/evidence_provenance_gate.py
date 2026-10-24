"""AAX-82 evidence-linked insights provenance boundary.

This module does not enable client insight routes, does not persist insights,
and does not replace the TypeScript evidence-insights store. It only classifies
whether an insight draft may be treated as review-ready.
"""
from __future__ import annotations

ALLOWED_KINDS = frozenset({"observation", "anomaly", "hypothesis", "recommendation"})
ALLOWED_PROVENANCE = frozenset({"first_party", "third_party_estimate", "mixed_blocked"})


class EvidenceProvenanceRefused(RuntimeError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def classify_evidence_insight(draft, mode="inspect"):
    if not isinstance(draft, dict):
        raise EvidenceProvenanceRefused("evidence_invalid")
    requested = str(mode or "").strip().lower()
    if any(ord(char) > 127 for char in requested):
        raise EvidenceProvenanceRefused("evidence_mode_unknown")
    if requested in {"enable", "publish", "serve", "approve"}:
        raise EvidenceProvenanceRefused("evidence_route_disabled")
    if requested != "inspect":
        raise EvidenceProvenanceRefused("evidence_mode_unknown")
    project_id = str(draft.get("projectId") or "").strip()
    if any(ord(c) < 32 or ord(c) == 127 or ord(c) > 127 for c in project_id) or not project_id:
        raise EvidenceProvenanceRefused("evidence_project_unbound")
    kind = str(draft.get("type") or "").strip().lower()
    if kind not in ALLOWED_KINDS:
        raise EvidenceProvenanceRefused("evidence_kind_unknown")
    provenance = str(draft.get("provenance") or "").strip().lower()
    if provenance not in ALLOWED_PROVENANCE:
        raise EvidenceProvenanceRefused("evidence_provenance_missing")
    refs = draft.get("evidenceRefs")
    if not isinstance(refs, list) or not refs:
        raise EvidenceProvenanceRefused("evidence_refs_missing")
    for ref in refs:
        if not isinstance(ref, dict):
            raise EvidenceProvenanceRefused("evidence_ref_invalid")
        provider = str(ref.get("provider") or "").strip().lower()
        if provider not in {"gsc", "ga4", "mangools", "other"}:
            raise EvidenceProvenanceRefused("evidence_provider_unknown")
    return {
        "reviewReady": False,
        "clientVisible": False,
        "action": "none",
        "kind": kind,
        "provenance": provenance,
    }
