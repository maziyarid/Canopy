import json, os, socket, subprocess, tempfile, time, unittest, urllib.error, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parent
GATEWAY=ROOT/'gateway.py'

def free_port():
    s=socket.socket(); s.bind(('127.0.0.1',0)); p=s.getsockname()[1]; s.close(); return p

class GatewayTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.port=free_port(); self.token='test-token'
        env=os.environ.copy()
        env.update(ANALYTICS_GATEWAY_PORT=str(self.port), ANALYTICS_GATEWAY_TOKEN=self.token,
                   ANALYTICS_GATEWAY_DB=str(Path(self.tmp.name)/'state.sqlite3'))
        self.proc=subprocess.Popen(['python3',str(GATEWAY)],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                urllib.request.urlopen(f'http://127.0.0.1:{self.port}/health',timeout=.2); break
            except Exception: time.sleep(.05)

    def tearDown(self):
        self.proc.terminate(); self.proc.wait(timeout=5); self.tmp.cleanup()
    def request(self,path,method='GET',body=None,auth=True):
        headers={}
        if auth: headers['Authorization']='Bearer '+self.token
        data=None
        if body is not None:
            data=json.dumps(body).encode(); headers['Content-Type']='application/json'
        req=urllib.request.Request(f'http://127.0.0.1:{self.port}{path}',data=data,headers=headers,method=method)
        try:
            with urllib.request.urlopen(req,timeout=2) as r: return r.status,json.load(r)
        except urllib.error.HTTPError as e: return e.code,json.load(e)

    def test_auth_and_provider_state(self):
        status,body=self.request('/v1/providers',auth=False)
        self.assertEqual(status,401); self.assertEqual(body['error'],'unauthorized')
        status,body=self.request('/v1/providers')
        self.assertEqual(status,200)
        self.assertTrue(all(p['status']=='not_configured' for p in body['providers']))

    def test_unconfigured_refresh_is_blocked_not_stuck(self):
        status,body=self.request('/v1/sites/example.com/refresh','POST',{'sources':['gsc','ga4']})
        self.assertEqual(status,202); self.assertEqual(body['accepted'],['gsc','ga4'])
        _,ledger=self.request('/v1/sync-runs?limit=10')
        self.assertEqual({r['status'] for r in ledger['runs']},{'blocked'})
        self.assertEqual({r['error_class'] for r in ledger['runs']},{'not_configured'})

if __name__=='__main__': unittest.main()