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



    def test_separator_metric_alias_still_requires_currency(self):
        snapshot = dict(VALID)
        snapshot["metrics"] = ["purchase_revenue"]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_currency_mismatch")

    def test_row_outside_requested_window_is_refused(self):
        snapshot = dict(VALID)
        snapshot["rows"] = [{"date": "2026-09-08", "metrics": ["sessions"]}]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_row_outside_window")

    def test_row_monetary_alias_without_currency_is_refused(self):
        snapshot = dict(VALID)
        snapshot["rows"] = [{"date": "2026-09-03", "metrics": ["total-revenue"]}]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_currency_mismatch")

    def test_comparison_currency_mismatch_is_refused(self):
        snapshot = dict(VALID)
        snapshot["metrics"] = ["purchaseRevenue"]
        snapshot["requestedCurrency"] = "USD"
        snapshot["currencyCode"] = "USD"
        snapshot["comparisonStartDate"] = "2026-08-01"
        snapshot["comparisonEndDate"] = "2026-08-07"
        snapshot["comparisonRequestedStartDate"] = "2026-08-01"
        snapshot["comparisonRequestedEndDate"] = "2026-08-07"
        snapshot["comparisonMetrics"] = ["purchase_revenue"]
        snapshot["comparisonCurrency"] = "EUR"
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_comparison_currency_mismatch")

    def test_comparison_currency_omitted_is_refused(self):
        snapshot = dict(VALID)
        snapshot["comparisonStartDate"] = "2026-08-01"
        snapshot["comparisonEndDate"] = "2026-08-07"
        snapshot["comparisonRequestedStartDate"] = "2026-08-01"
        snapshot["comparisonRequestedEndDate"] = "2026-08-07"
        snapshot["comparisonRows"] = [{"date": "2026-08-03", "metrics": ["total-revenue"]}]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_comparison_currency_mismatch")

    def test_comparison_row_outside_window_is_refused(self):
        snapshot = dict(VALID)
        snapshot["comparisonStartDate"] = "2026-08-01"
        snapshot["comparisonEndDate"] = "2026-08-07"
        snapshot["comparisonRequestedStartDate"] = "2026-08-01"
        snapshot["comparisonRequestedEndDate"] = "2026-08-07"
        snapshot["comparisonMetrics"] = ["sessions"]
        snapshot["comparisonRows"] = [{"date": "2026-09-03", "metrics": ["sessions"]}]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_comparison_row_outside_window")

    def test_comparison_row_metric_not_declared_is_refused(self):
        snapshot = dict(VALID)
        snapshot["comparisonStartDate"] = "2026-08-01"
        snapshot["comparisonEndDate"] = "2026-08-07"
        snapshot["comparisonRequestedStartDate"] = "2026-08-01"
        snapshot["comparisonRequestedEndDate"] = "2026-08-07"
        snapshot["comparisonMetrics"] = ["sessions"]
        snapshot["comparisonRows"] = [{"date": "2026-08-03", "metrics": ["sessions", "purchaseRevenue"]}]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_comparison_row_metric_not_declared")
        self.assertFalse(classify_snapshot_window(dict(VALID), mode="inspect")["reportingRouteEnabled"])



    def test_primary_row_metric_not_declared_is_refused(self):
        snapshot = dict(VALID)
        snapshot["rows"] = [{"date": "2026-09-03", "metrics": ["sessions", "engagedSessions"]}]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_row_metric_not_declared")
        self.assertFalse(classify_snapshot_window(dict(VALID), mode="inspect")["reportingRouteEnabled"])

    def test_primary_row_duplicate_metric_alias_is_refused(self):
        snapshot = dict(VALID)
        snapshot["rows"] = [{"date": "2026-09-03", "metrics": ["sessions", "Sessions"]}]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_row_metric_duplicate")
        self.assertFalse(classify_snapshot_window(dict(VALID), mode="inspect")["reportingRouteEnabled"])

    def test_comparison_row_duplicate_metric_alias_is_refused(self):
        snapshot = dict(VALID)
        snapshot["comparisonStartDate"] = "2026-08-01"
        snapshot["comparisonEndDate"] = "2026-08-07"
        snapshot["comparisonRequestedStartDate"] = "2026-08-01"
        snapshot["comparisonRequestedEndDate"] = "2026-08-07"
        snapshot["comparisonMetrics"] = ["sessions"]
        snapshot["comparisonRows"] = [{"date": "2026-08-03", "metrics": ["sessions", "Sessions"]}]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_comparison_row_metric_duplicate")
        self.assertFalse(classify_snapshot_window(dict(VALID), mode="inspect")["reportingRouteEnabled"])

    def test_comparison_row_on_window_boundary_stays_route_disabled(self):
        snapshot = dict(VALID)
        snapshot["comparisonStartDate"] = "2026-08-01"
        snapshot["comparisonEndDate"] = "2026-08-07"
        snapshot["comparisonRequestedStartDate"] = "2026-08-01"
        snapshot["comparisonRequestedEndDate"] = "2026-08-07"
        snapshot["comparisonMetrics"] = ["sessions"]
        snapshot["comparisonRows"] = [
            {"date": "2026-08-01", "metrics": ["sessions"]},
            {"date": "2026-08-07", "metrics": ["sessions"]},
        ]
        result = classify_snapshot_window(snapshot, mode="inspect")
        self.assertFalse(result["clientReady"])
        self.assertFalse(result["reportingRouteEnabled"])
        self.assertEqual(result["comparisonStartDate"], "2026-08-01")
        self.assertEqual(result["comparisonEndDate"], "2026-08-07")

    def test_matching_comparison_stays_route_disabled(self):
        snapshot = dict(VALID)
        snapshot["comparisonStartDate"] = "2026-08-01"
        snapshot["comparisonEndDate"] = "2026-08-07"
        snapshot["comparisonRequestedStartDate"] = "2026-08-01"
        snapshot["comparisonRequestedEndDate"] = "2026-08-07"
        snapshot["comparisonMetrics"] = ["sessions"]
        result = classify_snapshot_window(snapshot, mode="inspect")
        self.assertFalse(result["clientReady"])
        self.assertFalse(result["reportingRouteEnabled"])
        self.assertEqual(result["comparisonStartDate"], "2026-08-01")
        self.assertEqual(result["comparisonEndDate"], "2026-08-07")


    def test_primary_metric_duplicate_alias_is_refused(self):
        snapshot = dict(VALID)
        snapshot["metrics"] = ["sessions", "Sessions"]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_metric_duplicate")
        self.assertFalse(classify_snapshot_window(dict(VALID), mode="inspect")["reportingRouteEnabled"])

    def test_comparison_metric_duplicate_alias_is_refused(self):
        snapshot = dict(VALID)
        snapshot["comparisonStartDate"] = "2026-08-01"
        snapshot["comparisonEndDate"] = "2026-08-07"
        snapshot["comparisonRequestedStartDate"] = "2026-08-01"
        snapshot["comparisonRequestedEndDate"] = "2026-08-07"
        snapshot["comparisonMetrics"] = ["sessions", "Sessions"]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_comparison_metric_duplicate")
        self.assertFalse(classify_snapshot_window(dict(VALID), mode="inspect")["reportingRouteEnabled"])


    def test_empty_declared_metric_list_with_row_metrics_is_refused(self):
        snapshot = dict(VALID)
        snapshot["metrics"] = []
        snapshot["rows"] = [{"date": "2026-09-03", "metrics": ["sessions"]}]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_metric_set_empty")
        self.assertFalse(classify_snapshot_window(dict(VALID), mode="inspect")["reportingRouteEnabled"])

    def test_empty_comparison_metric_list_with_row_metrics_is_refused(self):
        snapshot = dict(VALID)
        snapshot["comparisonStartDate"] = "2026-08-01"
        snapshot["comparisonEndDate"] = "2026-08-07"
        snapshot["comparisonRequestedStartDate"] = "2026-08-01"
        snapshot["comparisonRequestedEndDate"] = "2026-08-07"
        snapshot["comparisonMetrics"] = []
        snapshot["comparisonRows"] = [{"date": "2026-08-03", "metrics": ["sessions"]}]
        with self.assertRaises(SnapshotWindowRefused) as caught:
            classify_snapshot_window(snapshot, mode="inspect")
        self.assertEqual(caught.exception.code, "snapshot_comparison_metric_set_empty")
        self.assertFalse(classify_snapshot_window(dict(VALID), mode="inspect")["reportingRouteEnabled"])

if __name__ == "__main__":
    unittest.main()
