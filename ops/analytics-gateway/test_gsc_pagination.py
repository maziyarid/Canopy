"""Disposable, provider-free proofs of bounded, atomic Search Console paging."""
import json
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Keep the system under test independent of legacy suites which replace
# gateway.sync_provider globally without restoring it.
_spec = importlib.util.spec_from_file_location('pagination_gateway', Path(__file__).with_name('gateway.py'))
gateway = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gateway)


class GscPaginationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db_patch = patch.object(gateway, 'DB', str(Path(self.tmp.name) / 'analytics.sqlite3'))
        self.db_patch.start()
        self.addCleanup(self.db_patch.stop)
        gateway.init_db()
        self.start, self.end = gateway.window_dates('7d')
        self.requests = []
        self.query_count = 5001
        self.response_override = None

    def row(self, index, dimensions):
        keys = [self.end] if dimensions == ['date'] else [self.end, f'query {index}', f'https://example.com/{index}']
        return {'keys': keys, 'clicks': 1, 'impressions': 10, 'position': 2}

    def provider(self, path, method='GET', body=None, timeout=30):
        if path == '/v1/sites':
            return {'sites': [{'siteUrl': 'sc-domain:example.com'}]}
        if path.startswith('/v1/gsc/sitemaps?'):
            return {'sitemaps': []}
        self.assertEqual(path, '/v1/gsc/search-analytics')
        self.requests.append(dict(body))
        if self.response_override is not None:
            override = self.response_override(body)
            if override is not None:
                return override
        offset = body.get('startRow', 0)
        count = 1 if body['dimensions'] == ['date'] else self.query_count
        return {'rows': [self.row(index, body['dimensions']) for index in range(offset, min(offset + body['rowLimit'], count))]}

    def sync(self, key='first', project='project-a', window='7d'):
        with patch.object(gateway, 'google_request', side_effect=self.provider), patch.object(gateway, 'GOOGLE_PROVIDER_URL', 'http://fixture.invalid'), patch.object(gateway, 'GOOGLE_PROVIDER_TOKEN', 'fixture-token'):
            return gateway.create_or_run_sync(project, 'gsc', 'example.com', window, gateway.now(), request_key=key)

    def query_offsets(self):
        return [body.get('startRow') for body in self.requests if body['dimensions'] == ['date', 'query', 'page']]

    def stored_state(self, project='project-a'):
        with gateway.db() as connection:
            metrics = [tuple(row) for row in connection.execute('select dataset,data_date,dimensions,metrics,freshness,sync_run_id from provider_metric where project_id=? order by dataset,dimensions', (project,))]
            snapshots = [tuple(row) for row in connection.execute('select dataset,payload,freshness,sync_run_id from provider_snapshot where project_id=? order by dataset', (project,))]
            state = connection.execute("select last_success,freshness from provider_state where project_id=? and provider='gsc'", (project,)).fetchone()
        return metrics, snapshots, tuple(state) if state else None

    def coverage(self):
        start, end = gateway.window_dates('28d')
        return gateway.metric_coverage('project-a', 'gsc', 'example.com', 'site_daily', start, end)

    def test_more_than_one_page_is_ingested_and_receipt_cursors_are_durable(self):
        receipt, created = self.sync()
        self.assertTrue(created)
        self.assertEqual(receipt['status'], 'completed')
        self.assertEqual(receipt['rows_written'], 5002)
        self.assertEqual(self.query_offsets(), [0, 5000])
        self.assertEqual(len(self.stored_state()[0]), 5002)
        expected_before = {'version': 1, 'site_daily': 0, 'query_page_daily': 0}
        expected_after = {'version': 1, 'site_daily': 1, 'query_page_daily': 5001}
        self.assertEqual(json.loads(receipt['cursor_before']), expected_before)
        self.assertEqual(json.loads(receipt['cursor_after']), expected_after)
        with gateway.db() as connection:
            persisted = connection.execute('select cursor_after from sync_run where id=?', (receipt['id'],)).fetchone()[0]
        self.assertEqual(json.loads(persisted), expected_after)

    def test_exact_page_multiple_requires_empty_terminator(self):
        self.query_count = 10000
        receipt, _ = self.sync()
        self.assertEqual(receipt['status'], 'completed')
        self.assertEqual(receipt['rows_received'], 10001)
        self.assertEqual(self.query_offsets(), [0, 5000, 10000])

    def test_empty_query_dataset_is_a_successful_zero(self):
        self.query_count = 0
        receipt, _ = self.sync()
        self.assertEqual(receipt['status'], 'completed')
        self.assertEqual(receipt['rows_written'], 1)
        self.assertEqual(self.query_offsets(), [0])
        self.assertEqual(json.loads(receipt['cursor_after'])['query_page_daily'], 0)

    def test_replay_does_not_fetch_again_and_new_sync_upserts_without_duplicates(self):
        first, _ = self.sync()
        calls = len(self.requests)
        replay, created = self.sync()
        self.assertFalse(created)
        self.assertEqual(replay['id'], first['id'])
        self.assertEqual(len(self.requests), calls)
        second, _ = self.sync('fresh')
        self.assertEqual(second['rows_inserted'], 0)
        self.assertEqual(second['rows_updated'], 5002)
        self.assertEqual(len(self.stored_state()[0]), 5002)

    def test_multiple_pages_remain_project_scoped(self):
        self.sync()
        self.assertEqual(self.stored_state('project-b')[0], [])
        self.sync(project='project-b')
        self.assertEqual(len(self.stored_state('project-a')[0]), 5002)
        self.assertEqual(len(self.stored_state('project-b')[0]), 5002)

    def test_later_page_failure_preserves_previous_metrics_snapshots_and_freshness(self):
        self.query_count = 1
        self.sync('baseline')
        before = self.stored_state()
        coverage_before = self.coverage()
        self.query_count = 5001
        def fail_later(body):
            if body['dimensions'] == ['date', 'query', 'page'] and body.get('startRow', 0) > 0:
                raise RuntimeError('google_provider_503:provider_unavailable')
        self.response_override = fail_later
        failed, _ = self.sync('later-page-failure', window='28d')
        self.assertEqual(failed['status'], 'error')
        self.assertEqual(failed['rows_written'], 0)
        self.assertIsNone(failed['data_freshness'])
        self.assertEqual(self.stored_state(), before)
        self.assertEqual(gateway.health_for('project-a', 'gsc')['status'], 'error')
        self.assertEqual(self.coverage(), coverage_before)
        self.assertEqual(coverage_before, {'ranges': [{'start': self.start, 'end': self.end}]})

    def test_malformed_pages_fail_without_writes_or_provider_data_in_errors(self):
        malformed = [[], {}, {'rows': None}, {'rows': {}}, {'rows': ['private-provider-body']}, {'rows': [{'keys': 'private-provider-body'}]}, {'rows': [{'keys': [self.end, None, 'private-provider-body']}]}, {'rows': [self.row(i, ['date', 'query', 'page']) for i in range(5001)]}]
        for index, response in enumerate(malformed):
            with self.subTest(index=index):
                self.response_override = lambda body, response=response: response if body['dimensions'] == ['date', 'query', 'page'] else None
                failed, _ = self.sync(f'malformed-{index}')
                self.assertEqual(failed['status'], 'error')
                self.assertEqual(failed['rows_written'], 0)
                self.assertEqual(self.stored_state()[0], [])
                self.assertNotIn('private-provider-body', failed['error_message_safe'])
                self.assertIn('gsc_invalid_page', failed['error_message_safe'])

    def test_repeated_page_fails_closed_instead_of_looping_or_counting_duplicates(self):
        def repeat(body):
            if body['dimensions'] == ['date', 'query', 'page']:
                return {'rows': [self.row(index, body['dimensions']) for index in range(5000)]}
        self.response_override = repeat
        failed, _ = self.sync()
        self.assertEqual(failed['status'], 'error')
        self.assertIn('gsc_pagination_no_progress', failed['error_message_safe'])
        self.assertEqual(self.query_offsets(), [0, 5000])
        self.assertEqual(self.stored_state()[0], [])

    def test_partial_overlap_between_pages_fails_closed(self):
        def overlap(body):
            if body['dimensions'] == ['date', 'query', 'page'] and body.get('startRow', 0) > 0:
                return {'rows': [self.row(4999, body['dimensions']), self.row(5000, body['dimensions'])]}
        self.response_override = overlap
        failed, _ = self.sync()
        self.assertEqual(failed['status'], 'error')
        self.assertIn('gsc_pagination_no_progress', failed['error_message_safe'])
        self.assertEqual(self.stored_state()[0], [])

    def test_cap_is_bounded_and_never_labels_truncated_data_complete(self):
        self.query_count = 1
        self.sync('baseline')
        before = self.stored_state()
        coverage_before = self.coverage()
        self.requests.clear()
        self.query_count = 10001
        with patch.object(gateway, 'GSC_MAX_PAGES', 2):
            failed, _ = self.sync('over-budget', window='28d')
        self.assertEqual(failed['status'], 'error')
        self.assertIn('gsc_pagination_limit_exceeded', failed['error_message_safe'])
        self.assertEqual(self.query_offsets(), [0, 5000, 10000])
        self.assertEqual(failed['rows_written'], 0)
        self.assertEqual(self.stored_state(), before)
        self.assertEqual(gateway.health_for('project-a', 'gsc')['status'], 'error')
        self.assertEqual(self.coverage(), coverage_before)

    def test_full_last_allowed_page_can_finish_with_empty_probe(self):
        self.query_count = 10000
        with patch.object(gateway, 'GSC_MAX_PAGES', 2):
            completed, _ = self.sync()
        self.assertEqual(completed['status'], 'completed')
        self.assertEqual(completed['rows_written'], 10001)
        self.assertEqual(self.query_offsets(), [0, 5000, 10000])


if __name__ == '__main__':
    unittest.main()
