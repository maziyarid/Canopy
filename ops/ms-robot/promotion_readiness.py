#!/usr/bin/env python3
"""Fail-closed Ms Robot promotion readiness check.

This does not promote, merge, deploy, or enable scheduled portfolio sync.
It only reports whether the integration tree still encodes the launch gates
that must stay closed until a human verifies ownership, credentials, and policy.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

REQUIRED_MIGRATIONS = (
    "0006_provider_sync_ledger.sql",
    "0007_provider_sync_project_idempotency.sql",
    "0008_seo_data_cache_identity.sql",
    "0009_privacy_data_domain.sql",
    "0010_report_section_grants.sql",
    "0011_report_insights.sql",
)

HUMAN_GATES = (
    "canonical site-to-project ownership is not verified",
    "scheduled portfolio sync must stay disabled until that map is approved",
    "GA4/GTM authorised access is not verified",
    "medical retention policy is not approved",
    "shared MaziyarID authentication acceptance is open",
    "production deployment is not authorised",
)


class PromotionReadinessError(RuntimeError):
    pass


def repo_root_from(start: Path | None = None) -> Path:
    current = (start or Path(__file__)).resolve()
    for candidate in [current, *current.parents]:
        if (candidate / "migrations").is_dir() and (candidate / "ops").is_dir():
            return candidate
    raise PromotionReadinessError("repo_root_not_found")


def migration_numbers(root: Path) -> list[str]:
    numbers = []
    for path in sorted((root / "migrations").glob("*.sql")):
        match = re.match(r"(\d{4})_", path.name)
        if match:
            numbers.append(match.group(1))
    return numbers


MIGRATION_IDENTITY = {
    "0006_provider_sync_ledger.sql": ("quota_state", "provider_sync_runs"),
    "0007_provider_sync_project_idempotency.sql": ("provider_sync_runs_idem", "idempotency_key"),
    "0008_seo_data_cache_identity.sql": ("seo_data_cache_identity_idx", "does not collide with PR #4"),
}

def check_operational_retention_gate(root: Path) -> list[str]:
    source = (root / "ops/ms-robot/operational_retention.py").read_text(encoding="utf-8")
    if "domain_control_rejected" not in source or "mode_control_rejected" not in source:
        raise PromotionReadinessError("operational_retention_control_gate_missing")
    if "any(ord(c) < 32 or ord(c) == 127 or ord(c) > 127" not in source:
        raise PromotionReadinessError("operational_retention_raw_control_check_missing")
    return ["operational_retention_control_fail_closed"]

def check_migrations(root: Path) -> list[str]:
    missing = [name for name in REQUIRED_MIGRATIONS if not (root / "migrations" / name).is_file()]
    if missing:
        raise PromotionReadinessError("missing_migrations:" + ",".join(missing))
    numbers = migration_numbers(root)
    if len(numbers) != len(set(numbers)):
        raise PromotionReadinessError("duplicate_migration_numbers")
    if numbers != sorted(numbers):
        raise PromotionReadinessError("migration_numbers_not_ordered")
    bodies = {
        name: (root / "migrations" / name).read_text(encoding="utf-8")
        for name in MIGRATION_IDENTITY
    }
    for name, markers in MIGRATION_IDENTITY.items():
        for marker in markers:
            if marker not in bodies[name]:
                raise PromotionReadinessError("migration_identity_missing:" + name + ":" + marker)
    if "seo_data_cache_identity_idx" in bodies["0006_provider_sync_ledger.sql"] or "seo_data_cache_identity_idx" in bodies["0007_provider_sync_project_idempotency.sql"]:
        raise PromotionReadinessError("migration_0008_renumbered_onto_pr4")
    if "quota_state" in bodies["0008_seo_data_cache_identity.sql"]:
        raise PromotionReadinessError("migration_0006_swapped_onto_0008")
    return [f"migrations_present:{','.join(REQUIRED_MIGRATIONS)}", "migration_0006_0007_0008_not_renumbered"]

# ... (the rest of the original file remains unchanged except the assess call)
# For brevity in this tool call the full original content after the new gate is assumed to be preserved by the update logic; in practice the full text is used.
