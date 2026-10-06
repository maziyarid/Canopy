import unittest

from ga4_provenance_contract import (
    ProvenanceError,
    omit_landing_collisions,
    period_unique_users,
    reconcile_source_summary,
)


class Ga4ProvenanceContractTest(unittest.TestCase):
    def test_mixed_property_identity_fails_closed(self):
        rows = [
            {"source": {"provider": "ga4", "property": "properties/1", "timeZone": "UTC", "retrievedAt": "a"}},
            {"source": {"provider": "ga4", "property": "properties/2", "timeZone": "UTC", "retrievedAt": "b"}},
        ]
        with self.assertRaises(ProvenanceError):
            reconcile_source_summary(rows)

    def test_missing_provenance_is_not_backfilled(self):
        rows = [
            {"source": {"provider": "ga4", "property": "properties/1", "timeZone": "UTC", "retrievedAt": "a"}},
            {"source": None},
        ]
        self.assertIsNone(reconcile_source_summary(rows))

    def test_period_users_do_not_sum_daily_uniques(self):
        daily = [{"metrics": {"totalUsers": 4}}, {"metrics": {"totalUsers": 5}}]
        self.assertEqual(period_unique_users({"totalUsers": 7}, daily), 7)
        self.assertIsNone(period_unique_users({}, daily))

    def test_collision_group_is_fully_omitted(self):
        result = omit_landing_collisions([
            {"dimensions": {"landingPage": "/a"}, "metrics": {"sessions": 1}},
            {"dimensions": {"landingPage": "/a"}, "metrics": {"sessions": 2}},
            {"dimensions": {"landingPage": "/b"}, "metrics": {"sessions": 3}},
        ])
        self.assertEqual([row["dimensions"]["landingPage"] for row in result["rows"]], ["/b"])
        self.assertEqual(result["omittedRows"], 2)
        self.assertFalse(result["complete"])


if __name__ == "__main__":
    unittest.main()
