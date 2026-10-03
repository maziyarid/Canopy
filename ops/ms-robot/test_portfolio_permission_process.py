"""Process proof that a non-owner GSC permission fails closed before sync."""

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
os.environ["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = json.dumps({
    "secret-host.example": "project-a",
    "example.com": 12,
})
os.environ["ANALYTICS_GATEWAY_DB"] = os.environ["DB"]

import portfolio_gsc

called = {"sync": 0, "google": 0}

def refuse_sync(*_args, **_kwargs):
    called["sync"] += 1
    raise AssertionError("create_or_run_sync must not run")

def refuse_google(_path):
    called["google"] += 1
    raise AssertionError("discovery must not run for a non-string project id")

portfolio_gsc.create_or_run_sync = refuse_sync
portfolio_gsc.google_request = refuse_google

code = 0
try:
    portfolio_gsc.main()
except SystemExit as exc:
    code = exc.code
print("RESULT " + json.dumps({"code": code, "called": called}))
"""

RESTRICTED = r"""
import json
import os
import sys

sys.path.insert(0, os.environ["GATEWAY"])
sys.path.insert(0, os.environ["MSROBOT"])
os.environ["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = json.dumps({
    "example.com": "project-a",
})
os.environ["ANALYTICS_GATEWAY_DB"] = os.environ["DB"]

import portfolio_gsc

called = {"sync": 0}

def refuse_sync(*_args, **_kwargs):
    called["sync"] += 1
    raise AssertionError("create_or_run_sync must not run for a restricted property")

def discovery(_path):
    return {"sites": [{
        "siteUrl": "https://secret-property.example/",
        "permissionLevel": "siteRestrictedUser",
    }]}

portfolio_gsc.create_or_run_sync = refuse_sync
portfolio_gsc.google_request = discovery

code = 0
try:
    portfolio_gsc.main()
except SystemExit as exc:
    code = exc.code
print("RESULT " + json.dumps({"code": code, "called": called}))
"""


class PortfolioPermissionProcessTests(unittest.TestCase):
    def _run(self, child):
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env.update({
                "GATEWAY": str(GATEWAY),
                "MSROBOT": str(MS_ROBOT),
                "DB": str(Path(tmp) / "state.sqlite3"),
                "PYTHONPATH": f"{GATEWAY}{os.pathsep}{MS_ROBOT}",
            })
            return subprocess.run(
                [sys.executable, "-c", child],
                cwd=str(GATEWAY),
                env=env,
                capture_output=True,
                text=True,
                timeout=30,
            )

    def test_non_string_project_id_does_not_echo_raw_key(self):
        proc = self._run(CHILD)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertNotIn("secret-host.example", proc.stdout)
        line = next(line for line in proc.stdout.splitlines() if line.startswith("RESULT "))
        result = json.loads(line.removeprefix("RESULT "))
        self.assertEqual(result["code"], 1)
        self.assertEqual(result["called"]["google"], 0)
        self.assertEqual(result["called"]["sync"], 0)
        payload = json.loads(proc.stdout.split("RESULT ", 1)[0].strip().splitlines()[-1])
        self.assertEqual(payload["error"], "site_map_invalid")
        self.assertFalse(payload["retryCheckpoint"]["retryable"])

    def test_restricted_permission_exits_before_sync(self):
        proc = self._run(RESTRICTED)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertNotIn("secret-property.example", proc.stdout)
        line = next(line for line in proc.stdout.splitlines() if line.startswith("RESULT "))
        result = json.loads(line.removeprefix("RESULT "))
        self.assertEqual(result["code"], 1)
        self.assertEqual(result["called"]["sync"], 0)
        payload = json.loads(proc.stdout.split("RESULT ", 1)[0].strip().splitlines()[-1])
        self.assertEqual(payload["unavailable"][0]["error"], "gsc_property_not_authorised")
        self.assertFalse(payload["unavailable"][0]["retryCheckpoint"]["retryable"])
        self.assertNotIn("secret-property.example", payload["unavailable"][0]["site"])


if __name__ == "__main__":
    unittest.main()
