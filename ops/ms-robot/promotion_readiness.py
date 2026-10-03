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
    recovery = (root / "ops/ms-robot/provider_job_recovery.py").read_text(encoding="utf-8")
    if "SCHEDULED_PORTFOLIO_SYNC_ENABLED" not in recovery or "scheduled_portfolio_sync_forbidden" not in recovery:
        raise PromotionReadinessError("provider_job_recovery_enables_scheduled_sync")
    if "def recover_stale_running" not in recovery:
        raise PromotionReadinessError("provider_job_recovery_missing")
    if "def record_attempt_failure" not in recovery or "persisted = str(row[\"error_class\"] or \"\").strip()" not in recovery:
        raise PromotionReadinessError("provider_job_recovery_class_not_persisted")
    if "error_class: str = \"provider_unavailable\"" in recovery:
        raise PromotionReadinessError("provider_job_recovery_uses_caller_default")
    proof = (root / "ops/ms-robot/test_provider_job_recovery.py").read_text(encoding="utf-8")
    if "test_fail_closed_class_is_not_retried_after_restart" not in proof:
        raise PromotionReadinessError("provider_job_recovery_proof_missing")
    if "test_recovery_uses_persisted_class_not_caller_default" not in proof:
        raise PromotionReadinessError("persisted_error_class_proof_missing")
    return [
        "provider_retry_checkpoint_fail_closed",
        "gateway_sync_failure_checkpoint_wired",
        "provider_job_recovery_fail_closed",
    ]


def check_client_note_order_gate(root: Path) -> list[str]:
    source = (root / "src/lib/server/insight-persistence.ts").read_text(encoding="utf-8")
    marker = "payload::json->>'visibility'='client' and payload::json->>'reviewState'='approved'"
    limit = "order by generated_at desc,id asc limit ${pageSize}"
    if marker not in source or limit not in source:
        raise PromotionReadinessError("client_note_filter_before_limit_missing")
    if source.find(marker) > source.find(limit):
        raise PromotionReadinessError("client_note_limit_precedes_approval_filter")
    if "VISIBLE_NOTE_LIMIT" not in source or "truncated = extra.length > 0" not in source:
        raise PromotionReadinessError("client_note_truncation_not_explicit")
    return ["client_note_approval_filter_before_limit", "client_note_truncation_explicit"]


