import unittest

from provider_retry_checkpoint import (
    FAIL_CLOSED,
    MAX_ATTEMPTS,
    ProviderRetryError,
    checkpoint_for_sync_failure,
    next_checkpoint,
    sync_error_class,
)


class ProviderRetryCheckpointTest(unittest.TestCase):
    def test_retryable_error_waits_then_fails_closed(self):
        waiting = next_checkpoint("running", "rate_limited", 1)
        self.assertEqual(waiting["stage"], "retry_wait")
        self.assertTrue(waiting["retryable"])
        self.assertFalse(waiting["scheduledPortfolioSyncEnabled"])
        exhausted = next_checkpoint("retry_wait", "timeout", MAX_ATTEMPTS)
        self.assertEqual(exhausted["stage"], "failed_closed")
        self.assertFalse(exhausted["retryable"])

    def test_unmapped_and_unauthorised_never_retry(self):
        for error_class in ("site_map_missing", "gsc_property_not_authorised", "not_configured"):
            result = next_checkpoint("running", error_class, 1)
            self.assertEqual(result["stage"], "failed_closed")
            self.assertFalse(result["retryable"])
            self.assertIn(error_class, FAIL_CLOSED)

    def test_unknown_error_fails_closed(self):
        result = next_checkpoint("running", "surprise", 1)
        self.assertEqual(result["stage"], "failed_closed")
        self.assertEqual(result["errorClass"], "unknown")

    def test_success_completes_without_enabling_portfolio_sync(self):
        result = next_checkpoint("running", None, 1)
        self.assertEqual(result["stage"], "completed")
        self.assertFalse(result["scheduledPortfolioSyncEnabled"])

    def test_completed_is_idempotent(self):
        result = next_checkpoint("completed", "rate_limited", 2)
        self.assertEqual(result["stage"], "completed")
        self.assertFalse(result["retryable"])

    def test_invalid_stage_fails_closed(self):
        with self.assertRaises(ProviderRetryError):
            next_checkpoint("dropped", "timeout", 1)

    def test_site_map_missing_does_not_requeue(self):
        message = "MS_ROBOT_PROJECT_SITE_MAP_JSON is required"
        self.assertEqual(sync_error_class(message), "site_map_missing")
        result = checkpoint_for_sync_failure(message, attempt=1)
        self.assertEqual(result["stage"], "failed_closed")
        self.assertEqual(result["errorClass"], "site_map_missing")
        self.assertFalse(result["retryable"])
        self.assertFalse(result["scheduledPortfolioSyncEnabled"])
        again = checkpoint_for_sync_failure("site_map_missing", attempt=MAX_ATTEMPTS)
        self.assertEqual(again["stage"], "failed_closed")
        self.assertFalse(again["retryable"])

    def test_unauthorised_property_does_not_requeue(self):
        result = checkpoint_for_sync_failure("gsc_property_not_authorised:example.com", 1)
        self.assertEqual(result["errorClass"], "gsc_property_not_authorised")
        self.assertFalse(result["retryable"])

    def test_transient_gateway_errors_can_wait(self):
        result = checkpoint_for_sync_failure("google_provider_unreachable:timed out", 1)
        self.assertEqual(result["stage"], "retry_wait")
        self.assertTrue(result["retryable"])


if __name__ == "__main__":
    unittest.main()
