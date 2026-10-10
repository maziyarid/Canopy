import unittest

from operational_retention import RetentionRefused, plan_operational_retention


class OperationalRetentionTest(unittest.TestCase):
    def test_dry_run_does_not_execute_for_operational_domains(self):
        for domain in ("thesis", "other"):
            plan = plan_operational_retention(data_domain=domain, mode="dry-run", candidate_rows=3)
            self.assertFalse(plan["executed"])
            self.assertEqual(plan["action"], "none")
            self.assertFalse(plan["medicalRetentionActivated"])
            self.assertEqual(plan["candidateRows"], 3)

    def test_medical_domain_is_refused(self):
        with self.assertRaises(RetentionRefused) as caught:
            plan_operational_retention(data_domain="medical", mode="dry-run", candidate_rows=1)
        self.assertEqual(str(caught.exception), "retention_refused_domain")

    def test_execute_mode_is_refused(self):
        for mode in ("execute", "apply", "delete", ""):
            with self.assertRaises(RetentionRefused) as caught:
                plan_operational_retention(data_domain="other", mode=mode, candidate_rows=1)
            self.assertEqual(str(caught.exception), "retention_execution_disabled")

    def test_unknown_domain_and_bad_count_fail_closed(self):
        with self.assertRaises(RetentionRefused):
            plan_operational_retention(data_domain="clinic", mode="dry-run", candidate_rows=1)
        with self.assertRaises(RetentionRefused):
            plan_operational_retention(data_domain="other", mode="dry-run", candidate_rows=-1)
        with self.assertRaises(RetentionRefused):
            plan_operational_retention(data_domain="other", mode="dry-run", candidate_rows=True)


if __name__ == "__main__":
    unittest.main()