def check_journal_warning_copy_gate(root: Path) -> list[str]:
    """Journal truncation warning stays on the mount that already has warnings.

    ClientReportView only has per-section warning. Do not invent a journal
    warnings array. If that slot appears later, it must carry the same copy.
    """
    mount = (root / "src/lib/server/insight-journal-mount.ts").read_text(encoding="utf-8")
    snapshot = (root / "src/lib/server/reporting-snapshot.ts").read_text(encoding="utf-8")
    view = (root / "src/lib/server/client-report-view.ts").read_text(encoding="utf-8")
    warning = "Showing the newest visible notes only. Older notes are omitted."
    if "truncated: noteWindow.truncated" not in snapshot:
        raise PromotionReadinessError("snapshot_omits_note_truncation")
    if warning not in mount or "options.truncated" not in mount:
        raise PromotionReadinessError("journal_truncation_warning_missing")
    view_type = view.split("export type ClientReportView = {", 1)[-1].split("};", 1)[0]
    if "warnings:" in view_type and warning not in view:
        raise PromotionReadinessError("client_report_warnings_drop_journal_truncation")
    return ["journal_truncation_warning_mounted"]


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
    if "project_id=raw_project.strip()" not in source or source.find("project_id=raw_project.strip()") > source.find("PROJECT_ID_PATTERN.fullmatch"):
        raise PromotionReadinessError("whitespace_project_id_not_stripped_before_pattern")
    proof = (root / "ops/ms-robot/test_portfolio_invalid_project_id_process.py").read_text(encoding="utf-8")
    if "test_whitespace_only_project_id_exits_1_without_discovery" not in proof:
        raise PromotionReadinessError("whitespace_project_id_process_proof_missing")
    padded = (root / "ops/ms-robot/test_portfolio_padded_project_id_process.py").read_text(encoding="utf-8")
    if "test_padded_project_id_is_stripped_before_discovery" not in padded:
        raise PromotionReadinessError("padded_project_id_process_proof_missing")
    if '.removeprefix("www.")' not in source:
        raise PromotionReadinessError("www_prefix_not_normalised_before_conflict")
    www_proof = (root / "ops/ms-robot/test_portfolio_www_site_conflict_process.py").read_text(encoding="utf-8")
    if "test_www_and_apex_project_conflict_exits_1_without_discovery" not in www_proof:
        raise PromotionReadinessError("www_apex_conflict_process_proof_missing")
    if '.rstrip(".")' not in source:
        raise PromotionReadinessError("trailing_dot_not_normalised_before_conflict")
    trailing = (root / "ops/ms-robot/test_portfolio_trailing_dot_site_conflict_process.py").read_text(encoding="utf-8")
    if "test_trailing_dot_host_conflicts_with_apex_before_discovery" not in trailing:
        raise PromotionReadinessError("trailing_dot_conflict_process_proof_missing")
    if "def bare_host(" not in source or 'host.split("@")[-1]' not in source:
        raise PromotionReadinessError("scheme_less_path_not_normalised_before_conflict")
    path_proof = (root / "ops/ms-robot/test_portfolio_scheme_less_path_conflict_process.py").read_text(encoding="utf-8")
    if "test_scheme_less_path_conflicts_with_apex_before_discovery" not in path_proof:
        raise PromotionReadinessError("scheme_less_path_conflict_process_proof_missing")
    if "def strip_port(" not in source or 'host.encode("idna")' not in source:
        raise PromotionReadinessError("port_or_idna_not_normalised_before_conflict")
    port_proof = (root / "ops/ms-robot/test_portfolio_port_idna_conflict_process.py").read_text(encoding="utf-8")
    if "test_port_and_idna_conflict_with_apex_before_discovery" not in port_proof:
        raise PromotionReadinessError("port_idna_conflict_process_proof_missing")
    if "def decode_host(" not in source or "unquote(" not in source:
        raise PromotionReadinessError("percent_host_not_decoded_before_conflict")
    percent_proof = (root / "ops/ms-robot/test_portfolio_percent_host_conflict_process.py").read_text(encoding="utf-8")
    if "test_percent_encoded_host_conflicts_with_apex_before_discovery" not in percent_proof:
        raise PromotionReadinessError("percent_host_conflict_process_proof_missing")
    if 'host.startswith("[")' not in source or 'host.find("]")' not in source:
        raise PromotionReadinessError("ipv6_bracket_port_not_normalised_before_conflict")
    ipv6_proof = (root / "ops/ms-robot/test_portfolio_ipv6_port_conflict_process.py").read_text(encoding="utf-8")
    if "test_ipv6_bracket_port_conflicts_with_url_host_before_discovery" not in ipv6_proof:
        raise PromotionReadinessError("ipv6_port_conflict_process_proof_missing")
    if "def assert_hostname(" not in source:
        raise PromotionReadinessError("decoded_host_residue_not_rejected")
    residue_proof = (root / "ops/ms-robot/test_portfolio_decoded_host_residue_process.py").read_text(encoding="utf-8")
    if "test_decoded_scheme_and_path_exit_before_discovery" not in residue_proof:
        raise PromotionReadinessError("decoded_host_residue_process_proof_missing")
    puny_proof = (root / "ops/ms-robot/test_portfolio_punycode_conflict_process.py").read_text(encoding="utf-8")
    if "test_unicode_and_punycode_conflict_before_discovery" not in puny_proof:
        raise PromotionReadinessError("punycode_conflict_process_proof_missing")
    if 'host.startswith(".")' not in source or '".." in host' not in source:
        raise PromotionReadinessError("empty_label_host_not_rejected")
    empty_proof = (root / "ops/ms-robot/test_portfolio_empty_label_host_process.py").read_text(encoding="utf-8")
    if "test_empty_label_hosts_exit_before_discovery" not in empty_proof:
        raise PromotionReadinessError("empty_label_host_process_proof_missing")
    if "ord(char) < 32" not in source or "ord(char) == 127" not in source:
        raise PromotionReadinessError("control_host_not_rejected")
    control_proof = (root / "ops/ms-robot/test_portfolio_control_host_process.py").read_text(encoding="utf-8")
    if "test_control_and_nbsp_hosts_exit_before_discovery" not in control_proof:
        raise PromotionReadinessError("control_host_process_proof_missing")
    if "def canonical_ip(" not in source or "ipv4_mapped" not in source:
        raise PromotionReadinessError("ipv4_mapped_host_not_normalised_before_conflict")
    mapped_proof = (root / "ops/ms-robot/test_portfolio_ipv4_mapped_conflict_process.py").read_text(encoding="utf-8")
    if "test_ipv4_mapped_host_conflicts_with_dotted_before_discovery" not in mapped_proof:
        raise PromotionReadinessError("ipv4_mapped_conflict_process_proof_missing")
    if "def integer_ipv4(" not in source or 'lower.startswith("0x")' not in source:
        raise PromotionReadinessError("ipv4_dword_host_not_normalised_before_conflict")
    dword_proof = (root / "ops/ms-robot/test_portfolio_ipv4_dword_conflict_process.py").read_text(encoding="utf-8")
    if "test_ipv4_dword_and_hex_conflict_with_dotted_before_discovery" not in dword_proof:
        raise PromotionReadinessError("ipv4_dword_conflict_process_proof_missing")
    if "more than one gsc property" not in source or "property_url=authorised[site][0]" not in source:
        raise PromotionReadinessError("ambiguous_gsc_property_not_fail_closed")
    property_proof = (root / "ops/ms-robot/test_portfolio_ambiguous_property_process.py").read_text(encoding="utf-8")
    if "test_ambiguous_gsc_properties_exit_before_sync" not in property_proof:
        raise PromotionReadinessError("ambiguous_gsc_property_process_proof_missing")
    if "gsc discovery payload" not in source:
        raise PromotionReadinessError("gsc_discovery_payload_not_fail_closed")
    discovery_proof = (root / "ops/ms-robot/test_portfolio_discovery_payload_process.py").read_text(encoding="utf-8")
    if "test_malformed_discovery_exits_before_sync" not in discovery_proof:
        raise PromotionReadinessError("gsc_discovery_payload_process_proof_missing")

    if "test_authorised_property_url_is_synced" not in property_proof:
        raise PromotionReadinessError("authorised_property_url_proof_missing")
    return ["scheduled_portfolio_map_fail_closed", "non_string_project_id_fail_closed", "reserved_project_scope_fail_closed", "whitespace_project_id_fail_closed", "padded_project_id_stripped_before_discovery", "www_apex_conflict_fail_closed", "trailing_dot_conflict_fail_closed", "scheme_less_path_conflict_fail_closed", "port_idna_conflict_fail_closed", "percent_host_conflict_fail_closed", "ipv6_port_conflict_fail_closed", "decoded_host_residue_fail_closed", "punycode_unicode_conflict_fail_closed", "empty_label_host_fail_closed", "control_host_fail_closed", "ipv4_mapped_conflict_fail_closed", "ipv4_dword_conflict_fail_closed", "ambiguous_gsc_property_fail_closed", "gsc_discovery_payload_fail_closed"]



