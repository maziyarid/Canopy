import json
import tempfile
import unittest
from pathlib import Path

from promotion_readiness import PromotionReadinessError, assess, check_client_note_order_gate, check_journal_warning_copy_gate, check_portfolio_map_gate, check_sqlite_coordinator_skips_postgres_0008, check_upstream_tree_reconciliation, check_migrations, check_main_privacy_reconciliation


REQUIRED = {
    "0006_provider_sync_ledger.sql": "alter table provider_sync_runs add column if not exists quota_state text;\n",
    "0007_provider_sync_project_idempotency.sql": "create unique index provider_sync_runs_idem on provider_sync_runs(project_id, idempotency_key);\n",
    "0008_seo_data_cache_identity.sql": "-- does not collide with PR #4\ncreate unique index seo_data_cache_identity_idx on seo_data_cache(project_id);\n",
    "0009_privacy_data_domain.sql": "select 1;\n",
    "0010_report_section_grants.sql": "select 1;\n",
    "0011_report_insights.sql": "select 1;\n",
}


def write_tree(root: Path, insight: str, portfolio: str):
    (root / "migrations").mkdir()
    (root / "ops/analytics-gateway").mkdir(parents=True)
    (root / "src/lib/server").mkdir(parents=True)
    for name, body in REQUIRED.items():
        (root / "migrations" / name).write_text(body, encoding="utf-8")
    (root / "src/lib/server/insight-persistence.ts").write_text(insight, encoding="utf-8")
    (root / "ops/analytics-gateway/portfolio_gsc.py").write_text(portfolio, encoding="utf-8")


