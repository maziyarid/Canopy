import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent
os.environ.setdefault("ANALYTICS_GATEWAY_DB", str(ROOT / ".retry-attempt-reset.sqlite3"))

import gateway


class RetryAttemptResetTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self.tmp.name) / "state.sqlite3")
        self.db_patch = patch.object(gateway, "DB", self.db_path)
        self.db_patch.start()
        gateway.init_db()

    def tearDown(self):
        self.db_patch.stop()
        self.tmp.cleanup()

    def insert_run(self, run_id, status, started_at, site="example.com", window="28d"):
        with gateway.db() as c:
            c.execute(
                """insert into sync_run(
                     id,project_id,provider,site,window,status,idempotency_key,code_version,started_at)
                   values(?,?,?,?,?,?,?,?,?)""",
                (
                    run_id,
                    "project-a",
                    "gsc",
                    site,
                    window,
                    status,
                    f"key-{run_id}",
                    "test",
                    started_at,
                ),
            )

    def fail_once(self, key, started):
        with patch.object(gateway, "sync_provider", side_effect=RuntimeError("google_provider_unreachable:timeout")):
            row, created = gateway.create_or_run_sync(
                "project-a", "gsc", "example.com", "28d", started, request_key=key
            )
        self.assertTrue(created)
        return row["retry_checkpoint"]

    def test_success_resets_historical_failure_budget(self):
        for index in range(3):
            self.insert_run(f"old-{index}", "error", f"2026-09-01T00:00:0{index}Z")
        self.insert_run("ok", "completed", "2026-09-02T00:00:00Z")
        checkpoint = self.fail_once("fresh", "2026-09-03T00:00:00Z")
        self.assertEqual(checkpoint["attempt"], 1)
        self.assertEqual(checkpoint["stage"], "retry_wait")
        self.assertTrue(checkpoint["retryable"])
        self.assertEqual(checkpoint["errorClass"], "timeout")

    def test_third_failure_after_success_still_closes(self):
        self.insert_run("ok", "completed", "2026-09-02T00:00:00Z")
        first = self.fail_once("a", "2026-09-03T00:00:01Z")
        second = self.fail_once("b", "2026-09-03T00:00:02Z")
        third = self.fail_once("c", "2026-09-03T00:00:03Z")
        self.assertEqual(first["attempt"], 1)
        self.assertTrue(first["retryable"])
        self.assertEqual(second["attempt"], 2)
        self.assertTrue(second["retryable"])
        self.assertEqual(third["attempt"], 3)
        self.assertEqual(third["stage"], "failed_closed")
        self.assertFalse(third["retryable"])

    def test_later_success_does_not_drop_earlier_overlapping_failure(self):
        self.insert_run("later-ok", "completed", "2026-09-03T00:00:05Z")
        checkpoint = self.fail_once("earlier", "2026-09-03T00:00:01Z")
        self.assertEqual(checkpoint["attempt"], 1)
        self.assertEqual(checkpoint["stage"], "retry_wait")
        self.assertTrue(checkpoint["retryable"])
        self.assertEqual(checkpoint["errorClass"], "timeout")
        self.assertFalse(checkpoint["scheduledPortfolioSyncEnabled"])


    def test_reverse_finish_order_still_exhausts_overlapping_budget(self):
        self.insert_run("started-last", "error", "2026-09-03T00:00:03Z")
        self.insert_run("started-middle", "error", "2026-09-03T00:00:02Z")
        checkpoint = self.fail_once("started-first", "2026-09-03T00:00:01Z")
        self.assertEqual(checkpoint["attempt"], 3)
        self.assertEqual(checkpoint["stage"], "failed_closed")
        self.assertFalse(checkpoint["retryable"])

    def test_later_success_hides_only_post_success_failures_from_earlier_run(self):
        self.insert_run("later-ok", "completed", "2026-09-03T00:00:05Z")
        self.insert_run("after-success", "error", "2026-09-03T00:00:06Z")
        checkpoint = self.fail_once("earlier", "2026-09-03T00:00:01Z")
        self.assertEqual(checkpoint["attempt"], 1)
        self.assertTrue(checkpoint["retryable"])

    def test_other_site_failures_do_not_consume_budget(self):
        self.insert_run("other", "error", "2026-09-03T00:00:00Z", site="other.example")
        checkpoint = self.fail_once("mine", "2026-09-03T00:00:01Z")
        self.assertEqual(checkpoint["attempt"], 1)
        self.assertTrue(checkpoint["retryable"])


if __name__ == "__main__":
    unittest.main()