# Pinned heads inspected 2026-10-02. Content markers, not a merge.
REQUIRED_UPSTREAM_HEADS = {
    "pr4_aax132": "0b914518350ae0ff4293887aaaaaa5aea96b92fc",
    "pr5_aax111": "63988c96676e6a5be675b13dec5e94c2e7f06548",
}


def check_upstream_tree_reconciliation(root: Path) -> list[str]:
    """Fail closed if the integration tree drops PR #4 or PR #5 launch fixes.

    This does not merge those branches. It only requires the shared SQLite
    coordinator and the worker-bound ClickUp claim to still be present.
    """
    coordinator = root / "ops/analytics-gateway/sqlite_migrations.py"
    coordinator_tests = root / "ops/analytics-gateway/test_sqlite_migrations.py"
    claims = root / "src/lib/server/query-builders.ts"
    for path in (coordinator, coordinator_tests, claims):
        if not path.is_file():
            raise PromotionReadinessError("upstream_tree_missing:" + path.name)
    source = coordinator.read_text(encoding="utf-8")
    for marker in (
        'LEGACY_PROJECT_ID = "legacy"',
        'WRITE_LOCK = "IMMEDIATE"',
        "PRAGMA busy_timeout=",
        "ambiguous_legacy_schema:",
    ):
        if marker not in source:
            raise PromotionReadinessError("pr4_sqlite_coordinator_missing:" + marker)
    proofs = coordinator_tests.read_text(encoding="utf-8")
    for name in (
        "test_concurrent_gateway_and_monitor_migrate_legacy_once",
        "test_ambiguous_unscoped_and_shadow_fail_closed",
        "test_busy_deadline_is_controlled_failure",
    ):
        if name not in proofs:
            raise PromotionReadinessError("pr4_sqlite_process_proof_missing:" + name)
    claim_source = claims.read_text(encoding="utf-8")
    if "export function buildClickUpClaimQuery" not in claim_source or "claimId: string" not in claim_source:
        raise PromotionReadinessError("pr5_clickup_claim_binding_missing")
    if "clickup_task_id = $1" not in claim_source or "previous" not in claim_source:
        raise PromotionReadinessError("pr5_clickup_claim_compare_missing")
    return [
        "pr4_sqlite_coordinator_present:" + REQUIRED_UPSTREAM_HEADS["pr4_aax132"],
        "pr5_clickup_claim_bound:" + REQUIRED_UPSTREAM_HEADS["pr5_aax111"],
    ]



