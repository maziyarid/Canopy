import unittest
from snapshot_window_provenance import SnapshotWindowRefused, classify_snapshot_window


VALID = {
    "projectId": "proj-1",
    "boundProjectId": "proj-1",
    "startDate": "2026-09-01",
    "endDate": "2026-09-07",
    "requestedStartDate": "2026-09-01",
    "requestedEndDate": "2026-09-07",
    "metrics": ["sessions"],
    "reportingRouteEnabled": False,
}


class SnapshotWindowProvenanceTest(unittest.TestCase):
    def test_matching_window_stays_route_disabled(self):
        result = classify_snapshot_window(VALID, mode="inspect")
        self.assertFalse(result["clientReady"])
        self.assertFalse(result["reportingRouteEnabled"])
        self.assertEqual(result["action"], "none")
        self.assertEqual(result["startDate"], "2026-09-01")
        self.assertEqual(result["endDate"], "2026-09-07")

    def test_primary_row_total_revenue_camel_alias_absent_from_metrics_is_refused(self):
        snapshot = dict(VALID)
        snapshot["metrics"] = ["sessions"]
        snapshot["rows"] = [{"date": "2026-09-03", "metrics": ["sessions"], "totalRevenue": 12}]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_row_monetary_not_declared")
        self.assertFalse(classify_snapshot_window(dict(VALID), mode="inspect")["reportingRouteEnabled"])
        self.assertFalse(classify_snapshot_window(dict(VALID), mode="inspect")["clientReady"])


if __name__ == "__main__":
    unittest.main()
