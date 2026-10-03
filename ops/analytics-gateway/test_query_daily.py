import unittest
from datetime import date, timedelta
import test_gateway as harness

class QueryDailyTest(harness.GatewayTest):
    def test_query_page_measurements_have_actual_dates_and_never_roll_up_rolling_windows(self):
        self.request('/v1/sites/example.com/refresh','POST',{'sources':['gsc'],'window':'7d'})
        status,body=self.request('/v1/metrics?provider=gsc&site=example.com&dataset=query_page_daily')
        self.assertEqual(status,200)
        self.assertEqual(len(body['rows']),1)
        row=body['rows'][0]
        self.assertEqual(row['data_date'],(date.today()-timedelta(days=2)).isoformat())
        self.assertEqual(row['dimensions'],{'query':'query one','page':'https://example.com/a'})
        self.assertEqual(row['metrics']['impressions'],50)
        self.request('/v1/sites/example.com/refresh','POST',{'sources':['gsc'],'window':'28d'})
        _,again=self.request('/v1/metrics?provider=gsc&site=example.com&dataset=query_page_daily')
        self.assertEqual(len(again['rows']),1)
        self.assertEqual(again['rows'][0]['metrics']['impressions'],50)
        _,legacy=self.request('/v1/metrics?provider=gsc&site=example.com&dataset=query_page')
        self.assertEqual(legacy['rows'],[])

    def test_metrics_limit_discloses_truncation(self):
        self.request('/v1/sites/example.com/refresh','POST',{'sources':['gsc'],'window':'7d'})
        _,limited=self.request('/v1/metrics?provider=gsc&site=example.com&limit=1')
        self.assertEqual(len(limited['rows']),1)
        self.assertTrue(limited['truncated'])
        _,query=self.request('/v1/metrics?provider=gsc&site=example.com&dataset=query_page_daily&limit=1')
        self.assertFalse(query['truncated'])

    def test_missing_measurements_are_not_replaced_with_measured_zero(self):
        harness.FakeGoogle.malformed_metrics=True
        try:
            _,refresh=self.request('/v1/sites/example.com/refresh','POST',{'sources':['gsc'],'window':'7d'})
            _,metrics=self.request('/v1/metrics?provider=gsc&site=example.com')
            self.assertEqual(metrics['rows'],[])
            self.assertEqual(refresh['runs'][0]['rows_skipped'],3)
        finally:
            harness.FakeGoogle.malformed_metrics=False

if __name__=='__main__': unittest.main()
