"""Process-level proof that a decoded scheme or path is not a second site identity."""

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

DECODED_HOST_RESIDUE_CHILD = r"""
import json
import os
import sys

sys.path.insert(0, os.environ["GATEWAY"])
sys.path.insert(0, os.environ["MSROBOT"])
os.environ["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = json.dumps({
    "https%3A%2F%2Fexample.com": "project-a",
    "example.com%2Fpath": "project-b",
})
os.environ["ANALYTICS_GATEWAY_DB"] = os.environ["DB"]

import portfolio_gsc

called = {"sync": 0, "google": 0}

def refuse_sync(*_args, **_kwargs):
    called["sync"] += 1
    raise AssertionError("create_or_run_sync must not run for a decoded host residue")

def refuse_google(*_args, **_kwargs):
    called["google"] += 1
    raise AssertionError("google_request must not run for a decoded host residue")

portfolio_gsc.create_or_run_sync = refuse_sync
portfolio_gsc.google_request = refuse_google

code = 0
try:
    portfolio_gsc.main()
except SystemExit as exc:
    code = exc.code
print("RESULT " + json.dumps({"code": code, "called": called}))
"""


class PortfolioDecodedHostResidueProcessTest(unittest.TestCase):
    def test_decoded_scheme_and_path_exit_before_discovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = json.dumps({
                "https%3A%2F%2Fexample.com": "project-a",
                "example.com%2Fpath": "project-b",
            })
            env["GATEWAY"] = str(GATEWAY)
            env["MSROBOT"] = str(MS_ROBOT)
            env["DB"] = str(Path(tmp) / "state.sqlite3")
            env["ANALYTICS_GATEWAY_DB"] = env["DB"]
            completed = subprocess.run(
                [sys.executable, "-c", DECODED_HOST_RESIDUE_CHILD],
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
        self.assertIn("invalid site host", completed.stdout + completed.stderr)
        self.assertNotIn("example.com/path", completed.stdout + completed.stderr)
        self.assertNotIn("https://example.com", completed.stdout + completed.stderr)


if __name__ == "__main__":
    unittest.main()
