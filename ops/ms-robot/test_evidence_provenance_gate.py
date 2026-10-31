import unittest

from evidence_provenance_gate import EvidenceProvenanceRefused, classify_evidence_insight


class EvidenceProvenanceGateTest(unittest.TestCase):
    def test_valid_draft_is_not_review_ready(self):
        draft = {
            "projectId": "proj_a",
            "type": "observation",
            "provenance": "first_party",
            "evidenceRefs": [{"provider": "gsc", "provenance": "first_party", "kind": "query"}],
        }
        result = classify_evidence_insight(draft)
        self.assertFalse(result["reviewReady"])
        self.assertFalse(result["clientVisible"])
        self.assertEqual(result["action"], "none")
        self.assertEqual(result["kind"], "observation")

    def test_unknown_kind_is_refused(self):
        draft = {
            "projectId": "proj_a",
            "type": "speculation",
            "provenance": "first_party",
            "evidenceRefs": [{"provider": "gsc"}],
        }
        with self.assertRaises(EvidenceProvenanceRefused) as caught:
            classify_evidence_insight(draft)
        self.assertEqual(str(caught.exception), "evidence_kind_unknown")

    def test_missing_refs_is_refused(self):
        draft = {
            "projectId": "proj_a",
            "type": "observation",
            "provenance": "first_party",
            "evidenceRefs": [],
        }
        with self.assertRaises(EvidenceProvenanceRefused) as caught:
            classify_evidence_insight(draft)
        self.assertEqual(str(caught.exception), "evidence_refs_missing")

    def test_enable_mode_is_refused(self):
        draft = {
            "projectId": "proj_a",
            "type": "observation",
            "provenance": "first_party",
            "evidenceRefs": [{"provider": "gsc"}],
        }
        with self.assertRaises(EvidenceProvenanceRefused) as caught:
            classify_evidence_insight(draft, mode="enable")
        self.assertEqual(str(caught.exception), "evidence_route_disabled")

    def test_control_characters_in_project_fail_closed(self):
        draft = {
            "projectId": "proj\x00a",
            "type": "observation",
            "provenance": "first_party",
            "evidenceRefs": [{"provider": "gsc"}],
        }
        with self.assertRaises(EvidenceProvenanceRefused) as caught:
            classify_evidence_insight(draft)
        self.assertEqual(str(caught.exception), "evidence_project_unbound")


if __name__ == "__main__":
    unittest.main()
