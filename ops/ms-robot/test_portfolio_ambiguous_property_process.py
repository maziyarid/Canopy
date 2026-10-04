"""Process proof that two GSC properties for one host fail closed before sync."""

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

AMBIGUOUS_CHILD = r"""
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
    raise AssertionError("create_or_run_sync must not run for ambiguous properties")

def discovery(_path):
    return {"sites": [
        {"siteUrl": "sc-domain:example.com", "permissionLevel": "siteOwner"},
        {"siteUrl": "https://example.com/", "permissionLevel": "siteOwner"},
    ]}

portfolio_gsc.create_or_run_sync = refuse_sync
portfolio_gsc.google_request = discovery

code = 0
try:
    portfolio_gsc.main()
except SystemExit as exc:
    code = exc.code
print("RESULT " + json.dumps({"code": code, "called": called}))
"""

PROPERTY_URL_CHILD = r"""
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

seen = {"site": None}

def record_sync(project_id, provider, site, window, started):
    seen["site"] = site
    return {"status": "completed", "rows_written": 0, "error_class": None}, True

def discovery(_path):
    return {"sites": [{"siteUrl": "sc-domain:example.com", "permissionLevel": "siteOwner"}]}

def no_monitor(*_args, **_kwargs):
    return {"activeSignals": [], "resolvedSignals": [], "checkedAt": "t", "sites": 0, "created": 0, "updated": 0, "resolved": 0}

portfolio_gsc.create_or_run_sync = record_sync
portfolio_gsc.google_request = discovery
portfolio_gsc.run_monitor = no_monitor

code = 0
try:
    portfolio_gsc.main()
except SystemExit as exc:
    code = exc.code
print("RESULT " + json.dumps({"code": code, "site": seen["site"]}))
"""


class PortfolioAmbiguousPropertyProcessTest(unittest.TestCase):
    def test_ambiguous_gsc_properties_exit_before_sync(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["GATEWAY"] = str(GATEWAY)
            env["MSROBOT"] = str(MS_ROBOT)
            env["DB"] = str(Path(tmp) / "state.sqlite3")
            env["ANALYTICS_GATEWAY_DB"] = env["DB"]
            completed = subprocess.run(
                [sys.executable, "-c", AMBIGUOUS_CHILD],
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
                payload = json.loads(line[len("RESULT "):])
            elif line.startswith("{"):
                checkpoint = json.loads(line)
        self.assertIsNotNone(payload, completed.stdout + completed.stderr)
        self.assertEqual(payload["called"]["sync"], 0)
        self.assertEqual(payload["code"], 1)
        self.assertEqual(checkpoint["error"], "site_map_invalid")
        self.assertFalse(checkpoint["retryCheckpoint"]["retryable"])
        self.assertNotIn("sc-domain:", checkpoint["detail"])
        self.assertNotIn("https://", checkpoint["detail"])

    def test_authorised_property_url_is_synced(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["GATEWAY"] = str(GATEWAY)
            env["MSROBOT"] = str(MS_ROBOT)
            env["DB"] = str(Path(tmp) / "state.sqlite3")
            env["ANALYTICS_GATEWAY_DB"] = env["DB"]
            completed = subprocess.run(
                [sys.executable, "-c", PROPERTY_URL_CHILD],
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
        self.assertEqual(payload["site"], "sc-domain:example.com")
        self.assertEqual(payload["code"], 0)


if __name__ == "__main__":
    unittest.main()
