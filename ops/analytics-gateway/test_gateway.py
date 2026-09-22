import json, os, socket, sqlite3, subprocess, sys, tempfile, threading, time, unittest, urllib.error, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from portfolio_gsc import project_site_map
from monitor_dispatch import bridge_event
GATEWAY=ROOT/'gateway.py'

def free_port():
    s=socket.socket(); s.bind(('127.0.0.1',0)); p=s.getsockname()[1]; s.close(); return p

class FakeGoogle(BaseHTTPRequestHandler):
    token='fake-google-token'
    leak_authorization_error=False
    def log_message(self,*_): pass
    def sendj(self,code,obj):
        raw=json.dumps(obj).encode()
        self.send_response(code); self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def authed(self):
        return self.headers.get('Authorization')=='Bearer '+self.token
    def do_GET(self):
        if self.path=='/health':
            self.sendj(200,{'ok':True}); return
        if self.path=='/v1/sites' and self.leak_authorization_error:
            self.sendj(401,{'error':'Authorization: Bearer provider-secret-123'}); return
        if not self.authed():
            self.sendj(401,{'error':'unauthorised'}); return
        if self.path=='/v1/sites':
            self.sendj(200,{'sites':[{'siteUrl':'sc-domain:example.com','permissionLevel':'siteFullUser'}]}); return
        if self.path=='/v1/ga4/accounts':
            self.sendj(200,{'accounts':[{'account':'accounts/1','displayName':'Example','properties':[{'property':'properties/100','displayName':'Example GA4','propertyType':'PROPERTY_TYPE_ORDINARY'}]}]}); return
        if self.path=='/v1/gtm/accounts':
            self.sendj(200,{'accounts':[{'accountId':'1','name':'Example GTM','path':'accounts/1'}]}); return
        if self.path.startswith('/v1/gsc/sitemaps?'):
            self.sendj(200,{'siteUrl':'sc-domain:example.com','sitemaps':[{'path':'https://example.com/sitemap.xml','errors':0,'warnings':0}]}); return
        self.sendj(404,{'error':'not_found'})
    def do_POST(self):
        if not self.authed():
            self.sendj(401,{'error':'unauthorised'}); return
        n=int(self.headers.get('Content-Length','0') or 0)
        body=json.loads(self.rfile.read(n) or b'{}')
        if self.path=='/v1/gsc/search-analytics':
            dims=body.get('dimensions') or []
            if dims==['date']:
                rows=[
                    {'keys':['2026-09-18'],'clicks':2,'impressions':100,'ctr':.02,'position':10},
                    {'keys':['2026-09-19'],'clicks':3,'impressions':200,'ctr':.015,'position':20},
                ]
            else:
                rows=[{'keys':['query one','https://example.com/a'],'clicks':1,'impressions':50,'ctr':.02,'position':8}]
            self.sendj(200,{'siteUrl':body.get('siteUrl'),'dimensions':dims,'rows':rows,'fetchedAt':'2026-09-21T00:00:00Z'}); return
        self.sendj(404,{'error':'not_found'})

class GatewayTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.google_port=free_port()
        self.google=ThreadingHTTPServer(('127.0.0.1',self.google_port),FakeGoogle)
        self.google_thread=threading.Thread(target=self.google.serve_forever,daemon=True)
        self.google_thread.start()

        self.port=free_port(); self.token='test-token'
        self.db_path=Path(self.tmp.name)/'state.sqlite3'
        env=os.environ.copy()
        env.update(
            ANALYTICS_GATEWAY_PORT=str(self.port),
            ANALYTICS_GATEWAY_TOKEN=self.token,
            ANALYTICS_GATEWAY_DB=str(self.db_path),
            GOOGLE_PROVIDER_URL=f'http://127.0.0.1:{self.google_port}',
            GOOGLE_PROVIDER_TOKEN=FakeGoogle.token,
        )
        self.proc=subprocess.Popen(['python3',str(GATEWAY)],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                urllib.request.urlopen(f'http://127.0.0.1:{self.port}/health',timeout=.2); break
            except Exception: time.sleep(.05)

    def tearDown(self):
        self.proc.terminate(); self.proc.wait(timeout=5)
        self.google.shutdown(); self.google.server_close()
        self.tmp.cleanup()

    def request(self,path,method='GET',body=None,auth=True,project='project-a'):
        headers={}
        if auth:
            headers['Authorization']='Bearer '+self.token
            if project is not None:
                headers['X-Ms-Robot-Project-Id']=project
        data=None
        if body is not None:
            data=json.dumps(body).encode(); headers['Content-Type']='application/json'
        req=urllib.request.Request(f'http://127.0.0.1:{self.port}{path}',data=data,headers=headers,method=method)
        try:
            with urllib.request.urlopen(req,timeout=4) as r: return r.status,json.load(r)
        except urllib.error.HTTPError as e: return e.code,json.load(e)

    def test_auth_and_provider_state(self):
        status,body=self.request('/v1/providers',auth=False)
        self.assertEqual(status,401); self.assertEqual(body['error'],'unauthorized')
        status,body=self.request('/v1/providers')
        self.assertEqual(status,200)
        self.assertTrue(all(p['status']=='not_configured' for p in body['providers']))

    def test_unconfigured_refresh_is_blocked_not_stuck(self):
        status,body=self.request('/v1/sites/example.com/refresh','POST',{'sources':['ga4','gtm']})
        self.assertEqual(status,202); self.assertEqual(body['accepted'],['ga4','gtm'])
        _,ledger=self.request('/v1/sync-runs?limit=10')
        self.assertEqual({r['status'] for r in ledger['runs']},{'blocked'})
        self.assertEqual({r['error_class'] for r in ledger['runs']},{'not_configured'})

    def test_registry_refresh_accepts_known_non_google_providers(self):
        status,body=self.request(
            '/v1/sites/example.com/refresh','POST',
            {'sources':['gtm','bing_webmaster','semrush','unknown'],'window':'28d'},
        )
        self.assertEqual(status,202)
        self.assertEqual(body['accepted'],['gtm','bing_webmaster','semrush'])
        _,ledger=self.request('/v1/sync-runs?limit=10')
        matching=[r for r in ledger['runs'] if r['provider'] in {'gtm','bing_webmaster','semrush'}]
        self.assertEqual({r['window'] for r in matching},{'28d'})
        self.assertEqual({r['status'] for r in matching},{'blocked'})

    def test_sync_ledger_schema_is_upgraded_additively(self):
        with sqlite3.connect(self.db_path) as connection:
            columns={row[1] for row in connection.execute('pragma table_info(sync_run)')}
        expected={
            'requested_start','requested_end','cursor_before','cursor_after',
            'rows_received','rows_inserted','rows_updated','rows_skipped',
            'rate_limit_state','quota_state','error_message_safe',
            'data_freshness','code_version',
        }
        self.assertTrue(expected.issubset(columns))

    def test_custom_window_does_not_invent_date_range(self):
        payload={'sources':['semrush'],'window':'same-window','idempotencyKey':'dates-1'}
        _,body=self.request('/v1/sites/example.com/refresh','POST',payload)
        run=body['runs'][0]
        self.assertIsNone(run['requested_start'])
        self.assertIsNone(run['requested_end'])

    def test_blocked_sync_has_safe_receipt_fields(self):
        payload={'sources':['semrush'],'window':'28d','idempotencyKey':'safe-receipt-1'}
        _,body=self.request('/v1/sites/example.com/refresh','POST',payload)
        run=body['runs'][0]
        self.assertEqual(run['status'],'blocked')
        self.assertEqual(run['error_class'],'not_configured')
        self.assertEqual(run['error_message_safe'],'not_configured')
        self.assertIn('code_version',run)
        self.assertIn('rows_received',run)
        self.assertIn('rows_inserted',run)
        self.assertIn('rows_updated',run)
        self.assertIn('rows_skipped',run)

    def test_repeated_refresh_is_idempotent_with_caller_key(self):
        payload={'sources':['semrush'],'window':'same-window','idempotencyKey':'retry-1'}
        _,first=self.request('/v1/sites/example.com/refresh','POST',payload)
        _,second=self.request('/v1/sites/example.com/refresh','POST',payload)
        self.assertTrue(first['runs'][0]['created'])
        self.assertFalse(first['runs'][0]['coalesced'])
        self.assertFalse(second['runs'][0]['created'])
        self.assertTrue(second['runs'][0]['coalesced'])
        _,ledger=self.request('/v1/sync-runs?limit=10')
        matching=[r for r in ledger['runs'] if r['provider']=='semrush' and r['window']=='same-window']
        self.assertEqual(len(matching),1)

    def test_distinct_refreshes_without_caller_key_create_distinct_runs(self):
        payload={'sources':['semrush'],'window':'manual-window'}
        _,first=self.request('/v1/sites/example.com/refresh','POST',payload)
        _,second=self.request('/v1/sites/example.com/refresh','POST',payload)
        self.assertTrue(first['runs'][0]['created'])
        self.assertTrue(second['runs'][0]['created'])
        _,ledger=self.request('/v1/sync-runs?limit=10')
        matching=[r for r in ledger['runs'] if r['provider']=='semrush' and r['window']=='manual-window']
        self.assertEqual(len(matching),2)

    def test_invalid_sync_run_limit_returns_json_400(self):
        status,body=self.request('/v1/sync-runs?limit=not-a-number')
        self.assertEqual(status,400)
        self.assertEqual(body['error'],'invalid_limit')

    def test_google_discovery_connection_tests_update_provider_state(self):
        for provider in ('ga4','gtm'):
            status,result=self.request(f'/v1/providers/{provider}/test','POST',{})
            self.assertEqual(status,200)
            self.assertTrue(result['ok'])
            self.assertEqual(result['accountCount'],1)
        _,body=self.request('/v1/providers')
        states={p['provider']:p for p in body['providers']}
        self.assertEqual(states['ga4']['status'],'ok')
        self.assertEqual(states['gtm']['status'],'ok')
        self.assertEqual(states['ga4']['auth_type'],'service_account')
        self.assertEqual(states['gtm']['auth_type'],'service_account')

    def test_gsc_monitor_deduplicates_investigations(self):
        with sqlite3.connect(self.db_path) as connection:
            for day in range(1, 15):
                recent=day > 7
                clicks=2 if recent else 10
                impressions=40 if recent else 100
                data_date=f'2026-09-{day:02d}'
                dimensions=json.dumps({'date':data_date},separators=(',',':'),sort_keys=True)
                metrics=json.dumps(
                    {'clicks':clicks,'impressions':impressions,'ctr':clicks/impressions,'position':20},
                    separators=(',',':'),sort_keys=True,
                )
                connection.execute(
                    '''insert into provider_metric
                       (id,project_id,provider,site,dataset,data_date,dimensions,metrics,freshness,sync_run_id,updated_at)
                       values(?,?,?,?,?,?,?,?,?,?,?)''',
                    (
                        f'monitor-{day}','project-a','gsc','monitor.example','site_daily',data_date,
                        dimensions,metrics,'2026-09-14','monitor-run','2026-09-21T00:00:00Z',
                    ),
                )

        status,first=self.request('/v1/monitor/gsc','POST',{})
        self.assertEqual(status,200)
        self.assertEqual(first['created'],2)
        self.assertEqual(first['updated'],0)
        self.assertEqual(
            {item['signalType'] for item in first['activeSignals']},
            {'traffic_click_drop','traffic_impression_drop'},
        )

        status,second=self.request('/v1/monitor/gsc','POST',{})
        self.assertEqual(status,200)
        self.assertEqual(second['created'],0)
        self.assertEqual(second['updated'],2)

        status,body=self.request('/v1/investigations?site=monitor.example&status=open')
        self.assertEqual(status,200)
        self.assertEqual(len(body['investigations']),2)
        self.assertEqual(
            {item['signal_type'] for item in body['investigations']},
            {'traffic_click_drop','traffic_impression_drop'},
        )

    def test_gsc_connection_sync_metrics_and_snapshot(self):
        status,test=self.request('/v1/providers/gsc/test','POST',{})
        self.assertEqual(status,200); self.assertTrue(test['ok']); self.assertEqual(test['siteCount'],1)

        status,refresh=self.request('/v1/sites/example.com/refresh','POST',{'sources':['gsc'],'window':'7d'})
        self.assertEqual(status,202)
        self.assertEqual(refresh['runs'][0]['status'],'completed')
        self.assertEqual(refresh['runs'][0]['rows_written'],3)

        _,metrics=self.request('/v1/metrics?provider=gsc&site=example.com&dataset=site_daily')
        self.assertEqual(len(metrics['rows']),2)

        _,snapshot=self.request('/v1/sites/example.com/snapshot?window=7d')
        self.assertEqual(snapshot['gsc']['clicks'],5.0)
        self.assertEqual(snapshot['gsc']['impressions'],300.0)
        self.assertAlmostEqual(snapshot['gsc']['ctr'],5/300)

    def test_gsc_monitor_concurrent_requests_do_not_race_investigation_insert(self):
        with sqlite3.connect(self.db_path) as connection:
            for day in range(1, 15):
                recent=day > 7
                clicks=2 if recent else 10
                impressions=40 if recent else 100
                data_date=f'2026-09-{day:02d}'
                dimensions=json.dumps({'date':data_date},separators=(',',':'),sort_keys=True)
                metrics=json.dumps(
                    {'clicks':clicks,'impressions':impressions,'ctr':clicks/impressions,'position':20},
                    separators=(',',':'),sort_keys=True,
                )
                connection.execute(
                    '''insert into provider_metric
                       (id,project_id,provider,site,dataset,data_date,dimensions,metrics,freshness,sync_run_id,updated_at)
                       values(?,?,?,?,?,?,?,?,?,?,?)''',
                    (
                        f'concurrent-monitor-{day}','project-a','gsc','concurrent.example','site_daily',data_date,
                        dimensions,metrics,'2026-09-14','monitor-run','2026-09-21T00:00:00Z',
                    ),
                )

        barrier=threading.Barrier(8)
        results=[]
        errors=[]
        def invoke():
            try:
                barrier.wait(timeout=5)
                results.append(self.request('/v1/monitor/gsc','POST',{}))
            except Exception as exc:
                errors.append(exc)

        workers=[threading.Thread(target=invoke) for _ in range(8)]
        for worker in workers: worker.start()
        for worker in workers: worker.join(timeout=10)

        self.assertEqual(errors,[])
        self.assertEqual(len(results),8)
        self.assertTrue(all(status==200 for status,_ in results))
        status,body=self.request('/v1/investigations?site=concurrent.example&status=open')
        self.assertEqual(status,200)
        self.assertEqual(len(body['investigations']),2)

    def test_bearer_credentials_are_redacted_everywhere(self):
        FakeGoogle.leak_authorization_error=True
        try:
            status,body=self.request(
                '/v1/sites/example.com/refresh','POST',
                {'sources':['gsc'],'window':'7d','idempotencyKey':'redact-bearer'},
                project='project-a',
            )
            self.assertEqual(status,202)
            run=body['runs'][0]
            self.assertEqual(run['status'],'error')
            self.assertNotIn('provider-secret-123',run['error_message_safe'])
            self.assertIn('<redacted>',run['error_message_safe'])

            _,ledger=self.request('/v1/sync-runs?limit=20',project='project-a')
            persisted_run=next(r for r in ledger['runs'] if 'redact-bearer' in r['idempotency_key'])
            self.assertNotIn('provider-secret-123',persisted_run['error_message_safe'])

            _,providers=self.request('/v1/providers',project='project-a')
            gsc=next(p for p in providers['providers'] if p['provider']=='gsc')
            self.assertNotIn('provider-secret-123',gsc.get('last_error') or '')

            with sqlite3.connect(self.db_path) as connection:
                raw=connection.execute(
                    "select error_message_safe from sync_run where project_id=? and idempotency_key like ?",
                    ('project-a','%redact-bearer'),
                ).fetchone()[0]
            self.assertNotIn('provider-secret-123',raw)
        finally:
            FakeGoogle.leak_authorization_error=False

    def test_project_scope_is_required_for_authenticated_gateway_calls(self):
        status,body=self.request('/v1/providers',project=None)
        self.assertEqual(status,400)
        self.assertEqual(body['error'],'invalid_project_scope')

    def test_provider_state_and_sync_ledger_are_project_isolated(self):
        status,result=self.request('/v1/providers/gsc/test','POST',{},project='project-a')
        self.assertEqual(status,200)
        self.assertTrue(result['ok'])

        _,states_a=self.request('/v1/providers',project='project-a')
        _,states_b=self.request('/v1/providers',project='project-b')
        by_a={item['provider']:item for item in states_a['providers']}
        by_b={item['provider']:item for item in states_b['providers']}
        self.assertEqual(by_a['gsc']['status'],'ok')
        self.assertEqual(by_b['gsc']['status'],'not_configured')

        payload={'sources':['semrush'],'window':'28d','idempotencyKey':'shared-key'}
        _,first=self.request('/v1/sites/example.com/refresh','POST',payload,project='project-a')
        _,second=self.request('/v1/sites/example.com/refresh','POST',payload,project='project-b')
        self.assertTrue(first['runs'][0]['created'])
        self.assertTrue(second['runs'][0]['created'])

        _,ledger_a=self.request('/v1/sync-runs?limit=10',project='project-a')
        _,ledger_b=self.request('/v1/sync-runs?limit=10',project='project-b')
        self.assertEqual(len([r for r in ledger_a['runs'] if r['provider']=='semrush']),1)
        self.assertEqual(len([r for r in ledger_b['runs'] if r['provider']=='semrush']),1)
        self.assertTrue(all(r['project_id']=='project-a' for r in ledger_a['runs']))
        self.assertTrue(all(r['project_id']=='project-b' for r in ledger_b['runs']))

    def test_metrics_and_snapshots_are_project_isolated(self):
        status,refresh=self.request(
            '/v1/sites/example.com/refresh','POST',
            {'sources':['gsc'],'window':'7d','idempotencyKey':'project-metrics'},
            project='project-a',
        )
        self.assertEqual(status,202)
        self.assertEqual(refresh['runs'][0]['status'],'completed')

        _,metrics_a=self.request(
            '/v1/metrics?provider=gsc&site=example.com&dataset=site_daily',
            project='project-a',
        )
        _,metrics_b=self.request(
            '/v1/metrics?provider=gsc&site=example.com&dataset=site_daily',
            project='project-b',
        )
        self.assertEqual(len(metrics_a['rows']),2)
        self.assertEqual(metrics_b['rows'],[])

        _,snapshot_a=self.request('/v1/sites/example.com/snapshot?window=7d',project='project-a')
        _,snapshot_b=self.request('/v1/sites/example.com/snapshot?window=7d',project='project-b')
        self.assertIn('gsc',snapshot_a)
        self.assertNotIn('gsc',snapshot_b)

    def test_concurrent_duplicate_refreshes_coalesce_atomically(self):
        barrier=threading.Barrier(8)
        results=[]
        errors=[]
        payload={'sources':['semrush'],'window':'28d','idempotencyKey':'concurrent-same-key'}

        def invoke():
            try:
                barrier.wait(timeout=5)
                results.append(self.request(
                    '/v1/sites/example.com/refresh','POST',payload,project='project-a'
                ))
            except Exception as exc:
                errors.append(exc)

        workers=[threading.Thread(target=invoke) for _ in range(8)]
        for worker in workers: worker.start()
        for worker in workers: worker.join(timeout=10)

        self.assertEqual(errors,[])
        self.assertEqual(len(results),8)
        self.assertTrue(all(status==202 for status,_ in results))
        runs=[body['runs'][0] for _,body in results]
        self.assertEqual(sum(1 for run in runs if run['created']),1)
        self.assertEqual(sum(1 for run in runs if run['coalesced']),7)

        _,ledger=self.request('/v1/sync-runs?limit=20',project='project-a')
        matching=[r for r in ledger['runs'] if 'concurrent-same-key' in r['idempotency_key']]
        self.assertEqual(len(matching),1)

    def test_portfolio_mapping_is_explicit_and_normalized(self):
        mapping=project_site_map({
            'MS_ROBOT_PROJECT_SITE_MAP_JSON':json.dumps({
                'https://www.Example.com/':'project-a',
                'sc-domain:second.example':'project-b',
            })
        })
        self.assertEqual(mapping,{
            'example.com':'project-a',
            'second.example':'project-b',
        })
        with self.assertRaises(SystemExit):
            project_site_map({})
        with self.assertRaises(SystemExit):
            project_site_map({'MS_ROBOT_PROJECT_SITE_MAP_JSON':'{"example.com":""}'})

    def test_monitor_bridge_refuses_unscoped_signal(self):
        with self.assertRaisesRegex(RuntimeError,'monitor_signal_missing_project_id'):
            bridge_event(
                {'site':'example.com','signalType':'traffic_click_drop','evidence':{}},
                'open',
            )

if __name__=='__main__': unittest.main()
