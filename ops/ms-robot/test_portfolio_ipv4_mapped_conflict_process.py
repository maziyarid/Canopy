"""Process-level proof that IPv4-mapped and leading-zero hosts conflict before discovery."""

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

IPV4_MAPPED_CONFLICT_CHILD = r"""
import json
import os
import sys

sys.path.insert(0, os.environ["GATEWAY"])
sys.path.insert(0, os.environ["MSROBOT"])
os.environ["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = json.dumps({
    "https://[::ffff:192.0.2.1]/": "project-a",
    "192.000.002.001": "project-b",
})
os.environ["ANALYTICS_GATEWAY_DB"] = os.environ["DB"]

import portfolio_gsc

called = {"sync": 0, "google": 0}

def refuse_sync(*_args, **_kwargs):
    called["sync"] += 1
    raise AssertionError("create_or_run_sync must not run for an IPv4-mapped site map")

def refuse_google(*_args, **_kwargs):
    called["google"] += 1
    raise AssertionError("google_request must not run for an IPv4-mapped site map")

portfolio_gsc.create_or_run_sync = refuse_sync
portfolio_gsc.google_request = refuse_google

code = 0
try:
    portfolio_gsc.main()
except SystemExit as exc:
    code = exc.code
print("RESULT " + json.dumps({"code": code, "called": called}))
"""


class PortfolioIpv4MappedConflictProcessTest(unittest.TestCase):
    def test_ipv4_mapped_host_conflicts_with_dotted_before_discovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = json.dumps({
                "https://[::ffff:192.0.2.1]/": "project-a",
                "192.000.002.001": "project-b",
            })
            env["GATEWAY"] = str(GATEWAY)
            env["MSROBOT"] = str(MS_ROBOT)
            env["DB"] = str(Path(tmp) / "state.sqlite3")
            env["ANALYTICS_GATEWAY_DB"] = env["DB"]
            completed = subprocess.run(
                [sys.executable, "-c", IPV4_MAPPED_CONFLICT_CHILD],
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
        self.assertIsNotNone(payload, completed.stdout + completed.stderr)
        self.assertEqual(payload["code"], 1)
        self.assertEqual(payload["called"], {"sync": 0, "google": 0})
        self.assertIn("more than one project", completed.stdout + completed.stderr)
        self.assertNotIn("192.000.002.001", completed.stdout + completed.stderr)
        self.assertNotIn("::ffff", completed.stdout + completed.stderr)


if __name__ == "__main__":
    unittest.main()
