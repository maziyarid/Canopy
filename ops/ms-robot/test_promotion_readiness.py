import json
import tempfile
import unittest
from pathlib import Path

from promotion_readiness import PromotionReadinessError, assess, check_client_note_order_gate, check_journal_warning_copy_gate, check_upstream_tree_reconciliation, check_migrations


REQUIRED = {
    "0006_provider_sync_ledger.sql": "select 1;\n",
    "0007_provider_sync_project_idempotency.sql": "select 1;\n",
    "0008_seo_data_cache_identity.sql": "select 1;\n",
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

if __name__ == "__main__":
    unittest.main()
