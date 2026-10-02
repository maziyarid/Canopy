"""Process proof that a padded project id is stripped before discovery."""

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

PADDED_CHILD = r"""
import json
import os
import sys

sys.path.insert(0, os.environ["GATEWAY"])
sys.path.insert(0, os.environ["MSROBOT"])
os.environ["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = os.environ["SITE_MAP"]
os.environ["ANALYTICS_GATEWAY_DB"] = os.environ["DB"]

import portfolio_gsc

seen = {"projects": [], "google": 0}

def fake_google(path, *_args, **_kwargs):
    seen["google"] += 1
    if path != "/v1/sites":
        raise AssertionError("unexpected google path " + str(path))
    return {"sites": [{"siteUrl": "https://example.com/"}]}

def fake_sync(project_id, provider, site, window, started, request_key=None):
    seen["projects"].append(project_id)
    if project_id != project_id.strip() or project_id != "project-a":
        raise AssertionError("sync received unstripped project id " + repr(project_id))
    return ({"status": "completed", "rows_written": 0, "error_class": None}, False)

def fake_monitor(*_args, **_kwargs):
    return {"checkedAt": "t", "sites": [], "activeSignals": [], "resolvedSignals": []}

portfolio_gsc.google_request = fake_google
portfolio_gsc.create_or_run_sync = fake_sync
portfolio_gsc.run_monitor = fake_monitor
portfolio_gsc.bridge_event = lambda *_args, **_kwargs: {}

code = 0
try:
    portfolio_gsc.main()
except SystemExit as exc:
    code = exc.code
print("RESULT " + json.dumps({"code": code, "seen": seen}))
"""


class PortfolioPaddedProjectIdProcessTest(unittest.TestCase):
    def test_padded_project_id_is_stripped_before_discovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["SITE_MAP"] = json.dumps({"https://example.com/": "  project-a  "})
            env["MS_ROBOT_PROJECT_SITE_MAP_JSON"] = env["SITE_MAP"]
            env["GATEWAY"] = str(GATEWAY)
            env["MSROBOT"] = str(MS_ROBOT)
            env["DB"] = str(Path(tmp) / "state.sqlite3")
            env["ANALYTICS_GATEWAY_DB"] = env["DB"]
            completed = subprocess.run(
                [sys.executable, "-c", PADDED_CHILD],
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
                payload = json.loads(line.removeprefix("RESULT "))
        self.assertIsNotNone(payload, completed.stdout + completed.stderr)
        self.assertEqual(payload["code"], 0)
        self.assertEqual(payload["seen"]["projects"], ["project-a"])
        self.assertEqual(payload["seen"]["google"], 1)
        self.assertNotIn("  project-a  ", completed.stdout)


if __name__ == "__main__":
    unittest.main()
