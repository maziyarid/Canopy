#!/usr/bin/env python3
import unittest
from operational_retention import RetentionRefused, normalise_domain, normalise_mode


class OperationalRetentionTests(unittest.TestCase):
    def test_valid_domain(self):
        self.assertEqual(normalise_domain("operational"), "operational")
        self.assertEqual(normalise_domain(" Medical "), "medical")

    def test_raw_control_rejected(self):
        with self.assertRaises(RetentionRefused) as cm:
            normalise_domain("operational\x00")
        self.assertEqual(cm.exception.code, "domain_control_rejected")

    def test_trailing_control_after_strip_would_pass_but_raw_rejects(self):
        # strip() would remove trailing space, but control must be rejected raw.
        with self.assertRaises(RetentionRefused):
            normalise_domain("operational\x1f")

    def test_non_ascii_rejected(self):
        with self.assertRaises(RetentionRefused):
            normalise_domain("operati\u043enal")  # Cyrillic o

    def test_valid_mode(self):
        self.assertEqual(normalise_mode("dry-run"), "dry-run")

    def test_mode_control_rejected(self):
        with self.assertRaises(RetentionRefused) as cm:
            normalise_mode("inspect\x7f")
        self.assertEqual(cm.exception.code, "mode_control_rejected")


if __name__ == "__main__":
    unittest.main()
