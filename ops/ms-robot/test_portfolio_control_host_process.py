"""Process-level proof that control characters are not a site identity."""

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

CONTROL_HOST_CHILD = r"""
import json
import os
import sys

sys.path.insert(0, os.environ["GATEWAY"])
sys.path.insert(0, os.environ["MSROBOT"])
os.environ["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = json.dumps({
    "example.com" + chr(0): "project-a",
    "example.com\u00a0": "project-b",
})
os.environ["ANALYTICS_GATEWAY_DB"] = os.environ["DB"]

import portfolio_gsc

called = {"sync": 0, "google": 0}

def refuse_sync(*_args, **_kwargs):
    called["sync"] += 1
    raise AssertionError("create_or_run_sync must not run for a control host")

def refuse_google(*_args, **_kwargs):
    called["google"] += 1
    raise AssertionError("google_request must not run for a control host")

portfolio_gsc.create_or_run_sync = refuse_sync
portfolio_gsc.google_request = refuse_google

code = 0
try:
    portfolio_gsc.main()
except SystemExit as exc:
    code = exc.code
print("RESULT " + json.dumps({"code": code, "called": called}))
"""


class PortfolioControlHostProcessTest(unittest.TestCase):
    def test_control_and_nbsp_hosts_exit_before_discovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = json.dumps({
                "example.com\u0000": "project-a",
                "example.com\u00a0": "project-b",
            })
            env["GATEWAY"] = str(GATEWAY)
            env["MSROBOT"] = str(MS_ROBOT)
            env["DB"] = str(Path(tmp) / "state.sqlite3")
            env["ANALYTICS_GATEWAY_DB"] = env["DB"]
            completed = subprocess.run(
                [sys.executable, "-c", CONTROL_HOST_CHILD],
                cwd=tmp,
                env=env,
                text=True,
                capture_output=True,
                timeout=30,
                check=False,
            )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        payload = None
        for line in completed.stdout.splitlines():
            if line.startswith("RESULT "):
                payload = json.loads(line[len("RESULT "):])
        self.assertIsNotNone(payload, completed.stdout)
        self.assertEqual(payload["code"], 1)
        self.assertEqual(payload["called"], {"sync": 0, "google": 0})
        self.assertNotIn("example.com\\u0000", completed.stdout)
        self.assertNotIn("project-a", completed.stdout)


if __name__ == "__main__":
    unittest.main()
