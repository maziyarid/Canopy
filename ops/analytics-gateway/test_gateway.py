import json, os, socket, sqlite3, subprocess, tempfile, threading, time, unittest, urllib.error, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT=Path(__file__).resolve().parent
GATEWAY=ROOT/'gateway.py'

def free_port():
    s=socket.socket(); s.bind(('127.0.0.1',0)); p=s.getsockname()[1]; s.close(); return p

class FakeGoogle(BaseHTTPRequestHandler):
    token='fake-google-token'
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

    def request(self,path,method='GET',body=None,auth=True):
        headers={}
        if auth: headers['Authorization']='Bearer '+self.token
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
                       (id,provider,site,dataset,data_date,dimensions,metrics,freshness,sync_run_id,updated_at)
                       values(?,?,?,?,?,?,?,?,?,?)''',
                    (
                        f'monitor-{day}','gsc','monitor.example','site_daily',data_date,
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
                       (id,provider,site,dataset,data_date,dimensions,metrics,freshness,sync_run_id,updated_at)
                       values(?,?,?,?,?,?,?,?,?,?)''',
                    (
                        f'concurrent-monitor-{day}','gsc','concurrent.example','site_daily',data_date,
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

if __name__=='__main__': unittest.main()
