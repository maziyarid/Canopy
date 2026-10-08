"""AAX-81 snapshot window and currency refusal proofs.

These tests do not enable /api/v1/reporting/snapshot and do not call a provider.
"""
from __future__ import annotations

import unittest
from pathlib import Path

from snapshot_window_provenance import SnapshotWindowRefused, classify_snapshot_window


def base(**overrides):
    snapshot = {
        "projectId": "proj-1",
        "boundProjectId": "proj-1",
        "startDate": "2026-09-01",
        "endDate": "2026-09-07",
        "requestedStartDate": "2026-09-01",
        "requestedEndDate": "2026-09-07",
        "metrics": ["sessions"],
        "reportingRouteEnabled": False,
    }
    snapshot.update(overrides)
    return snapshot


def comparison(**overrides):
    snapshot = base(
        comparisonStartDate="2026-08-01",
        comparisonEndDate="2026-08-07",
        comparisonRequestedStartDate="2026-08-01",
        comparisonRequestedEndDate="2026-08-07",
        comparisonMetrics=["sessions"],
    )
    snapshot.update(overrides)
    return snapshot


class SnapshotWindowProvenanceTests(unittest.TestCase):
    def test_requested_window_mismatch_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(base(requestedEndDate="2026-09-08"))
        self.assertEqual(raised.exception.code, "snapshot_window_mismatch")

    def test_monetary_currency_omitted_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(base(metrics=["purchaseRevenue"]))
        self.assertEqual(raised.exception.code, "snapshot_currency_mismatch")

    def test_comparison_currency_mismatch_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(comparison(
                metrics=["purchaseRevenue"],
                comparisonMetrics=["purchaseRevenue"],
                requestedCurrency="USD",
                currencyCode="USD",
                comparisonCurrency="EUR",
            ))
        self.assertEqual(raised.exception.code, "snapshot_comparison_currency_mismatch")

    def test_comparison_row_outside_window_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(comparison(comparisonRows=[{"date": "2026-09-01", "metrics": ["sessions"]}]))
        self.assertEqual(raised.exception.code, "snapshot_comparison_row_outside_window")

    def test_comparison_row_metric_not_declared_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(comparison(comparisonRows=[{"date": "2026-08-02", "metrics": ["bounceRate"]}]))
        self.assertEqual(raised.exception.code, "snapshot_comparison_row_metric_not_declared")

    def test_comparison_row_duplicate_metric_alias_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(comparison(comparisonRows=[{"date": "2026-08-02", "metrics": ["sessions", "Sessions"]}]))
        self.assertEqual(raised.exception.code, "snapshot_comparison_row_metric_duplicate")

    def test_primary_row_duplicate_metric_alias_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(base(rows=[{"date": "2026-09-02", "metrics": ["sessions", "Sessions"]}]))
        self.assertEqual(raised.exception.code, "snapshot_row_metric_duplicate")

    def test_primary_row_metric_not_declared_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(base(rows=[{"date": "2026-09-02", "metrics": ["bounceRate"]}]))
        self.assertEqual(raised.exception.code, "snapshot_row_metric_not_declared")

    def test_primary_metric_duplicate_alias_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(base(metrics=["sessions", "Sessions"]))
        self.assertEqual(raised.exception.code, "snapshot_metric_duplicate")

    def test_comparison_metric_duplicate_alias_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(comparison(comparisonMetrics=["sessions", "Sessions"]))
        self.assertEqual(raised.exception.code, "snapshot_comparison_metric_duplicate")

    def test_empty_declared_metric_list_with_row_metrics_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(base(metrics=[], rows=[{"date": "2026-09-02", "metrics": ["sessions"]}]))
        self.assertEqual(raised.exception.code, "snapshot_metric_set_empty")

    def test_empty_comparison_metric_list_with_row_metrics_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(comparison(comparisonMetrics=[], comparisonRows=[{"date": "2026-08-02", "metrics": ["sessions"]}]))
        self.assertEqual(raised.exception.code, "snapshot_comparison_metric_set_empty")

    def test_blank_only_declared_metric_list_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(base(metrics=["   "]))
        self.assertEqual(raised.exception.code, "snapshot_metric_blank")

    def test_blank_only_comparison_metric_list_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(comparison(comparisonMetrics=["   "]))
        self.assertEqual(raised.exception.code, "snapshot_comparison_metric_blank")

    def test_blank_declared_metric_mixed_with_real_metric_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(base(metrics=["sessions", " "]))
        self.assertEqual(raised.exception.code, "snapshot_metric_blank")

    def test_blank_comparison_metric_mixed_with_real_metric_is_refused(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(comparison(comparisonMetrics=["sessions", " "]))
        self.assertEqual(raised.exception.code, "snapshot_comparison_metric_blank")

    def test_padded_primary_window_does_not_hide_identical_comparison(self):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(base(
                comparisonStartDate=" 2026-09-01 ",
                comparisonEndDate="2026-09-07",
                comparisonRequestedStartDate="2026-09-01",
                comparisonRequestedEndDate="2026-09-07",
            ))
        self.assertEqual(raised.exception.code, "snapshot_comparison_window_not_distinct")

    def _hidden_primary(self, field):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(base(rows=[{"date": "2026-09-02", "metrics": ["sessions"], field: 12}]))
        self.assertEqual(raised.exception.code, "snapshot_row_monetary_not_declared")

    def _hidden_comparison(self, field):
        with self.assertRaises(SnapshotWindowRefused) as raised:
            classify_snapshot_window(comparison(comparisonRows=[{"date": "2026-08-02", "metrics": ["sessions"], field: 12}]))
        self.assertEqual(raised.exception.code, "snapshot_comparison_row_monetary_not_declared")

    def test_comparison_row_monetary_field_absent_from_comparison_metrics_is_refused(self):
        self._hidden_comparison("purchaseRevenue")

    def test_primary_row_monetary_field_absent_from_metrics_is_refused(self):
        self._hidden_primary("purchaseRevenue")

    def test_primary_row_total_revenue_hyphen_alias_absent_from_metrics_is_refused(self):
        self._hidden_primary("total-revenue")

    def test_primary_row_monetary_alias_absent_from_metrics_is_refused(self):
        self._hidden_primary("purchaseRevenue")

    def test_comparison_row_monetary_alias_absent_from_comparison_metrics_is_refused(self):
        self._hidden_comparison("purchaseRevenue")

    def test_comparison_row_total_revenue_alias_absent_from_comparison_metrics_is_refused(self):
        self._hidden_comparison("totalRevenue")

    def test_comparison_row_total_revenue_hyphen_alias_absent_from_comparison_metrics_is_refused(self):
        self._hidden_comparison("total-revenue")

    def test_primary_row_total_revenue_alias_absent_from_metrics_is_refused(self):
        self._hidden_primary("totalRevenue")

    def test_primary_row_total_revenue_camel_alias_absent_from_metrics_is_refused(self):
        self._hidden_primary("totalRevenue")

    def test_comparison_row_total_revenue_camel_alias_absent_from_comparison_metrics_is_refused(self):
        self._hidden_comparison("totalRevenue")

    def test_comparison_row_advertiser_ad_cost_camel_alias_absent_from_comparison_metrics_is_refused(self):
        self._hidden_comparison("advertiserAdCost")

    def test_comparison_row_advertiser_ad_cost_snake_alias_absent_from_comparison_metrics_is_refused(self):
        self._hidden_comparison("advertiser_ad_cost")

    def test_comparison_row_advertiser_ad_cost_hyphen_alias_absent_from_comparison_metrics_is_refused(self):
        self._hidden_comparison("advertiser-ad-cost")

    def test_comparison_row_advertiser_ad_cost_spaced_alias_absent_from_comparison_metrics_is_refused(self):
        self._hidden_comparison("advertiser ad cost")

    def test_primary_row_advertiser_ad_cost_camel_alias_absent_from_metrics_is_refused(self):
        self._hidden_primary("advertiserAdCost")

    def test_primary_row_advertiser_ad_cost_snake_alias_absent_from_metrics_is_refused(self):
        self._hidden_primary("advertiser_ad_cost")

    def test_primary_row_advertiser_ad_cost_hyphen_alias_absent_from_metrics_is_refused(self):
        self._hidden_primary("advertiser-ad-cost")

    def test_primary_row_advertiser_ad_cost_spaced_alias_absent_from_metrics_is_refused(self):
        self._hidden_primary("advertiser ad cost")

    def test_primary_row_advertiser_ad_cost_mixed_alias_absent_from_metrics_is_refused(self):
        self._hidden_primary("advertiserAd_cost")

    def test_module_does_not_enable_route(self):
        source = Path(__file__).with_name("snapshot_window_provenance.py").read_text(encoding="utf-8")
        self.assertNotIn("urllib", source.lower())
        plan = classify_snapshot_window(base())
        self.assertFalse(plan["clientReady"])
        self.assertFalse(plan["reportingRouteEnabled"])


if __name__ == "__main__":
    unittest.main()
