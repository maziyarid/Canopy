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

    def test_enable_mode_is_refused(self):
        with self.assertRaises(Ga4MeasurementProvenanceRefused) as caught:
            classify_ga4_measurement(observed(), mode="enable")
        self.assertEqual(caught.exception.code, "ga4_measurement_reporting_disabled")


if __name__ == "__main__":
    unittest.main()
