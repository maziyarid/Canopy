import unittest
from recommendation_execution_gate import RecommendationExecutionRefused, classify_recommendation


VALID = {
    "recommendationDisposition": "proposal_only",
    "recommendedAction": "Review the measured query drop before any change.",
    "evidenceRefs": ["snapshot:ga4:1"],
}


class RecommendationExecutionGateTest(unittest.TestCase):
    def test_proposal_is_inert(self):
        result = classify_recommendation(VALID, mode="propose")
        self.assertFalse(result["executed"])
        self.assertFalse(result["publisherInvoked"])
        self.assertEqual(result["action"], "none")
        self.assertEqual(result["recommendationDisposition"], "proposal_only")

    def test_publish_mode_is_refused(self):
        with self.assertRaises(RecommendationExecutionRefused) as caught:
            classify_recommendation(VALID, mode="publish")
        self.assertEqual(caught.exception.code, "recommendation_execution_disabled")

    def test_missing_evidence_is_refused(self):
        insight = dict(VALID)
        insight["evidenceRefs"] = []
        with self.assertRaises(RecommendationExecutionRefused) as caught:
            classify_recommendation(insight, mode="propose")
        self.assertEqual(caught.exception.code, "recommendation_evidence_missing")

    def test_non_proposal_disposition_is_refused(self):
        insight = dict(VALID)
        insight["recommendationDisposition"] = "approved_to_publish"
        with self.assertRaises(RecommendationExecutionRefused) as caught:
            classify_recommendation(insight, mode="propose")
        self.assertEqual(caught.exception.code, "recommendation_not_proposal_only")


if __name__ == "__main__":
    unittest.main()
