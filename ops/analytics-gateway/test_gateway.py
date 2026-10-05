import json, os, socket, sqlite3, subprocess, sys, tempfile, threading, time, unittest, urllib.error, urllib.request
from datetime import date, timedelta
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
    malformed_metrics=False
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
            detail=self.leak_authorization_error if isinstance(self.leak_authorization_error,str) else 'Authorization: Bearer provider-secret-123'
            self.sendj(401,{'error':detail}); return
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
                d1=(date.today()-timedelta(days=3)).isoformat()
                d2=(date.today()-timedelta(days=2)).isoformat()
                rows=[
                    {'keys':[d1],'clicks':2,'impressions':100,'ctr':.02,'position':10},
                    {'keys':[d2],'clicks':3,'impressions':200,'ctr':.015,'position':20},
                ]
            elif dims==['date','query','page']:
                rows=[{'keys':[(date.today()-timedelta(days=2)).isoformat(),'query one','https://example.com/a'],'clicks':1,'impressions':50,'ctr':.02,'position':8}]
            else:
                rows=[{'keys':['query one','https://example.com/a'],'clicks':1,'impressions':50,'ctr':.02,'position':8}]
            if self.malformed_metrics:
                for row in rows: row.pop('impressions',None)
            self.sendj(200,{'siteUrl':body.get('siteUrl'),'dimensions':dims,'rows':rows,'fetchedAt':'2026-09-21T00:00:00Z'}); return
        if self.path=='/v1/ga4/run-report':
            report=body.get('report')
            common={'activeUsers':9,'newUsers':3,'sessions':14,'engagedSessions':10,'engagementRate':10/14,'averageSessionDuration':61.5,'eventCount':52,'keyEvents':2}
            if report=='summary':
                rows=[{'dimensions':{},'metrics':common}]
            elif report=='daily':
                rows=[
                    {'dimensions':{'date':body.get('startDate')},'metrics':common},
                    {'dimensions':{'date':body.get('endDate')},'metrics':common},
                ]
            elif report=='acquisition':
                rows=[{'dimensions':{'sessionDefaultChannelGroup':'Organic Search'},'metrics':common}]
            elif report=='landing_pages':
                rows=[{'dimensions':{'landingPage':'/services/rhinoplasty'},'metrics':common}]
            else:
                self.sendj(400,{'error':'invalid_ga4_report'}); return
            self.sendj(200,{
                'property':body.get('property'),'report':report,
                'startDate':body.get('startDate'),'endDate':body.get('endDate'),
                'rows':rows,'metadata':{'timeZone':'Asia/Tehran','currencyCode':'IRR'},
                'propertyQuota':{'tokensPerDay':{'remaining':1000}},'fetchedAt':'2026-10-05T00:00:00Z',
            }); return
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
            MS_ROBOT_PROJECT_GA4_MAP_JSON=json.dumps({'project-a':{'example.com':'properties/100'}}),
        )
        self.proc=subprocess.Popen(['python3',str(GATEWAY)],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                urllib.request.urlopen(f'http://127.0.0.1:{self.port}/health',timeout=.2); break
            except Exception: time.sleep(.05)
    def test_ada_receipt_read_requires_auth_and_exact_project_site(self):
        from ada_bridge_receipts import validate_event, persist_receipt
        from test_ada_bridge_consumer import event
        persist_receipt(str(self.db_path), validate_event(event()))
        code, response = self.request('/v1/ada-events?site=example.com')
        self.assertEqual(code, 200)
        self.assertEqual(response['events'][0]['event_id'], 'event-1')
        self.assertNotIn('payload', response['events'][0])
        self.assertNotIn('envelope_sha256', response['events'][0])
        self.assertNotIn('transient content only', json.dumps(response))
        self.assertEqual(self.request('/v1/ada-events?site=example.com', auth=False)[0], 401)
        self.assertEqual(self.request('/v1/ada-events?site=example.com', project=None)[0], 400)
        self.assertEqual(self.request('/v1/ada-events?site=example.com', project='project-b')[1]['events'], [])
        self.assertEqual(self.request('/v1/ada-events?site=other.example')[1]['events'], [])
        self.assertEqual(self.request('/v1/ada-events?site=example.com&limit=101')[0], 400)
        self.assertEqual(self.request('/v1/ada-events')[0], 400)

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

    def test_project_scope_is_required_for_authenticated_gateway_calls(self):
        status,body=self.request('/v1/providers',project=None)
        self.assertEqual(status,400)
        self.assertEqual(body['error'],'invalid_project_scope')

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

    def test_ga4_data_api_sync_requires_explicit_project_site_mapping(self):
        status,test=self.request('/v1/providers/ga4/test','POST',{})
        self.assertEqual(status,200); self.assertTrue(test['ok'])
        status,refresh=self.request('/v1/sites/example.com/refresh','POST',{'sources':['ga4'],'window':'7d','idempotencyKey':'ga4-1'})
        self.assertEqual(status,202)
        run=refresh['runs'][0]
        self.assertEqual(run['status'],'completed')
        self.assertGreaterEqual(run['rows_written'],5)
        self.assertEqual(run['resource_ref'],'properties/100')
        _,metrics=self.request('/v1/metrics?provider=ga4&site=example.com&dataset=summary')
        self.assertEqual(len(metrics['rows']),1)
        self.assertEqual(metrics['rows'][0]['metrics']['sessions'],14.0)
        self.assertEqual(metrics['coverage']['ranges'][0]['start'],metrics['rows'][0]['dimensions']['startDate'])
        _,snapshot=self.request('/v1/sites/example.com/snapshot?window=7d')
        self.assertEqual(snapshot['ga4']['sessions'],14.0)
        self.assertEqual(snapshot['ga4']['keyEvents'],2.0)

        status,foreign=self.request('/v1/sites/example.com/refresh','POST',{'sources':['ga4'],'window':'7d','idempotencyKey':'ga4-foreign'},project='project-b')
        self.assertEqual(status,202)
        self.assertEqual(foreign['runs'][0]['status'],'blocked')
        self.assertEqual(foreign['runs'][0]['error_class'],'ga4_property_not_mapped')
        _,foreign_metrics=self.request('/v1/metrics?provider=ga4&site=example.com&dataset=summary',project='project-b')
        self.assertEqual(foreign_metrics['rows'],[])

    def test_repeated_refresh_is_idempotent_with_caller_key(self):
        payload={'sources':['semrush'],'window':'same-window','idempotencyKey':'retry-1'}
        _,first=self.request('/v1/sites/example.com/refresh','POST',payload)
        _,second=self.request('/v1/sites/example.com/refresh','POST',payload)
        self.assertTrue(first['runs'][0]['created'])
        self.assertTrue(second['runs'][0]['coalesced'])

    def test_metrics_and_snapshots_are_project_isolated(self):
        status,refresh=self.request('/v1/sites/example.com/refresh','POST',{'sources':['gsc'],'window':'7d','idempotencyKey':'project-metrics'},project='project-a')
        self.assertEqual(status,202)
        _,metrics_a=self.request('/v1/metrics?provider=gsc&site=example.com&dataset=site_daily',project='project-a')
        _,metrics_b=self.request('/v1/metrics?provider=gsc&site=example.com&dataset=site_daily',project='project-b')
        self.assertEqual(len(metrics_a['rows']),2)
        self.assertEqual(metrics_b['rows'],[])

    def test_metric_date_range_is_applied_before_limit_and_rejects_invalid_ranges(self):
        self.request('/v1/sites/example.com/refresh','POST',{'sources':['gsc'],'window':'7d'})
        newest=(date.today()-timedelta(days=2)).isoformat()
        _,body=self.request(f'/v1/metrics?provider=gsc&site=example.com&dataset=site_daily&start={newest}&end={newest}&limit=1')
        self.assertEqual(len(body['rows']),1)
        self.assertEqual(body['rows'][0]['data_date'],newest)
        oldest=(date.today()-timedelta(days=3)).isoformat()
        _,body=self.request(f'/v1/metrics?provider=gsc&site=example.com&dataset=site_daily&start={oldest}&end={oldest}&limit=1')
        self.assertEqual(body['rows'][0]['data_date'],oldest)
        status,body=self.request('/v1/metrics?start=invalid&end=2026-09-30')
        self.assertEqual(status,400)
        self.assertEqual(body['error'],'invalid_date_range')
        status,_=self.request('/v1/metrics?start=2026-09-30&end=2026-09-01')
        self.assertEqual(status,400)

    def test_metric_coverage_comes_from_successful_scoped_sync_ranges(self):
        self.request('/v1/sites/example.com/refresh','POST',{'sources':['gsc'],'window':'7d'})
        end=(date.today()-timedelta(days=2)).isoformat()
        start=(date.today()-timedelta(days=8)).isoformat()
        _,body=self.request(f'/v1/metrics?provider=gsc&site=example.com&dataset=site_daily&start={start}&end={end}')
        self.assertEqual(body.get('coverage',{}).get('ranges'),[{'start':start,'end':end}])
        _,other=self.request(f'/v1/metrics?provider=gsc&site=example.com&dataset=site_daily&start={start}&end={end}',project='project-b')
        self.assertEqual(other.get('coverage',{}).get('ranges'),[])

    def test_gsc_monitor_concurrent_requests_do_not_race_investigation_insert(self):
        with sqlite3.connect(self.db_path) as connection:
            for day in range(1,15):
                recent=day>7
                clicks=2 if recent else 10
                impressions=40 if recent else 100
                data_date=(date.today()-timedelta(days=14-day)).isoformat()
                dimensions=json.dumps({'date':data_date},separators=(',',':'),sort_keys=True)
                metrics=json.dumps({'clicks':clicks,'impressions':impressions,'ctr':clicks/impressions,'position':20},separators=(',',':'),sort_keys=True)
                connection.execute('insert into provider_metric (id,project_id,provider,site,dataset,data_date,dimensions,metrics,freshness,sync_run_id,updated_at) values(?,?,?,?,?,?,?,?,?,?,?)',
                    (f'concurrent-monitor-{day}','project-a','gsc','concurrent.example','site_daily',data_date,dimensions,metrics,'2026-09-14','monitor-run','2026-09-21T00:00:00Z'))
        barrier=threading.Barrier(8); results=[]; errors=[]
        def invoke():
            try:
                barrier.wait(timeout=5)
                results.append(self.request('/v1/monitor/gsc','POST',{}))
            except Exception as exc:
                errors.append(exc)
        workers=[threading.Thread(target=invoke) for _ in range(8)]
        for w in workers: w.start()
        for w in workers: w.join(timeout=10)
        self.assertEqual(errors,[])
        self.assertTrue(all(status==200 for status,_ in results))
        status,body=self.request('/v1/investigations?site=concurrent.example&status=open')
        self.assertEqual(status,200)
        self.assertEqual(len(body['investigations']),2)

    def test_bearer_credentials_are_redacted_everywhere(self):
        FakeGoogle.leak_authorization_error='Authorization: Bearer provider-secret-123'
        try:
            status,body=self.request('/v1/sites/example.com/refresh','POST',{'sources':['gsc'],'window':'7d','idempotencyKey':'redact-bearer-header'})
            self.assertEqual(status,202)
            self.assertNotIn('provider-secret-123',body['runs'][0]['error_message_safe'])
            self.assertIn('<redacted>',body['runs'][0]['error_message_safe'])
        finally:
            FakeGoogle.leak_authorization_error=False

    def test_portfolio_mapping_is_explicit_and_normalized(self):
        mapping=project_site_map({'MS_ROBOT_PROJECT_SITE_MAP_JSON':json.dumps({'https://www.Example.com/':'project-a','sc-domain:second.example':'project-b'})})
        self.assertEqual(mapping,{'example.com':'project-a','second.example':'project-b'})
        with self.assertRaises(SystemExit):
            project_site_map({})

    def test_monitor_bridge_refuses_unscoped_signal(self):
        with self.assertRaisesRegex(RuntimeError,'monitor_signal_missing_project_id'):
            bridge_event({'site':'example.com','signalType':'traffic_click_drop','evidence':{}},'open')

if __name__=='__main__': unittest.main()
