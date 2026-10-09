#!/usr/bin/env python3
import unittest

from ga4_measurement_provenance import (
    Ga4MeasurementProvenanceRefused,
    classify_ga4_measurement,
)


def observed():
    return {
        "property": "properties/123",
        "responseProperty": "properties/123",
        "qualityFlags": ["observed"],
        "samplingMetadatas": [],
        "subjectToThresholding": False,
        "sourceRef": "ga4:properties/123:run-1",
        "clientReportingEnabled": False,
        "scheduledSyncEnabled": False,
    }


class Ga4MeasurementProvenanceTests(unittest.TestCase):
    def test_observed_row_stays_inert(self):
        plan = classify_ga4_measurement(observed())
        self.assertFalse(plan["clientReady"])
        self.assertFalse(plan["providerReady"])
        self.assertFalse(plan["scheduledSyncEnabled"])
        self.assertFalse(plan["clientReportingEnabled"])
        self.assertEqual(plan["action"], "none")
        self.assertTrue(plan["observed"])

    def test_sampling_metadata_is_refused(self):
        row = observed()
        row["samplingMetadatas"] = [{"samplesReadCount": "1"}]
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(row)
        self.assertEqual(caught.exception.code, "ga4_measurement_not_observed")

    def test_thresholding_is_refused(self):
        row = observed()
        row["subjectToThresholding"] = True
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(row)
        self.assertEqual(caught.exception.code, "ga4_measurement_not_observed")

    def test_response_property_mismatch_is_refused(self):
        row = observed()
        row["responseProperty"] = "properties/999"
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(row)
        self.assertEqual(caught.exception.code, "ga4_measurement_property_mismatch")

    def test_omitted_quality_is_refused(self):
        row = observed()
        del row["samplingMetadatas"]
        del row["subjectToThresholding"]
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(row)
        self.assertEqual(caught.exception.code, "ga4_measurement_quality_unspecified")

    def test_data_loss_and_currency_mismatch_are_refused(self):
        loss = observed()
        loss["dataLossFromOtherRow"] = True
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(loss)
        self.assertEqual(caught.exception.code, "ga4_measurement_not_observed")
        currency = observed()
        currency["requestedCurrency"] = "USD"
        currency["currencyCode"] = "EUR"
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(currency)
        self.assertEqual(caught.exception.code, "ga4_measurement_currency_mismatch")

    def test_blank_or_non_iso_currency_is_refused(self):
        blank = observed()
        blank["currencyCode"] = "  "
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(blank)
        self.assertEqual(caught.exception.code, "ga4_measurement_currency_invalid")
        non_iso = observed()
        non_iso["currencyCode"] = "US"
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(non_iso)
        self.assertEqual(caught.exception.code, "ga4_measurement_currency_invalid")
        self.assertFalse(classify_ga4_measurement(observed())["clientReady"])
        self.assertFalse(classify_ga4_measurement(observed())["clientReportingEnabled"])

    def test_nfkc_confusable_currency_is_refused(self):
        row = observed()
        row["currencyCode"] = "\uff35\uff33\uff24"
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(row)
        self.assertEqual(caught.exception.code, "ga4_measurement_currency_confusable")
        requested = observed()
        requested["requestedCurrency"] = "\uff35\uff33\uff24"
        requested["currencyCode"] = "USD"
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(requested)
        self.assertEqual(caught.exception.code, "ga4_measurement_currency_confusable")
        self.assertFalse(classify_ga4_measurement(observed())["clientReady"])
        self.assertFalse(classify_ga4_measurement(observed())["scheduledSyncEnabled"])
        self.assertFalse(classify_ga4_measurement(observed())["clientReportingEnabled"])

    def test_narrower_response_date_range_is_refused(self):
        narrower = observed()
        narrower["requestedStartDate"] = "2026-09-01"
        narrower["requestedEndDate"] = "2026-09-30"
        narrower["responseStartDate"] = "2026-09-02"
        narrower["responseEndDate"] = "2026-09-30"
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(narrower)
        self.assertEqual(caught.exception.code, "ga4_measurement_date_range_incomplete")
        early_end = observed()
        early_end["requestedStartDate"] = "2026-09-01"
        early_end["requestedEndDate"] = "2026-09-30"
        early_end["responseStartDate"] = "2026-09-01"
        early_end["responseEndDate"] = "2026-09-29"
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(early_end)
        self.assertEqual(caught.exception.code, "ga4_measurement_date_range_incomplete")
        invalid = observed()
        invalid["requestedStartDate"] = "2026-02-31"
        invalid["requestedEndDate"] = "2026-09-30"
        invalid["responseStartDate"] = "2026-02-31"
        invalid["responseEndDate"] = "2026-09-30"
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(invalid)
        self.assertEqual(caught.exception.code, "ga4_measurement_date_range_invalid")
        covered = observed()
        covered["requestedStartDate"] = "2026-09-01"
        covered["requestedEndDate"] = "2026-09-30"
        covered["responseStartDate"] = "2026-09-01"
        covered["responseEndDate"] = "2026-09-30"
        plan = classify_ga4_measurement(covered)
        self.assertFalse(plan["clientReady"])
        self.assertFalse(plan["providerReady"])
        self.assertFalse(plan["scheduledSyncEnabled"])
        self.assertFalse(plan["clientReportingEnabled"])

    def test_wider_response_date_range_is_refused(self):
        earlier = observed()
        earlier["requestedStartDate"] = "2026-09-01"
        earlier["requestedEndDate"] = "2026-09-30"
        earlier["responseStartDate"] = "2026-08-31"
        earlier["responseEndDate"] = "2026-09-30"
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(earlier)
        self.assertEqual(caught.exception.code, "ga4_measurement_date_range_wider")
        later = observed()
        later["requestedStartDate"] = "2026-09-01"
        later["requestedEndDate"] = "2026-09-30"
        later["responseStartDate"] = "2026-09-01"
        later["responseEndDate"] = "2026-10-01"
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(later)
        self.assertEqual(caught.exception.code, "ga4_measurement_date_range_wider")
        self.assertFalse(classify_ga4_measurement(observed())["clientReady"])
        self.assertFalse(classify_ga4_measurement(observed())["scheduledSyncEnabled"])
        self.assertFalse(classify_ga4_measurement(observed())["clientReportingEnabled"])

    def test_enable_mode_is_refused(self):
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(observed(), mode="enable")
        self.assertEqual(caught.exception.code, "ga4_measurement_reporting_disabled")


if __name__ == "__main__":
    unittest.main()
