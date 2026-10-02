import json
import tempfile
import unittest
from pathlib import Path

from promotion_readiness import PromotionReadinessError, assess, check_client_note_order_gate, check_migrations


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


if __name__ == "__main__":
    unittest.main()
