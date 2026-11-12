"""Behavioral proofs for AAX-80 client gate early-return (non-colliding)."""

import unittest

from client_reporting_gate import client_gate_decision


class TestClientReportingGate(unittest.TestCase):
    def test_client_denied_when_not_configured(self):
        decision = client_gate_decision(reporting_configured=False, role="client", project_id="p1")
        self.assertFalse(decision["allowed"])
        self.assertEqual(decision["reason"], "reporting_not_configured")
        self.assertFalse(decision["read_data"])

    def test_client_allowed_when_configured(self):
        decision = client_gate_decision(reporting_configured=True, role="client", project_id="p1")
        self.assertTrue(decision["allowed"])
        self.assertTrue(decision["read_data"])
        self.assertIsNone(decision["reason"])

    def test_owner_proceeds_even_if_not_configured(self):
        decision = client_gate_decision(reporting_configured=False, role="owner", project_id="p1")
        self.assertTrue(decision["allowed"])
        self.assertTrue(decision["read_data"])

    def test_editor_proceeds_even_if_not_configured(self):
        decision = client_gate_decision(reporting_configured=False, role="editor", project_id="p1")
        self.assertTrue(decision["allowed"])

    def test_never_enables_reporting(self):
        for role in ("client", "owner", "editor"):
            decision = client_gate_decision(False, role)
            self.assertNotIn("clientReportingEnabled", decision)
            self.assertFalse(decision.get("scheduledSyncEnabled", False))


if __name__ == "__main__":
    unittest.main()
