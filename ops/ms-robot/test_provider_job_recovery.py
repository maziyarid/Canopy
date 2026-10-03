import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from provider_job_recovery import record_attempt_failure, record_running, recover_stale_running
from provider_retry_checkpoint import SCHEDULED_PORTFOLIO_SYNC_ENABLED


class ProviderJobRecoveryTest(unittest.TestCase):
    def test_stale_running_job_is_recovered_once_and_not_scheduled(self):
        self.assertFalse(SCHEDULED_PORTFOLIO_SYNC_ENABLED)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "jobs.sqlite"
            started = datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc)
            record_running(path, "job-1", "gsc", "project-a", attempt=1, now=started)
            record_attempt_failure(path, "job-1", "timeout", now=started)
            fresh = recover_stale_running(path, now=started + timedelta(seconds=10), error_class="site_map_missing")
            self.assertEqual(fresh, [])
            recovered = recover_stale_running(
                path,
                now=started + timedelta(seconds=120),
                error_class="timeout",
            )
            self.assertEqual(len(recovered), 1)
            self.assertEqual(recovered[0]["stage"], "retry_wait")
            self.assertEqual(recovered[0]["error_class"], "timeout")
            self.assertEqual(recovered[0]["attempt"], 1)
            again = recover_stale_running(
                path,
                now=started + timedelta(seconds=180),
                error_class="timeout",
            )
            self.assertEqual(again, [])

    def test_fail_closed_class_is_not_retried_after_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "jobs.sqlite"
            started = datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc)
            record_running(path, "job-2", "gsc", "project-a", attempt=1, now=started)
            record_attempt_failure(path, "job-2", "site_map_missing", now=started)
            recovered = recover_stale_running(
                path,
                now=started + timedelta(seconds=120),
                error_class="timeout",
            )
            self.assertEqual(recovered[0]["stage"], "failed_closed")
            self.assertFalse(recovered[0]["id"] == "")
            second = recover_stale_running(
                path,
                now=started + timedelta(seconds=240),
                error_class="site_map_missing",
            )
            self.assertEqual(second, [])

    def test_attempt_bound_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "jobs.sqlite"
            started = datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc)
            record_running(path, "job-3", "ga4", "project-b", attempt=3, now=started)
            record_attempt_failure(path, "job-3", "rate_limited", now=started)
            recovered = recover_stale_running(
                path,
                now=started + timedelta(seconds=120),
                error_class="timeout",
            )
            self.assertEqual(recovered[0]["stage"], "failed_closed")
            self.assertEqual(recovered[0]["attempt"], 3)


    def test_recovery_uses_persisted_class_not_caller_default(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "jobs.sqlite"
            started = datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc)
            record_running(path, "job-4", "gsc", "project-a", attempt=1, now=started)
            record_attempt_failure(path, "job-4", "gsc_property_not_authorised", now=started)
            recovered = recover_stale_running(
                path,
                now=started + timedelta(seconds=120),
                error_class="timeout",
            )
            self.assertEqual(recovered[0]["stage"], "failed_closed")
            self.assertEqual(recovered[0]["error_class"], "gsc_property_not_authorised")

    def test_missing_persisted_class_fails_closed_as_unknown(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "jobs.sqlite"
            started = datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc)
            record_running(path, "job-5", "gsc", "project-a", attempt=1, now=started)
            recovered = recover_stale_running(
                path,
                now=started + timedelta(seconds=120),
                error_class="timeout",
            )
            self.assertEqual(recovered[0]["stage"], "failed_closed")
            self.assertEqual(recovered[0]["error_class"], "unknown")


if __name__ == "__main__":
    unittest.main()