def check_sqlite_coordinator_skips_postgres_0008(root: Path) -> list[str]:
    """SQLite startup must not apply PostgreSQL migration 0008.

    0008 is the PR #5 seo_data_cache identity index. The analytics coordinator
    builds its own SQLite tables and must not execute migrations/*.sql.
    """
    source = (root / "ops/analytics-gateway/sqlite_migrations.py").read_text(encoding="utf-8")
    if "POSTGRESQL_MIGRATIONS_APPLIED_BY_COORDINATOR = ()" not in source:
        raise PromotionReadinessError("sqlite_coordinator_postgres_boundary_missing")
    if "seo_data_cache" in source or "0008_seo_data_cache_identity.sql" in source:
        raise PromotionReadinessError("sqlite_coordinator_applies_postgres_0008")
    proof = (root / "ops/analytics-gateway/test_sqlite_migrations.py").read_text(encoding="utf-8")
    if "test_sqlite_coordinator_does_not_apply_postgres_0008" not in proof:
        raise PromotionReadinessError("sqlite_0008_non_application_proof_missing")
    return ["sqlite_coordinator_does_not_apply_postgres_0008"]


def assess(root: Path | None = None) -> dict:
    root = repo_root_from(root)
    checks = []
    checks.extend(check_migrations(root))
    checks.extend(check_medical_note_gate(root))
    checks.extend(check_portfolio_map_gate(root))
    checks.extend(check_provider_retry_gate(root))
    checks.extend(check_client_note_order_gate(root))
    checks.extend(check_journal_warning_copy_gate(root))
    checks.extend(check_upstream_tree_reconciliation(root))
    checks.extend(check_sqlite_coordinator_skips_postgres_0008(root))
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
