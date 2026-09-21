#!/usr/bin/env python3
import json, os, sqlite3, time, uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

HOST=os.getenv('ANALYTICS_GATEWAY_HOST','127.0.0.1')
PORT=int(os.getenv('ANALYTICS_GATEWAY_PORT','9120'))
DB=os.getenv('ANALYTICS_GATEWAY_DB','/var/lib/ms-robot-analytics/state.sqlite3')
TOKEN=os.getenv('ANALYTICS_GATEWAY_TOKEN','')
PROVIDERS=['gsc','ga4','gtm','clarity','bing_webmaster','semrush','ubersuggest','mangools']

def now(): return datetime.now(timezone.utc).isoformat()
def db():
    c=sqlite3.connect(DB,timeout=15)
    c.row_factory=sqlite3.Row
    return c

def init_db():
    os.makedirs(os.path.dirname(DB),exist_ok=True)
    with db() as c:
        c.executescript('''
        create table if not exists provider_state(
          provider text primary key, status text not null, auth_type text not null default '',
          capability text not null default 'read', last_success text, last_attempt text,
          last_error text, freshness text, enabled integer not null default 1, updated_at text not null);
        create table if not exists sync_run(
          id text primary key, provider text not null, site text not null, window text not null,
          status text not null, retry_count integer not null default 0, rows_written integer not null default 0,
          idempotency_key text not null unique, started_at text not null, finished_at text, error_class text);
        ''')
        for p in PROVIDERS:
            c.execute('insert or ignore into provider_state(provider,status,updated_at) values(?,?,?)',(p,'not_configured',now()))

def safe_provider_rows():
    with db() as c:
        return [dict(r) for r in c.execute('select provider,status,auth_type,capability,last_success,last_attempt,last_error,freshness,enabled,updated_at from provider_state order by provider')]

def health_for(source):
    with db() as c:
        r=c.execute('select * from provider_state where provider=?',(source,)).fetchone()
    if not r: return {'source':source,'status':'not_configured'}
    status=r['status'] if r['status'] in ('ok','stale','error','not_configured') else 'error'
    out={'source':source,'status':status}
    if r['last_attempt']: out['checkedAt']=r['last_attempt']
    if r['last_success']: out['lastSuccessfulSync']=r['last_success']
    if r['last_error']: out['message']=r['last_error'][:300]
    return out

class H(BaseHTTPRequestHandler):
    server_version='MsRobotAnalytics/0.1'
    def log_message(self, fmt, *args):
        print('%s %s'%(self.address_string(),fmt%args),flush=True)
    def sendj(self,code,obj):
        b=json.dumps(obj,separators=(',',':')).encode()
        self.send_response(code)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(b)))
        self.end_headers(); self.wfile.write(b)
    def authed(self):
        if not TOKEN: return False
        return self.headers.get('Authorization','') == 'Bearer '+TOKEN
    def guard(self):
        if self.authed(): return True
        self.sendj(401,{'error':'unauthorized'}); return False
    def do_GET(self):
        u=urlparse(self.path)
        if u.path=='/health':
            self.sendj(200,{'ok':True,'service':'ms-robot-analytics','time':now()}); return
        if not self.guard(): return
        if u.path=='/v1/providers':
            self.sendj(200,{'providers':safe_provider_rows(),'generatedAt':now()}); return
        if u.path=='/v1/sync-runs':
            limit=max(1,min(200,int(parse_qs(u.query).get('limit',['50'])[0])))
            with db() as c:
                rows=[dict(r) for r in c.execute('select * from sync_run order by started_at desc limit ?',(limit,))]
            self.sendj(200,{'runs':rows}); return
        parts=[unquote(x) for x in u.path.strip('/').split('/')]
        if len(parts)==4 and parts[0]=='v1' and parts[1]=='sites' and parts[3]=='snapshot':
            site=parts[2]; window=parse_qs(u.query).get('window',['7d'])[0]
            self.sendj(200,{'site':site,'generatedAt':now(),'window':window,
                'health':[health_for('gsc'),health_for('ga4'),health_for('clarity')],
                'warnings':['Provider metrics are unavailable until credentials are configured.']}); return
        self.sendj(404,{'error':'not_found'})
    def do_POST(self):
        if not self.guard(): return
        u=urlparse(self.path)
        parts=[unquote(x) for x in u.path.strip('/').split('/')]
        if len(parts)==4 and parts[0]=='v1' and parts[1]=='sites' and parts[3]=='refresh':
            site=parts[2]
            n=int(self.headers.get('Content-Length','0') or 0)
            try: body=json.loads(self.rfile.read(n) or b'{}')
            except Exception: self.sendj(400,{'error':'invalid_json'}); return
            requested=body.get('sources') or ['gsc','ga4','clarity']
            accepted=[p for p in requested if p in ('gsc','ga4','clarity')]
            queued=now()
            with db() as c:
                for p in accepted:
                    key=f'{site}:{p}:{queued[:16]}'
                    state=c.execute('select status from provider_state where provider=?',(p,)).fetchone()
                    ready=bool(state and state['status'] in ('ok','stale'))
                    status='queued' if ready else 'blocked'
                    error=None if ready else 'not_configured'
                    finished=None if ready else queued
                    c.execute('insert or ignore into sync_run(id,provider,site,window,status,idempotency_key,started_at,finished_at,error_class) values(?,?,?,?,?,?,?,?,?)',
                              (str(uuid.uuid4()),p,site,'default',status,key,queued,finished,error))
                    c.execute('update provider_state set last_attempt=?, updated_at=? where provider=?',(queued,queued,p))
            self.sendj(202,{'site':site,'accepted':accepted,'queuedAt':queued}); return
        self.sendj(404,{'error':'not_found'})

def main():
    if not TOKEN: raise SystemExit('ANALYTICS_GATEWAY_TOKEN is required')
    init_db()
    s=ThreadingHTTPServer((HOST,PORT),H)
    print(f'ms-robot-analytics listening on {HOST}:{PORT}',flush=True)
    s.serve_forever()

if __name__=='__main__': main()