"""Process proof: an unauthorised GSC property stays non-retryable across restarts.

A second portfolio process with the same site map and database must still
exit 1, keep attempt 1, and never call create_or_run_sync. Discovery may run
again; that does not requeue the refusal.
"""

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

CHILD = r"""
import json
import os
import sys

sys.path.insert(0, os.environ["GATEWAY"])
sys.path.insert(0, os.environ["MSROBOT"])
os.environ["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = json.dumps({"example.com": "project-a"})
os.environ["ANALYTICS_GATEWAY_DB"] = os.environ["DB"]

import portfolio_gsc

called = {"sync": 0, "google": 0}

def refuse_sync(*_args, **_kwargs):
    called["sync"] += 1
    raise AssertionError("create_or_run_sync must not run for an unauthorised property")

def discovery(*_args, **_kwargs):
    called["google"] += 1
    return {"sites": [{"siteUrl": "sc-domain:other.example"}]}

portfolio_gsc.create_or_run_sync = refuse_sync
portfolio_gsc.google_request = discovery

code = 0
try:
    portfolio_gsc.main()
except SystemExit as exc:
    code = exc.code
print("RESULT " + json.dumps({"code": code, "called": called}))
"""


def _run(db_path: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = json.dumps({"example.com": "project-a"})
    env["GATEWAY"] = str(GATEWAY)
    env["MSROBOT"] = str(MS_ROBOT)
    env["DB"] = str(db_path)
    env["ANALYTICS_GATEWAY_DB"] = env["DB"]
    return subprocess.run(
        [sys.executable, "-c", CHILD],
        cwd=db_path.parent,
        env=env,
        text=True,
        capture_output=True,
        timeout=30,
        check=False,
    )


def _parse(completed: subprocess.CompletedProcess[str]) -> tuple[dict, dict]:
    payload = None
    checkpoint = None
    for line in completed.stdout.splitlines():
        if line.startswith("RESULT "):
            payload = json.loads(line.removeprefix("RESULT "))
        elif line.startswith("{"):
            checkpoint = json.loads(line)
    return payload, checkpoint


class PortfolioUnauthorisedPropertyNotRetriedProcessTest(unittest.TestCase):
    def test_second_process_still_fails_closed_without_sync(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "state.sqlite3"
            first = _run(db_path)
            second = _run(db_path)
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(second.returncode, 0, second.stderr)
        for completed in (first, second):
            payload, checkpoint = _parse(completed)
            self.assertIsNotNone(payload, completed.stdout + completed.stderr)
            self.assertIsNotNone(checkpoint, completed.stdout + completed.stderr)
            self.assertEqual(payload["code"], 1)
            self.assertEqual(payload["called"]["sync"], 0)
            self.assertEqual(payload["called"]["google"], 1)
            refusal = checkpoint["unavailable"][0]
            self.assertEqual(refusal["error"], "gsc_property_not_authorised")
            self.assertEqual(refusal["retryCheckpoint"]["attempt"], 1)
            self.assertFalse(refusal["retryCheckpoint"]["retryable"])
            self.assertEqual(refusal["retryCheckpoint"]["stage"], "failed_closed")
            self.assertEqual(refusal["retryCheckpoint"]["errorClass"], "gsc_property_not_authorised")
            self.assertFalse(refusal["retryCheckpoint"]["scheduledPortfolioSyncEnabled"])
            self.assertEqual(checkpoint["runs"], [])


if __name__ == "__main__":
    unittest.main()
