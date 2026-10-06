import unittest

from ga4_property_binding import Ga4BindingRefused, classify_ga4_binding


BOUND = {
    "projectId": "proj-1",
    "boundProjectId": "proj-1",
    "site": "example.com",
    "boundSite": "example.com",
    "property": "properties/123",
    "boundProperty": "properties/123",
    "authorisedRead": True,
    "scheduledSyncEnabled": False,
    "clientReportingEnabled": False,
}


class Ga4PropertyBindingTest(unittest.TestCase):
    def test_bound_property_stays_inert(self):
        plan = classify_ga4_binding(BOUND, mode="inspect")
        self.assertFalse(plan["providerReady"])
        self.assertFalse(plan["scheduledSyncEnabled"])
        self.assertFalse(plan["clientReportingEnabled"])
        self.assertEqual(plan["action"], "none")
        self.assertEqual(plan["property"], "properties/123")

    def test_enable_mode_is_refused(self):
        with self.assertRaises(Ga4BindingRefused) as raised:
            classify_ga4_binding(BOUND, mode="sync")
        self.assertEqual(raised.exception.code, "ga4_sync_disabled")

    def test_numeric_property_is_refused(self):
        binding = dict(BOUND, property="123", boundProperty="123")
        with self.assertRaises(Ga4BindingRefused) as raised:
            classify_ga4_binding(binding)
        self.assertEqual(raised.exception.code, "ga4_property_unbound")

    def test_mismatched_property_is_refused(self):
        binding = dict(BOUND, boundProperty="properties/999")
        with self.assertRaises(Ga4BindingRefused) as raised:
            classify_ga4_binding(binding)
        self.assertEqual(raised.exception.code, "ga4_property_unbound")

    def test_missing_authorised_read_is_refused(self):
        binding = dict(BOUND, authorisedRead=False)
        with self.assertRaises(Ga4BindingRefused) as raised:
            classify_ga4_binding(binding)
        self.assertEqual(raised.exception.code, "ga4_authorised_read_missing")


if __name__ == "__main__":
    unittest.main()
