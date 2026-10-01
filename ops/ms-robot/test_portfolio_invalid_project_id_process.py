"""Process-level proof that an invalid mapped project id never starts GSC discovery."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "ops" / "analytics-gateway"
MS_ROBOT = ROOT / "ops" / "ms-robot"

INVALID_CHILD = r"""
import json
import os
import sys

sys.path.insert(0, os.environ["GATEWAY"])
sys.path.insert(0, os.environ["MSROBOT"])
os.environ["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = os.environ["SITE_MAP"]
os.environ["ANALYTICS_GATEWAY_DB"] = os.environ["DB"]

import portfolio_gsc

called = {"sync": 0, "google": 0}

def refuse_sync(*_args, **_kwargs):
    called["sync"] += 1
    raise AssertionError("create_or_run_sync must not run for an invalid project id")

def refuse_google(*_args, **_kwargs):
    called["google"] += 1
    raise AssertionError("google_request must not run for an invalid project id")

portfolio_gsc.create_or_run_sync = refuse_sync
portfolio_gsc.google_request = refuse_google

code = 0
try:
    portfolio_gsc.main()
except SystemExit as exc:
    code = exc.code
print("RESULT " + json.dumps({"code": code, "called": called}))
"""


class PortfolioInvalidProjectIdProcessTest(unittest.TestCase):
    def _run(self, site_map: dict) -> tuple[dict, dict]:
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["SITE_MAP"] = json.dumps(site_map)
            env["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = env["SITE_MAP"]
            env["GATEWAY"] = str(GATEWAY)
            env["MSROBOT"] = str(MS_ROBOT)
            env["DB"] = str(Path(tmp) / "state.sqlite3")
            env["ANALYTICS_GATEWAY_DB"] = env["DB"]
            completed = subprocess.run(
                [sys.executable, "-c", INVALID_CHILD],
                cwd=tmp,
                env=env,
                text=True,
                capture_output=True,
                timeout=30,
                check=False,
            )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        payload = None
        checkpoint = None
        for line in completed.stdout.splitlines():
            if line.startswith("RESULT "):
                payload = json.loads(line.removeprefix("RESULT "))
            elif line.startswith("{"):
                checkpoint = json.loads(line)
        self.assertIsNotNone(payload, completed.stdout + completed.stderr)
        self.assertIsNotNone(checkpoint, completed.stdout + completed.stderr)
        return payload, checkpoint

    def test_invalid_project_id_exits_1_without_discovery(self):
        payload, checkpoint = self._run({"https://example.com/": "../not-a-project"})
        self.assertEqual(payload["code"], 1)
        self.assertEqual(payload["called"], {"sync": 0, "google": 0})
        self.assertEqual(checkpoint["error"], "site_map_invalid")
        self.assertFalse(checkpoint["retryCheckpoint"]["retryable"])
        self.assertEqual(checkpoint["retryCheckpoint"]["errorClass"], "site_map_invalid")
        self.assertEqual(checkpoint["retryCheckpoint"]["stage"], "failed_closed")
        self.assertFalse(checkpoint["retryCheckpoint"]["scheduledPortfolioSyncEnabled"])
        self.assertIn("invalid project id", checkpoint["detail"])

    def test_empty_site_exits_1_without_discovery(self):
        payload, checkpoint = self._run({"   ": "project-a"})
        self.assertEqual(payload["code"], 1)
        self.assertEqual(payload["called"], {"sync": 0, "google": 0})
        self.assertEqual(checkpoint["error"], "site_map_invalid")
        self.assertFalse(checkpoint["retryCheckpoint"]["retryable"])
        self.assertIn("empty site", checkpoint["detail"])


if __name__ == "__main__":
    unittest.main()
