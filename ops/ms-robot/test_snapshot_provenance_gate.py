import unittest
from snapshot_provenance_gate import SnapshotProvenanceRefused, classify_snapshot


VALID = {
    "projectId": "proj-1",
    "boundProjectId": "proj-1",
    "provenance": "first_party",
    "measurementKind": "observed",
    "sourceRef": "ga4:property:1",
    "reportingRouteEnabled": False,
}


class SnapshotProvenanceGateTest(unittest.TestCase):
    def test_observed_snapshot_stays_route_disabled(self):
        result = classify_snapshot(VALID, mode="inspect")
        self.assertFalse(result["clientReady"])
        self.assertFalse(result["reportingRouteEnabled"])
        self.assertEqual(result["action"], "none")
        self.assertEqual(result["provenance"], "first_party")

    def test_enable_mode_is_refused(self):
        with self.assertRaises(SnapshotProvenanceRefused) as caught:
            classify_snapshot(VALID, mode="enable")
        self.assertEqual(caught.exception.code, "snapshot_route_disabled")

    def test_sampled_metric_is_refused(self):
        snapshot = dict(VALID)
        snapshot["measurementKind"] = "sampled"
        with self.assertRaises(SnapshotProvenanceRefused) as caught:
            classify_snapshot(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_sampled_not_client_ready")

    def test_missing_provenance_is_refused(self):
        snapshot = dict(VALID)
        snapshot["provenance"] = ""
        with self.assertRaises(SnapshotProvenanceRefused) as caught:
            classify_snapshot(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_provenance_missing")

    def test_non_ascii_modes_fail_closed(self):
        snapshot = dict(VALID)
        for mode in ("inspect\u200b", "ｉｎｓｐｅｃｔ", "inspect\ufeff", "enable\u200b"):
            with self.assertRaises(SnapshotProvenanceRefused) as caught:
                classify_snapshot(snapshot, mode=mode)
            self.assertEqual(caught.exception.code, "snapshot_mode_unknown")


if __name__ == "__main__":
    unittest.main()
