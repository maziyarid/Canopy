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

    def test_none_empty_and_whitespace_only_domain_fail_closed(self):
        for domain in (None, "", "   ", "\t", "medical "):
            with self.assertRaises(RetentionRefused) as caught:
                plan_operational_retention(data_domain=domain, mode="dry-run", candidate_rows=1)
            self.assertEqual(str(caught.exception), "retention_refused_domain")

    def test_non_integer_and_negative_counts_fail_closed(self):
        for rows in (None, 1.5, "3", -5, False):
            with self.assertRaises(RetentionRefused) as caught:
                plan_operational_retention(data_domain="other", mode="dry-run", candidate_rows=rows)
            self.assertIn("retention_row_count_invalid", str(caught.exception))

    def test_mixed_case_medical_and_operational_domains(self):
        with self.assertRaises(RetentionRefused) as caught:
            plan_operational_retention(data_domain="Medical", mode="dry-run", candidate_rows=1)
        self.assertEqual(str(caught.exception), "retention_refused_domain")
        with self.assertRaises(RetentionRefused) as caught:
            plan_operational_retention(data_domain="MEDICAL", mode="dry-run", candidate_rows=1)
        self.assertEqual(str(caught.exception), "retention_refused_domain")
        plan = plan_operational_retention(data_domain="THESIS", mode="dry-run", candidate_rows=4)
        self.assertEqual(plan["dataDomain"], "thesis")
        self.assertFalse(plan["executed"])

    def test_whitespace_padded_mode_is_normalised_then_refused_or_accepted(self):
        # Padded dry-run is accepted after strip; padded execute is refused.
        plan = plan_operational_retention(data_domain="other", mode="  dry-run  ", candidate_rows=2)
        self.assertEqual(plan["mode"], "dry-run")
        self.assertFalse(plan["executed"])
        with self.assertRaises(RetentionRefused) as caught:
            plan_operational_retention(data_domain="other", mode="  execute  ", candidate_rows=1)
        self.assertEqual(str(caught.exception), "retention_execution_disabled")


    def test_fullwidth_and_confusable_domains_fail_closed(self):
        # Fullwidth ASCII and Cyrillic lookalikes must not be accepted as operational domains.
        for domain in ("ＴＨＥＳＩＳ", "ｔｈｅｓｉｓ", "tеsis", "ОТHER"):
            with self.assertRaises(RetentionRefused) as caught:
                plan_operational_retention(data_domain=domain, mode="dry-run", candidate_rows=1)
            self.assertEqual(str(caught.exception), "retention_refused_domain")


    def test_confusable_mode_and_zero_count_are_handled(self):
        # Fullwidth, lookalike and spaced modes must not be accepted as dry-run.
        for mode in ("ｄｒｙ－ｒｕｎ", "dry—run", "dry run", "DRY-RUN\u200b"):
            with self.assertRaises(RetentionRefused) as caught:
                plan_operational_retention(data_domain="other", mode=mode, candidate_rows=1)
            self.assertEqual(str(caught.exception), "retention_execution_disabled")
        # Zero rows is a valid inert dry-run.
        plan = plan_operational_retention(data_domain="thesis", mode="dry-run", candidate_rows=0)
        self.assertFalse(plan["executed"])
        self.assertEqual(plan["action"], "none")
        self.assertEqual(plan["candidateRows"], 0)
        self.assertFalse(plan["medicalRetentionActivated"])

if __name__ == "__main__":
    unittest.main()
