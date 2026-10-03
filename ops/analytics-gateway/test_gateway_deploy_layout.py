"""Prove the documented /srv/ms-robot-analytics layout can import the gateway.

The unit file starts gateway.py from a directory that does not have a sibling
ms-robot package. The retry checkpoint module must live beside gateway.py.
"""
import os
import sys
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))


class DeployLayoutTest(unittest.TestCase):
    def test_import_without_sibling_ms_robot(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "ms-robot-analytics"
            dest.mkdir()
            for name in (
                "gateway.py",
                "gsc_monitor.py",
                "sqlite_migrations.py",
                "provider_retry_checkpoint.py",
                "monitor_dispatch.py",
            ):
                shutil.copy(HERE / name, dest / name)
            env = os.environ.copy()
            env["ANALYTICS_GATEWAY_DB"] = str(Path(tmp) / "state.sqlite3")
            env["ANALYTICS_GATEWAY_TOKEN"] = "layout-test-token"
            env.pop("PYTHONPATH", None)
            probe = (
                "import gateway; "
                "from provider_retry_checkpoint import checkpoint_for_sync_failure; "
                "print(checkpoint_for_sync_failure('google_provider_503', attempt=3)['stage'])"
            )
            result = subprocess.run(
                [sys.executable, "-c", probe],
                cwd=dest,
                env=env,
                capture_output=True,
                text=True,
                timeout=30,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("failed_closed", result.stdout)
            self.assertNotIn("ModuleNotFoundError", result.stderr)


if __name__ == "__main__":
    unittest.main()


class RetryAttemptTest(unittest.TestCase):
    def test_distinct_request_keys_advance_attempt(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = str(Path(tmp) / "state.sqlite3")
            os.environ["ANALYTICS_GATEWAY_DB"] = db
            import importlib
            import gateway
            importlib.reload(gateway)
            gateway.init_db()
            def boom(*_a, **_k):
                raise RuntimeError("google_provider_503:unavailable")
            gateway.sync_provider = boom
            stages = []
            for i in range(3):
                row, created = gateway.create_or_run_sync("proj", "gsc", "example.com", "7d", "2026-10-01T00:00:00+00:00", request_key=f"k{i}")
                self.assertTrue(created)
                stages.append(row["retry_checkpoint"])
            self.assertEqual([s["attempt"] for s in stages], [1, 2, 3])
            self.assertEqual(stages[0]["stage"], "retry_wait")
            self.assertEqual(stages[1]["stage"], "retry_wait")
            self.assertEqual(stages[2]["stage"], "failed_closed")
            self.assertFalse(stages[2]["retryable"])
            self.assertFalse(stages[2]["scheduledPortfolioSyncEnabled"])
