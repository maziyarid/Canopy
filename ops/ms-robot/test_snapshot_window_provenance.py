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

    def test_enable_mode_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(VALID, mode="serve")
        self.assertEqual(caught.exception.code, "snapshot_route_disabled")

    def test_inverted_window_is_refused(self):
        snapshot = dict(VALID)
        snapshot["endDate"] = "2026-08-01"
        snapshot["requestedEndDate"] = "2026-08-01"
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_window_inverted")

    def test_requested_window_mismatch_is_refused(self):
        snapshot = dict(VALID)
        snapshot["requestedEndDate"] = "2026-09-08"
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_window_mismatch")

    def test_omitted_requested_window_is_refused(self):
        snapshot = dict(VALID)
        snapshot["requestedStartDate"] = None
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_window_unspecified")

    def test_monetary_currency_mismatch_is_refused(self):
        snapshot = dict(VALID)
        snapshot["metrics"] = ["purchaseRevenue"]
        snapshot["requestedCurrency"] = "USD"
        snapshot["currencyCode"] = "EUR"
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_currency_mismatch")

    def test_monetary_currency_omitted_is_refused(self):
        snapshot = dict(VALID)
        snapshot["metrics"] = ["totalRevenue"]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_currency_mismatch")

    def test_impossible_calendar_date_is_refused(self):
        snapshot = dict(VALID)
        snapshot["endDate"] = "2026-02-31"
        snapshot["requestedEndDate"] = "2026-02-31"
        snapshot["startDate"] = "2026-02-01"
        snapshot["requestedStartDate"] = "2026-02-01"
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_calendar_invalid")

    def test_non_leap_february_29_is_refused(self):
        snapshot = dict(VALID)
        snapshot["endDate"] = "2026-02-29"
        snapshot["requestedEndDate"] = "2026-02-29"
        snapshot["startDate"] = "2026-02-01"
        snapshot["requestedStartDate"] = "2026-02-01"
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_calendar_invalid")

    def test_mixed_case_monetary_metric_still_requires_currency(self):
        snapshot = dict(VALID)
        snapshot["metrics"] = ["PurchaseRevenue"]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_currency_mismatch")


if __name__ == "__main__":
    unittest.main()
