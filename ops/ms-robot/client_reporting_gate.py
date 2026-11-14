"""Minimal seam for AAX-80 client reporting early-return contract.

Proves that when client reporting is not configured, client-role requests
fail closed before any ledger/provider read. Does not enable reporting,
does not call providers, and does not touch production state.
"""

from __future__ import annotations


class ClientReportingRefused(RuntimeError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


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
    - Fail closed on non-string, empty, control, or non-ASCII roles/project ids.
    """
    if not isinstance(reporting_configured, bool):
        raise ClientReportingRefused("client_reporting_config_invalid")
    if not isinstance(role, str):
        raise ClientReportingRefused("client_role_invalid")
    raw_role = role
    normalized = raw_role.strip().lower()
    if any(ord(c) < 32 or ord(c) == 127 or ord(c) > 127 for c in normalized) or not normalized:
        raise ClientReportingRefused("client_role_invalid")
    if normalized not in {"client", "owner", "editor"}:
        raise ClientReportingRefused("client_role_unknown")
    if project_id is not None:
        if not isinstance(project_id, str):
            raise ClientReportingRefused("client_project_invalid")
        if any(ord(c) < 32 or ord(c) == 127 or ord(c) > 127 for c in project_id) or not project_id.strip():
            raise ClientReportingRefused("client_project_unbound")
    if not reporting_configured and normalized == "client":
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
