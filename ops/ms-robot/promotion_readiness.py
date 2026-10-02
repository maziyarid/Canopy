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


def check_migrations(root: Path) -> list[str]:
    missing = [name for name in REQUIRED_MIGRATIONS if not (root / "migrations" / name).is_file()]
    if missing:
        raise PromotionReadinessError("missing_migrations:" + ",".join(missing))
    numbers = migration_numbers(root)
    if len(numbers) != len(set(numbers)):
        raise PromotionReadinessError("duplicate_migration_numbers")
    if numbers != sorted(numbers):
        raise PromotionReadinessError("migration_numbers_not_ordered")
    return [f"migrations_present:{','.join(REQUIRED_MIGRATIONS)}"]


def check_medical_note_gate(root: Path) -> list[str]:
    source = (root / "src/lib/server/insight-persistence.ts").read_text(encoding="utf-8")
    if source.count('data_domain === "medical"') < 2:
        raise PromotionReadinessError("medical_note_gate_missing")
    if "Manual notes are unavailable for this project" not in source:
        raise PromotionReadinessError("medical_note_refusal_missing")
    return ["medical_manual_notes_fail_closed"]


def check_provider_retry_gate(root: Path) -> list[str]:
    source = (root / "ops/ms-robot/provider_retry_checkpoint.py").read_text(encoding="utf-8")
    if "SCHEDULED_PORTFOLIO_SYNC_ENABLED = False" not in source:
        raise PromotionReadinessError("provider_retry_enables_scheduled_sync")
    for marker in ("site_map_missing", "gsc_property_not_authorised", "not_configured"):
        if marker not in source:
            raise PromotionReadinessError("provider_retry_fail_closed_missing:" + marker)
    if "MAX_ATTEMPTS = 3" not in source:
        raise PromotionReadinessError("provider_retry_bound_missing")
    gateway = (root / "ops/analytics-gateway/gateway.py").read_text(encoding="utf-8")
    if "checkpoint_for_sync_failure" not in gateway:
        raise PromotionReadinessError("gateway_retry_checkpoint_not_wired")
    portfolio = (root / "ops/analytics-gateway/portfolio_gsc.py").read_text(encoding="utf-8")
    if "site_map_missing" not in portfolio:
        raise PromotionReadinessError("portfolio_site_map_checkpoint_missing")
    return ["provider_retry_checkpoint_fail_closed", "gateway_sync_failure_checkpoint_wired"]


def check_client_note_order_gate(root: Path) -> list[str]:
    source = (root / "src/lib/server/insight-persistence.ts").read_text(encoding="utf-8")
    marker = "payload::json->>'visibility'='client' and payload::json->>'reviewState'='approved'"
    limit = "order by generated_at desc,id asc limit ${pageSize}"
    if marker not in source or limit not in source:
        raise PromotionReadinessError("client_note_filter_before_limit_missing")
    if source.find(marker) > source.find(limit):
        raise PromotionReadinessError("client_note_limit_precedes_approval_filter")
    return ["client_note_approval_filter_before_limit"]


def check_portfolio_map_gate(root: Path) -> list[str]:
    source = (root / "ops/analytics-gateway/portfolio_gsc.py").read_text(encoding="utf-8")
    if "MS_ROBOT_PROJECT_SITE_MAP_JSON is required" not in source:
        raise PromotionReadinessError("portfolio_map_required_gate_missing")
    if "gsc_property_not_authorised" not in source:
        raise PromotionReadinessError("unauthorised_property_fail_closed_missing")
    if "isinstance(raw_project, str)" not in source:
        raise PromotionReadinessError("non_string_project_id_not_rejected")
    if "reserved project scope" not in source:
        raise PromotionReadinessError("reserved_project_scope_not_rejected")
    return ["scheduled_portfolio_map_fail_closed", "non_string_project_id_fail_closed", "reserved_project_scope_fail_closed"]


def assess(root: Path | None = None) -> dict:
    root = repo_root_from(root)
    checks = []
    checks.extend(check_migrations(root))
    checks.extend(check_medical_note_gate(root))
    checks.extend(check_portfolio_map_gate(root))
    checks.extend(check_provider_retry_gate(root))
    checks.extend(check_client_note_order_gate(root))
    return {
        "status": "not_promotable",
        "promotionAuthorised": False,
        "scheduledPortfolioSyncEnabled": False,
        "checks": checks,
        "humanGates": list(HUMAN_GATES),
    }


def main() -> int:
    report = assess()
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
