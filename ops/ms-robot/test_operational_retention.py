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
            self.assertEqual(set(plan), {"action", "executed", "dataDomain", "mode", "candidateRows", "medicalRetentionActivated"})

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

    def test_none_empty_and_whitespace_only_domain_fail_closed(self):
        for domain in ("", "   ", "\t", "medical "):
            with self.assertRaises(RetentionRefused) as caught:
                plan_operational_retention(data_domain=domain, mode="dry-run", candidate_rows=1)
            self.assertEqual(str(caught.exception), "retention_refused_domain")

    def test_non_string_domain_and_mode_fail_closed(self):
        with self.assertRaises(RetentionRefused) as caught:
            plan_operational_retention(data_domain=None, mode="dry-run", candidate_rows=1)
        self.assertEqual(str(caught.exception), "retention_refused_domain")
        with self.assertRaises(RetentionRefused) as caught:
            plan_operational_retention(data_domain="other", mode=None, candidate_rows=1)
        self.assertEqual(str(caught.exception), "retention_execution_disabled")

    def test_non_ascii_domains_fail_closed(self):
        for domain in ("thesis\u200b", "\u200bother", "thesis\u0000", "other\ufeff", "ｔｈｅｓｉｓ", "tеsis"):
            with self.assertRaises(RetentionRefused) as caught:
                plan_operational_retention(data_domain=domain, mode="dry-run", candidate_rows=1)
            self.assertEqual(str(caught.exception), "retention_refused_domain")

    def test_excessive_candidate_rows_fail_closed(self):
        with self.assertRaises(RetentionRefused) as caught:
            plan_operational_retention(data_domain="thesis", mode="dry-run", candidate_rows=1_000_001)
        self.assertEqual(str(caught.exception), "retention_row_count_invalid")
        # Boundary is accepted.
        plan = plan_operational_retention(data_domain="other", mode="dry-run", candidate_rows=1_000_000)
        self.assertEqual(plan["candidateRows"], 1_000_000)
        self.assertFalse(plan["executed"])

    def test_control_characters_in_domain_and_mode_fail_closed(self):
        for bad in ("thesis\x00", "other\x1f", "thesis\x7f", "\x01other"):
            with self.assertRaises(RetentionRefused) as caught:
                plan_operational_retention(data_domain=bad, mode="dry-run", candidate_rows=1)
            self.assertEqual(str(caught.exception), "retention_refused_domain")
        for bad in ("dry-run\x00", "dry-run\x1f", "dry\x7f-run"):
            with self.assertRaises(RetentionRefused) as caught:
                plan_operational_retention(data_domain="other", mode=bad, candidate_rows=1)
            self.assertEqual(str(caught.exception), "retention_execution_disabled")

    def test_excessive_length_domain_and_mode_fail_closed(self):
        long_domain = "x" * 65
        with self.assertRaises(RetentionRefused) as caught:
            plan_operational_retention(data_domain=long_domain, mode="dry-run", candidate_rows=1)
        self.assertEqual(str(caught.exception), "retention_refused_domain")
        long_mode = "y" * 33
        with self.assertRaises(RetentionRefused) as caught:
            plan_operational_retention(data_domain="other", mode=long_mode, candidate_rows=1)
        self.assertEqual(str(caught.exception), "retention_execution_disabled")
        plan = plan_operational_retention(data_domain="  other  ", mode="dry-run", candidate_rows=0)
        self.assertEqual(plan["dataDomain"], "other")
        self.assertFalse(plan["executed"])

if __name__ == "__main__":
    unittest.main()
