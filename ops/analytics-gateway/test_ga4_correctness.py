"""Source-only regressions: synthetic upstream responses and disposable SQLite."""
import copy
import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

import gateway


class Ga4CorrectnessTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patches = [
            patch.object(gateway, 'DB', os.path.join(self.tmp.name, 'test.sqlite3')),
            patch.dict(os.environ, {'MS_ROBOT_PROJECT_GA4_MAP_JSON': json.dumps({'p1': {'example.com': '100'}})}),
            patch.object(gateway, 'ga4_window_dates', return_value=('2026-09-28', '2026-10-04')),
        ]
        for p in self.patches:
            p.start()
        gateway.init_db()
        self.retrieved_at = '2026-10-05T00:01:00Z'
        self.landing_rows = [{'dimensions': {'landingPage': '/about'}, 'metrics': {'activeUsers': 9, 'sessions': 14}}]
        self.coverage = {'complete': True, 'omittedRows': 0, 'truncated': False, 'reasons': []}

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.tmp.cleanup()

    def response(self, path, method, body):
        report = body['report']
        metrics = {'activeUsers': 9, 'sessions': 14}
        rows = {
            'summary': [{'dimensions': {}, 'metrics': metrics}],
            'daily': [{'dimensions': {'date': body['endDate']}, 'metrics': metrics}],
            'acquisition': [{'dimensions': {'sessionDefaultChannelGroup': 'Organic Search'}, 'metrics': metrics}],
            'landing_pages': self.landing_rows,
        }[report]
        return {'property': body['property'], 'rows': copy.deepcopy(rows), 'rowCount': len(rows),
                'coverage': copy.deepcopy(self.coverage), 'fetchedAt': self.retrieved_at,
                'metadata': {'timeZone': 'Asia/Tehran'}}

    def sync(self, run_id='r1'):
        with patch.object(gateway, 'google_request', side_effect=self.response):
            return gateway.run_ga4_sync('p1', 'example.com', '7d', run_id)

    def rows(self, dataset):
        return gateway.metric_rows('p1', 'ga4', 'example.com', dataset)

    def test_privacy_collisions_are_omitted_instead_of_overwriting_or_adding_users(self):
        self.landing_rows = [
            {'dimensions': {'landingPage': '/case/:redacted/view'}, 'metrics': {'activeUsers': 9, 'sessions': 14}},
            {'dimensions': {'landingPage': '/case/:redacted/view'}, 'metrics': {'activeUsers': 8, 'sessions': 20}},
            {'dimensions': {'landingPage': '/about'}, 'metrics': {'activeUsers': 3, 'sessions': 4}},
        ]
        result = self.sync()
        self.assertEqual([row['dimensions']['landingPage'] for row in self.rows('landing_page')], ['/about'])
        self.assertEqual(result['rows_skipped'], 2)

    def test_resync_does_not_retain_previously_stored_colliding_page(self):
        self.landing_rows = [{'dimensions': {'landingPage': '/case/:redacted/view'}, 'metrics': {'activeUsers': 9}}]
        self.sync()
        self.landing_rows *= 2
        self.sync('r2')
        self.assertEqual(self.rows('landing_page'), [])

    def test_historical_metrics_retain_their_actual_source_after_property_remapping(self):
        self.sync()
        original = self.rows('summary')[0]
        self.retrieved_at = '2026-10-06T00:01:00Z'
        with patch.dict(os.environ, {'MS_ROBOT_PROJECT_GA4_MAP_JSON': json.dumps({'p1': {'example.com': '200'}})}), \
             patch.object(gateway, 'ga4_window_dates', return_value=('2026-09-29', '2026-10-05')):
            self.sync('r2')
        rows = self.rows('summary')
        old = next(row for row in rows if row['sync_run_id'] == 'r1')
        new = next(row for row in rows if row['sync_run_id'] == 'r2')
        self.assertEqual(old['source']['property'], 'properties/100')
        self.assertEqual(old['source']['retrievedAt'], '2026-10-05T00:01:00Z')
        self.assertEqual(old['source'], original['source'])
        self.assertEqual(new['source']['property'], 'properties/200')
        self.assertEqual(new['source']['retrievedAt'], self.retrieved_at)

    def test_provider_truncation_and_omission_make_sync_partial(self):
        self.coverage = {'complete': False, 'omittedRows': 2, 'truncated': True, 'reasons': ['row_limit', 'dimension_collision']}
        result = self.sync()
        self.assertGreater(result['rows_skipped'], 0)
        self.assertFalse(self.rows('summary')[0]['source']['coverage']['complete'])

    def test_truncated_rows_are_not_invented_in_skip_count_and_provider_is_degraded(self):
        self.coverage = {'complete': False, 'omittedRows': 0, 'truncated': True, 'reasons': ['row_limit']}
        result = self.sync()
        self.assertEqual(result['rows_skipped'], 0)
        self.assertTrue(result['quality_incomplete'])
        with patch.object(gateway, 'GOOGLE_PROVIDER_URL', 'http://127.0.0.1:1'), \
             patch.object(gateway, 'GOOGLE_PROVIDER_TOKEN', 'synthetic'), \
             patch.object(gateway, 'google_request', side_effect=self.response):
            gateway.create_or_run_sync('p1', 'ga4', 'example.com', '7d', '2026-10-05T00:00:00Z')
        self.assertEqual(next(row for row in gateway.safe_provider_rows('p1') if row['provider'] == 'ga4')['status'], 'degraded')

    def test_legacy_metrics_do_not_borrow_mutable_latest_source(self):
        self.sync()
        with gateway.db() as connection:
            gateway.upsert_metric(connection, 'p1', 'ga4', 'example.com', 'summary', '2026-09-20',
                                  {'startDate': '2026-09-14', 'endDate': '2026-09-20'}, {'activeUsers': 4},
                                  '2026-09-20', 'legacy', '2026-09-21T00:00:00Z')
        old = next(row for row in self.rows('summary') if row['sync_run_id'] == 'legacy')
        self.assertIsNone(old.get('source'))

    def test_daily_coverage_cannot_use_old_receipt_over_a_new_partial_measurement(self):
        with gateway.db() as connection:
            for run_id in ('complete', 'partial'):
                connection.execute("""insert into sync_run(id,project_id,provider,site,window,status,
                    requested_start,requested_end,data_freshness,idempotency_key,started_at)
                    values(?,'p1','ga4','example.com','2d','completed','2026-10-03','2026-10-04','2026-10-04',?,'2026-10-05')""", (run_id, run_id))
            source={'provider':'ga4','property':'properties/100','coverage':{'complete':True}}
            for day in ('2026-10-03', '2026-10-04'):
                gateway.upsert_metric(connection, 'p1', 'ga4', 'example.com', 'site_daily', day,
                    {'date':day}, {'activeUsers':9}, '2026-10-04', 'complete', '2026-10-05', source)
        self.assertEqual(gateway.metric_coverage('p1','ga4','example.com','site_daily','2026-10-03','2026-10-04')['ranges'],
                         [{'start':'2026-10-03','end':'2026-10-04'}])
        with gateway.db() as connection:
            source['coverage']={'complete':False,'truncated':True}
            gateway.upsert_metric(connection, 'p1', 'ga4', 'example.com', 'site_daily', '2026-10-04',
                {'date':'2026-10-04'}, {'activeUsers':7}, '2026-10-04', 'partial', '2026-10-06', source)
        self.assertEqual(gateway.metric_coverage('p1','ga4','example.com','site_daily','2026-10-03','2026-10-04')['ranges'], [])

    def test_empty_narrower_daily_resync_does_not_certify_the_deleted_date(self):
        with gateway.db() as connection:
            connection.execute("""insert into sync_run(id,project_id,provider,site,window,status,
                requested_start,requested_end,data_freshness,idempotency_key,started_at)
                values('complete','p1','ga4','example.com','2d','completed','2026-10-03','2026-10-04','2026-10-04','complete','2026-10-05')""")
            source={'provider':'ga4','property':'properties/100','coverage':{'complete':True}}
            for day in ('2026-10-03', '2026-10-04'):
                gateway.upsert_metric(connection, 'p1', 'ga4', 'example.com', 'site_daily', day,
                    {'date':day}, {'activeUsers':9}, '2026-10-04', 'complete', '2026-10-05', source)
            gateway.clear_ga4_slice(connection, 'p1', 'example.com', 'site_daily', '2026-10-04', '2026-10-04')
        self.assertEqual(gateway.metric_coverage('p1','ga4','example.com','site_daily','2026-10-03','2026-10-04')['ranges'],
                         [{'start':'2026-10-03','end':'2026-10-03'}])

    def test_invalid_resync_replaces_old_summary_and_daily_slices(self):
        self.sync()
        def invalid_response(path, method, body):
            response = self.response(path, method, body)
            if body['report'] in ('summary', 'daily'):
                for row in response['rows']:
                    row['metrics'] = {'activeUsers':None,'sessions':None}
            return response
        with patch.object(gateway, 'google_request', side_effect=invalid_response):
            result = gateway.run_ga4_sync('p1', 'example.com', '7d', 'invalid')
        self.assertGreater(result['rows_skipped'], 0)
        self.assertEqual(self.rows('summary'), [])
        self.assertEqual(self.rows('site_daily'), [])

    def test_existing_schema_adds_source_metadata_without_rewriting_rows(self):
        self.sync()
        with gateway.db() as connection:
            columns = {row['name'] for row in connection.execute('pragma table_info(provider_metric)')}
        self.assertIn('source_metadata', columns)
        with gateway.db() as connection:
            connection.execute('alter table provider_metric drop column source_metadata')
        gateway.init_db()
        self.assertEqual(self.rows('summary')[0]['metrics']['activeUsers'], 9)
        self.assertIsNone(self.rows('summary')[0].get('source'))


if __name__ == '__main__':
    unittest.main()
