"""Minimal seam for AAX-80 client reporting early-return contract.

Proves that when client reporting is not configured, client-role requests
fail closed before any ledger/provider read. Does not enable reporting,
does not call providers, and does not touch production state.
"""

from __future__ import annotations


def client_gate_decision(
    reporting_configured: bool,
    role: str,
    project_id: str | None = None,
) -> dict:
    """Return the early-return decision for a client reporting surface.

    Contract:
    - If reporting_configured is False and role == "client", deny before data read.
    - Owner/editor may proceed (their surfaces are separate).
    - Never enables reporting or scheduled sync.
    """
    if not reporting_configured and role == "client":
        return {
            "allowed": False,
            "reason": "reporting_not_configured",
            "read_data": False,
            "project_id": project_id,
        }
    return {
        "allowed": True,
        "reason": None,
        "read_data": True,
        "project_id": project_id,
    }
