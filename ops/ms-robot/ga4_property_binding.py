"""GA4 property-binding boundary for provider completion.

This does not call Google, does not enable scheduled portfolio sync, and does
not replace the GA4 sync correctness owned by draft PR #28. A property is not
client-ready or sync-ready from a numeric id or a mismatched binding.
"""
from __future__ import annotations

import re

PROPERTY_RE = re.compile(r"^properties/[1-9][0-9]{0,18}$")


class Ga4BindingRefused(RuntimeError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def classify_ga4_binding(binding, mode="inspect"):
    if not isinstance(binding, dict):
        raise Ga4BindingRefused("ga4_binding_invalid")
    requested = str(mode or "").strip().lower()
    if requested in {"enable", "sync", "schedule", "publish", "serve"}:
        raise Ga4BindingRefused("ga4_sync_disabled")
    if requested != "inspect":
        raise Ga4BindingRefused("ga4_mode_unknown")
    if binding.get("scheduledSyncEnabled") is True or binding.get("clientReportingEnabled") is True:
        raise Ga4BindingRefused("ga4_sync_disabled")
    project_id = str(binding.get("projectId") or "").strip()
    bound_project_id = str(binding.get("boundProjectId") or "").strip()
    if not project_id or project_id != bound_project_id or project_id == "legacy":
        raise Ga4BindingRefused("ga4_project_unbound")
    site = str(binding.get("site") or "").strip()
    bound_site = str(binding.get("boundSite") or "").strip()
    if not site or site != bound_site:
        raise Ga4BindingRefused("ga4_site_unbound")
    property_ref = str(binding.get("property") or "").strip()
    bound_property = str(binding.get("boundProperty") or "").strip()
    if not PROPERTY_RE.fullmatch(property_ref) or property_ref != bound_property:
        raise Ga4BindingRefused("ga4_property_unbound")
    if binding.get("authorisedRead") is not True:
        raise Ga4BindingRefused("ga4_authorised_read_missing")
    return {
        "providerReady": False,
        "scheduledSyncEnabled": False,
        "clientReportingEnabled": False,
        "action": "none",
        "property": property_ref,
    }