class PromotionReadinessTest(unittest.TestCase):
    def test_current_integration_tree_is_not_promotable(self):
        report = assess(Path(__file__).resolve().parents[2])
        self.assertFalse(report["promotionAuthorised"])
        self.assertEqual(report["status"], "not_promotable")
        self.assertFalse(report["scheduledPortfolioSyncEnabled"])
        self.assertIn("medical_manual_notes_fail_closed", report["checks"])
        self.assertIn("scheduled_portfolio_map_fail_closed", report["checks"])
        self.assertIn("whitespace_project_id_fail_closed", report["checks"])
        self.assertIn("trailing_dot_conflict_fail_closed", report["checks"])
        self.assertIn("port_idna_conflict_fail_closed", report["checks"])
        self.assertIn("percent_host_conflict_fail_closed", report["checks"])
        self.assertIn("ipv6_port_conflict_fail_closed", report["checks"])
        self.assertIn("ipv4_mapped_conflict_fail_closed", report["checks"])
        self.assertIn("ipv4_dword_conflict_fail_closed", report["checks"])
        self.assertIn("ambiguous_gsc_property_fail_closed", report["checks"])
        self.assertIn("gsc_discovery_payload_fail_closed", report["checks"])
        self.assertTrue(any("site-to-project" in gate for gate in report["humanGates"]))

    def test_missing_migration_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_tree(
                root,
                'if (access.project.data_domain === "medical") throw new Error("Manual notes are unavailable for this project");\n'
                'if (access.project.data_domain === "medical") throw new Error("Manual notes are unavailable for this project");\n',
                'raise SystemExit("MS_ROBOT_PROJECT_SITE_MAP_JSON is required")\n"gsc_property_not_authorised"\n',
            )
            (root / "migrations/0011_report_insights.sql").unlink()
            with self.assertRaises(PromotionReadinessError) as caught:
                check_migrations(root)
            self.assertIn("missing_migrations", str(caught.exception))

    def test_duplicate_migration_number_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_tree(
                root,
                'data_domain === "medical"\ndata_domain === "medical"\nManual notes are unavailable for this project\n',
                'MS_ROBOT_PROJECT_SITE_MAP_JSON is required\ngsc_property_not_authorised\n',
            )
            (root / "migrations/0011_report_insights_copy.sql").write_text("select 1;\n", encoding="utf-8")
            with self.assertRaises(PromotionReadinessError) as caught:
                check_migrations(root)
            self.assertIn("duplicate_migration_numbers", str(caught.exception))

    def test_client_note_limit_before_filter_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_tree(
                root,
                "order by generated_at desc,id asc limit ${pageSize}\n"
                "payload::json->>'visibility'='client' and payload::json->>'reviewState'='approved'\n",
                "MS_ROBOT_PROJECT_SITE_MAP_JSON is required\ngsc_property_not_authorised\n",
            )
            with self.assertRaises(PromotionReadinessError) as caught:
                check_client_note_order_gate(root)
            self.assertIn("client_note_limit_precedes_approval_filter", str(caught.exception))

    def test_silent_note_cap_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_tree(
                root,
                "payload::json->>'visibility'='client' and payload::json->>'reviewState'='approved'\n"
                "order by generated_at desc,id asc limit ${pageSize}\n",
                "MS_ROBOT_PROJECT_SITE_MAP_JSON is required\ngsc_property_not_authorised\n",
            )
            with self.assertRaises(PromotionReadinessError) as caught:
                check_client_note_order_gate(root)
            self.assertIn("client_note_truncation_not_explicit", str(caught.exception))

    def test_report_is_json_serialisable(self):
        json.dumps(assess(Path(__file__).resolve().parents[2]))

    def test_client_report_without_warnings_slot_does_not_invent_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src/lib/server").mkdir(parents=True)
            (root / "src/lib/server/insight-journal-mount.ts").write_text(
                "options.truncated\nShowing the newest visible notes only. Older notes are omitted.\n",
                encoding="utf-8",
            )
            (root / "src/lib/server/reporting-snapshot.ts").write_text(
                "truncated: noteWindow.truncated\n",
                encoding="utf-8",
            )
            (root / "src/lib/server/client-report-view.ts").write_text(
                "export type ClientReportView = {\n  sections: ClientSectionView[];\n};\n",
                encoding="utf-8",
            )
            checks = check_journal_warning_copy_gate(root)
            self.assertIn("journal_truncation_warning_mounted", checks)

    def test_invented_client_warnings_slot_must_copy_journal_truncation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src/lib/server").mkdir(parents=True)
            (root / "src/lib/server/insight-journal-mount.ts").write_text(
                "options.truncated\nShowing the newest visible notes only. Older notes are omitted.\n",
                encoding="utf-8",
            )
            (root / "src/lib/server/reporting-snapshot.ts").write_text(
                "truncated: noteWindow.truncated\n",
                encoding="utf-8",
            )
            (root / "src/lib/server/client-report-view.ts").write_text(
                "export type ClientReportView = {\n  warnings: string[];\n};\n",
                encoding="utf-8",
            )
            with self.assertRaises(PromotionReadinessError) as caught:
                check_journal_warning_copy_gate(root)
            self.assertIn("client_report_warnings_drop_journal_truncation", str(caught.exception))



    def test_upstream_reconciliation_fails_closed_without_sqlite_coordinator(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "ops/analytics-gateway").mkdir(parents=True)
            (root / "src/lib/server").mkdir(parents=True)
            (root / "ops/analytics-gateway/sqlite_migrations.py").write_text("WRITE_LOCK = \"DEFERRED\"\n", encoding="utf-8")
            (root / "ops/analytics-gateway/test_sqlite_migrations.py").write_text("", encoding="utf-8")
            (root / "src/lib/server/query-builders.ts").write_text("export function buildClickUpClaimQuery\n", encoding="utf-8")
            with self.assertRaises(PromotionReadinessError) as caught:
                check_upstream_tree_reconciliation(root)
            self.assertIn("pr4_sqlite_coordinator_missing", str(caught.exception))

    def test_pr5_migration_renumbered_onto_pr4_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_tree(root, "x", "y")
            swapped = (root / "migrations/0008_seo_data_cache_identity.sql").read_text(encoding="utf-8")
            (root / "migrations/0006_provider_sync_ledger.sql").write_text(
                (root / "migrations/0006_provider_sync_ledger.sql").read_text(encoding="utf-8") + swapped,
                encoding="utf-8",
            )
            with self.assertRaises(PromotionReadinessError) as caught:
                check_migrations(root)
            self.assertIn("migration_0008_renumbered_onto_pr4", str(caught.exception))


    def test_ipv6_port_conflict_proof_missing_fails_closed(self):
        repo = Path(__file__).resolve().parents[2]
        proofs = [
            "ops/analytics-gateway/portfolio_gsc.py",
            "ops/ms-robot/test_portfolio_invalid_project_id_process.py",
            "ops/ms-robot/test_portfolio_padded_project_id_process.py",
            "ops/ms-robot/test_portfolio_www_site_conflict_process.py",
            "ops/ms-robot/test_portfolio_trailing_dot_site_conflict_process.py",
            "ops/ms-robot/test_portfolio_scheme_less_path_conflict_process.py",
            "ops/ms-robot/test_portfolio_port_idna_conflict_process.py",
            "ops/ms-robot/test_portfolio_percent_host_conflict_process.py",
            "ops/ms-robot/test_portfolio_ipv6_port_conflict_process.py",
        ]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for rel in proofs:
                dest = root / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                body = (repo / rel).read_text(encoding="utf-8")
                if rel.endswith("test_portfolio_ipv6_port_conflict_process.py"):
                    body = body.replace(
                        "test_ipv6_bracket_port_conflicts_with_url_host_before_discovery",
                        "removed_ipv6_proof",
                    )
                dest.write_text(body, encoding="utf-8")
            with self.assertRaises(PromotionReadinessError) as caught:
                check_portfolio_map_gate(root)
            self.assertIn("ipv6_port_conflict_process_proof_missing", str(caught.exception))

    def test_writable_gsc_permission_gate_missing_fails_closed(self):
        repo = Path(__file__).resolve().parents[2]
        proofs = [
            "ops/analytics-gateway/portfolio_gsc.py",
            "ops/ms-robot/test_portfolio_ambiguous_property_process.py",
            "ops/ms-robot/test_portfolio_control_host_process.py",
            "ops/ms-robot/test_portfolio_decoded_host_residue_process.py",
            "ops/ms-robot/test_portfolio_discovery_payload_process.py",
            "ops/ms-robot/test_portfolio_empty_label_host_process.py",
            "ops/ms-robot/test_portfolio_invalid_project_id_process.py",
            "ops/ms-robot/test_portfolio_ipv4_dword_conflict_process.py",
            "ops/ms-robot/test_portfolio_ipv4_mapped_conflict_process.py",
            "ops/ms-robot/test_portfolio_ipv6_port_conflict_process.py",
            "ops/ms-robot/test_portfolio_padded_project_id_process.py",
            "ops/ms-robot/test_portfolio_percent_host_conflict_process.py",
            "ops/ms-robot/test_portfolio_permission_process.py",
            "ops/ms-robot/test_portfolio_port_idna_conflict_process.py",
            "ops/ms-robot/test_portfolio_punycode_conflict_process.py",
            "ops/ms-robot/test_portfolio_scheme_less_path_conflict_process.py",
            "ops/ms-robot/test_portfolio_trailing_dot_site_conflict_process.py",
            "ops/ms-robot/test_portfolio_www_site_conflict_process.py",
        ]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for rel in proofs:
                dest = root / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                body = (repo / rel).read_text(encoding="utf-8")
                if rel.endswith("portfolio_gsc.py"):
                    body = body.replace("WRITABLE_GSC_PERMISSIONS", "REMOVED_GSC_PERMISSIONS")
                dest.write_text(body, encoding="utf-8")
            with self.assertRaises(PromotionReadinessError) as caught:
                check_portfolio_map_gate(root)
            self.assertIn("writable_gsc_permissions_gate_missing", str(caught.exception))

    def test_sqlite_coordinator_applying_0008_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "ops/analytics-gateway").mkdir(parents=True)
            (root / "ops/analytics-gateway/sqlite_migrations.py").write_text(
                "POSTGRESQL_MIGRATIONS_APPLIED_BY_COORDINATOR = ()\nseo_data_cache\n",
                encoding="utf-8",
            )
            (root / "ops/analytics-gateway/test_sqlite_migrations.py").write_text(
                "def test_sqlite_coordinator_does_not_apply_postgres_0008():\n    pass\n",
                encoding="utf-8",
            )
            with self.assertRaises(PromotionReadinessError) as caught:
                check_sqlite_coordinator_skips_postgres_0008(root)
            self.assertIn("sqlite_coordinator_applies_postgres_0008", str(caught.exception))


    def test_mapped_restricted_permission_proof_missing_fails_closed(self):
        repo = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gateway = root / "ops/analytics-gateway"
            gateway.mkdir(parents=True)
            (gateway / "portfolio_gsc.py").write_text(
                (repo / "ops/analytics-gateway/portfolio_gsc.py").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            tests = root / "ops/ms-robot"
            tests.mkdir(parents=True)
            for source in (repo / "ops/ms-robot").glob("test_portfolio_*process.py"):
                body = source.read_text(encoding="utf-8")
                if source.name == "test_portfolio_permission_process.py":
                    body = body.replace("test_mapped_restricted_permission_exits_before_sync", "removed_mapped_permission_proof")
                (tests / source.name).write_text(body, encoding="utf-8")
            with self.assertRaises(PromotionReadinessError) as caught:
                check_portfolio_map_gate(root)
            self.assertIn("writable_gsc_permission_process_proof_missing", str(caught.exception))
    def test_main_privacy_markers_required(self):
        root = Path(__file__).resolve().parents[2]
        checks = check_main_privacy_reconciliation(root)
        self.assertIn("main_privacy_isolation_markers_present:7138ac36f320dd230576b27bd26bbbc461cabe74", checks)
        report = assess(root)
        self.assertIn("main_privacy_isolation_markers_present:7138ac36f320dd230576b27bd26bbbc461cabe74", report["checks"])
        self.assertFalse(report["promotionAuthorised"])

    def test_unrelated_with_ambient_calls_do_not_satisfy_privacy_gate(self):
        repo = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            workspace = root / "src/components"
            workspace.mkdir(parents=True)
            (workspace / "workspace.tsx").write_text(
                "function withAmbient(payload) { return payload; }\n"
                "addSeeds({ data: withAmbient({ projectId }) });\n"
                "scoreKeywords({ data: withAmbient({ projectId }) });\n",
                encoding="utf-8",
            )
            gateway_dir = root / "src/lib/analytics"
            gateway_dir.mkdir(parents=True)
            (gateway_dir / "gateway.server.ts").write_text(
                (repo / "src/lib/analytics/gateway.server.ts").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            (gateway_dir / "gateway.server.test.ts").write_text(
                (repo / "src/lib/analytics/gateway.server.test.ts").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            with self.assertRaises(PromotionReadinessError) as caught:
                check_main_privacy_reconciliation(root)
            self.assertIn("aax55_workspace_ambient_forward_missing", str(caught.exception))
            (workspace / "workspace.tsx").write_text(
                (repo / "src/components/workspace.tsx").read_text(encoding="utf-8").replace(
                    "pushMonday({", "pushMondayDropped({", 1
                ),
                encoding="utf-8",
            )
            with self.assertRaises(PromotionReadinessError) as monday:
                check_main_privacy_reconciliation(root)
            self.assertIn("aax55_monday_ambient_forward_missing", str(monday.exception))

if __name__ == "__main__":
    unittest.main()
