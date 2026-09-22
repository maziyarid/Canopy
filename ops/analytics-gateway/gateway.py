#!/usr/bin/env python3
import json, os, re, sqlite3, uuid
from datetime import date, datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, unquote, urlparse
from urllib.request import Request, urlopen
from gsc_monitor import ensure_schema as ensure_monitor_schema, list_investigations, run_monitor
from sqlite_migrations import ensure_analytics_schema

HOST=os.getenv('ANALYTICS_GATEWAY_HOST','127.0.0.1')
PORT=int(os.getenv('ANALYTICS_GATEWAY_PORT','9120'))
DB=os.getenv('ANALYTICS_GATEWAY_DB','/var/lib/ms-robot-analytics/state.sqlite3')
TOKEN=os.getenv('ANALYTICS_GATEWAY_TOKEN','')
GOOGLE_PROVIDER_URL=os.getenv('GOOGLE_PROVIDER_URL','').rstrip('/')
GOOGLE_PROVIDER_TOKEN=os.getenv('GOOGLE_PROVIDER_TOKEN','')
CODE_VERSION=os.getenv('MS_ROBOT_CODE_VERSION') or os.getenv('GIT_SHA') or 'unknown'
PROVIDERS=['gsc','ga4','gtm','clarity','bing_webmaster','semrush','ubersuggest','mangools']

def now(): return datetime.now(timezone.utc).isoformat()
def db():
    c=sqlite3.connect(DB,timeout=15)
    c.row_factory=sqlite3.Row
    return c

def init_db():
    ensure_analytics_schema(DB)

def ensure_project_provider_state(c,project_id):
    stamp=now()
    for provider in PROVIDERS:
        c.execute(
            'insert or ignore into provider_state(project_id,provider,status,updated_at) values(?,?,?,?)',
            (project_id,provider,'not_configured',stamp),
        )

def safe_provider_rows(project_id):
    with db() as c:
        ensure_project_provider_state(c,project_id)
        return [dict(r) for r in c.execute(
            '''select provider,status,auth_type,capability,last_success,last_attempt,last_error,
                      freshness,enabled,updated_at
               from provider_state where project_id=? order by provider''',
            (project_id,),
        )]

def health_for(project_id,source):
    with db() as c:
        ensure_project_provider_state(c,project_id)
        r=c.execute(
            'select * from provider_state where project_id=? and provider=?',
            (project_id,source),
        ).fetchone()
    if not r: return {'source':source,'status':'not_configured'}
    status=r['status'] if r['status'] in ('ok','stale','error','not_configured') else 'error'
    out={'source':source,'status':status}
    if r['last_attempt']: out['checkedAt']=r['last_attempt']
    if r['last_success']: out['lastSuccessfulSync']=r['last_success']
    if r['last_error']: out['message']=r['last_error'][:300]
    return out

def google_request(path,method='GET',body=None,timeout=30):
    if not GOOGLE_PROVIDER_URL or not GOOGLE_PROVIDER_TOKEN:
        raise RuntimeError('google_provider_not_configured')
    payload=None if body is None else json.dumps(body,separators=(',',':')).encode()
    headers={'Accept':'application/json','Authorization':'Bearer '+GOOGLE_PROVIDER_TOKEN}
    if payload is not None: headers['Content-Type']='application/json'
    req=Request(GOOGLE_PROVIDER_URL+path,data=payload,headers=headers,method=method)
    try:
        with urlopen(req,timeout=timeout) as response:
            return json.load(response)
    except HTTPError as e:
        try: detail=json.load(e).get('error','google_provider_http_error')
        except Exception: detail='google_provider_http_error'
        raise RuntimeError(f'google_provider_{e.code}:{str(detail)[:300]}')
    except URLError as e:
        raise RuntimeError('google_provider_unreachable:'+str(e.reason)[:200])

def normalise_domain(site):
    raw=str(site or '').strip()
    if raw.startswith('sc-domain:'): return raw[len('sc-domain:'):].lower().rstrip('.')
    if '://' in raw:
        return (urlparse(raw).hostname or '').lower().removeprefix('www.').rstrip('.')
    return raw.lower().removeprefix('www.').strip('/').rstrip('.')

def resolve_gsc_property(site,sites):
    raw=str(site or '').strip()
    entries=[x for x in sites if x.get('siteUrl')]
    if any(x['siteUrl']==raw for x in entries): return raw
    domain=normalise_domain(raw)
    preferred='sc-domain:'+domain
    if any(x['siteUrl']==preferred for x in entries): return preferred
    for entry in entries:
        candidate=entry['siteUrl']
        if normalise_domain(candidate)==domain: return candidate
    raise RuntimeError('gsc_property_not_authorised:'+domain)

def window_dates(window):
    match=re.fullmatch(r'(\d{1,3})d',str(window or ''))
    days=int(match.group(1)) if match else 28
    days=max(1,min(90,days))
    end=date.today()-timedelta(days=2)
    start=end-timedelta(days=days-1)
    return start.isoformat(),end.isoformat()

def ledger_window_dates(window):
    match=re.fullmatch(r'(\d{1,3})d',str(window or ''))
    if not match:
        return None,None
    return window_dates(window)

def connection_test_gsc(project_id):
    checked=now()
    try:
        payload=google_request('/v1/sites')
        sites=payload.get('sites',[])
        with db() as c:
            ensure_project_provider_state(c,project_id)
            c.execute('''update provider_state set status='ok',auth_type='service_account',
                         capability='read',last_attempt=?,last_error=null,updated_at=?
                         where project_id=? and provider='gsc' ''',(checked,checked,project_id))
        return {'provider':'gsc','ok':True,'siteCount':len(sites),'sites':sites,'checkedAt':checked}
    except Exception as e:
        message=safe_error_message(e)
        with db() as c:
            ensure_project_provider_state(c,project_id)
            c.execute('''update provider_state set status='error',auth_type='service_account',
                         last_attempt=?,last_error=?,updated_at=?
                         where project_id=? and provider='gsc' ''',
                      (checked,message,checked,project_id))
        raise

def connection_test_google_discovery(project_id,provider):
    checked=now()
    paths={'ga4':'/v1/ga4/accounts','gtm':'/v1/gtm/accounts'}
    if provider not in paths:
        return 409,{'provider':provider,'ok':False,'error':'connection_test_not_implemented'}
    try:
        payload=google_request(paths[provider])
        accounts=payload.get('accounts',[])
        ok=bool(accounts)
        status='ok' if ok else 'not_configured'
        error=None if ok else 'no_authorised_accounts'
        with db() as c:
            ensure_project_provider_state(c,project_id)
            c.execute('''update provider_state set status=?,auth_type='service_account',
                         capability='read',last_attempt=?,last_error=?,updated_at=?
                         where project_id=? and provider=?''',
                      (status,checked,error,checked,project_id,provider))
        return (200 if ok else 409),{
            'provider':provider,'ok':ok,'accountCount':len(accounts),
            'accounts':accounts,'checkedAt':checked,'error':error}
    except Exception as e:
        message=safe_error_message(e)
        blocked=message.startswith('google_provider_403:') or message=='google_provider_not_configured'
        status='not_configured' if blocked else 'error'
        with db() as c:
            ensure_project_provider_state(c,project_id)
            c.execute('''update provider_state set status=?,auth_type='service_account',
                         capability='read',last_attempt=?,last_error=?,updated_at=?
                         where project_id=? and provider=?''',
                      (status,checked,message,checked,project_id,provider))
        return (409 if blocked else 502),{
            'provider':provider,'ok':False,'checkedAt':checked,'error':message}

def safe_error_message(error):
    message=str(error)
    # Redact compound auth schemes first. A generic "authorization" pass would
    # otherwise consume only the word "Bearer" and leave the credential behind.
    message=re.sub(
        r"(?i)(authorization[\"']?\s*[:=]\s*[\"']?\s*bearer\s+)[^\"'\s&,;}]+",
        r'\1<redacted>',
        message,
    )
    message=re.sub(
        r"(?i)(bearer\s+)[^\s&,;]+",
        r'\1<redacted>',
        message,
    )
    secret_names=(
        r'authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|'
        r'id[_-]?token|client[_-]?secret|private[_-]?key|password|passwd|cookie|'
        r'set-cookie|session[_-]?(?:id|token)?'
    )
    message=re.sub(
        rf"(?i)({secret_names})([\s:=\"']+)[^\s&,;]+",
        r'\1\2<redacted>',
        message,
    )
    message=re.sub(
        r'(?i)([?&](?:key|token|access_token|refresh_token|id_token|api_key|session)=)[^&\s]+',
        r'\1<redacted>',
        message,
    )
    return message[:500]

def upsert_metric(c,project_id,provider,site,dataset,data_date,dimensions,metrics,freshness,run_id,stamp):
    dims=json.dumps(dimensions,separators=(',',':'),sort_keys=True)
    vals=json.dumps(metrics,separators=(',',':'),sort_keys=True)
    inserted=c.execute('''insert or ignore into provider_metric
      (id,project_id,provider,site,dataset,data_date,dimensions,metrics,freshness,sync_run_id,updated_at)
      values(?,?,?,?,?,?,?,?,?,?,?)''',
      (str(uuid.uuid4()),project_id,provider,site,dataset,data_date,dims,vals,freshness,run_id,stamp)).rowcount
    if inserted:
        return 'inserted'
    c.execute('''update provider_metric
      set metrics=?,freshness=?,sync_run_id=?,updated_at=?
      where project_id=? and provider=? and site=? and dataset=? and data_date=? and dimensions=?''',
      (vals,freshness,run_id,stamp,project_id,provider,site,dataset,data_date,dims))
    return 'updated'

def run_gsc_sync(project_id,site,window,run_id):
    start_date,end_date=window_dates(window)
    sites_payload=google_request('/v1/sites')
    property_url=resolve_gsc_property(site,sites_payload.get('sites',[]))
    daily=google_request('/v1/gsc/search-analytics','POST',{
        'siteUrl':property_url,'startDate':start_date,'endDate':end_date,
        'dimensions':['date'],'rowLimit':5000,'type':'web'})
    query_page=google_request('/v1/gsc/search-analytics','POST',{
        'siteUrl':property_url,'startDate':start_date,'endDate':end_date,
        'dimensions':['query','page'],'rowLimit':1000,'type':'web'})
    sitemaps=google_request('/v1/gsc/sitemaps?siteUrl='+quote(property_url,safe=''))
    stamp=now(); received=len(daily.get('rows',[]))+len(query_page.get('rows',[])); inserted=0; updated=0; skipped=0
    with db() as c:
        for row in daily.get('rows',[]):
            keys=row.get('keys') or []
            if not keys:
                skipped+=1
                continue
            metrics={k:row.get(k,0) for k in ('clicks','impressions','ctr','position')}
            outcome=upsert_metric(c,project_id,'gsc',site,'site_daily',str(keys[0]),{'date':str(keys[0])},metrics,end_date,run_id,stamp)
            inserted+=outcome=='inserted'; updated+=outcome=='updated'
        for row in query_page.get('rows',[]):
            keys=row.get('keys') or []
            if len(keys)<2:
                skipped+=1
                continue
            metrics={k:row.get(k,0) for k in ('clicks','impressions','ctr','position')}
            outcome=upsert_metric(c,project_id,'gsc',site,'query_page',end_date,
                          {'query':str(keys[0]),'page':str(keys[1])},metrics,end_date,run_id,stamp)
            inserted+=outcome=='inserted'; updated+=outcome=='updated'
        c.execute('''insert into provider_snapshot(project_id,provider,site,dataset,payload,freshness,sync_run_id,updated_at)
                     values(?,'gsc',?,'sitemaps',?,?,?,?)
                     on conflict(project_id,provider,site,dataset) do update set payload=excluded.payload,
                       freshness=excluded.freshness,sync_run_id=excluded.sync_run_id,updated_at=excluded.updated_at''',
                  (project_id,site,json.dumps(sitemaps,separators=(',',':')),end_date,run_id,stamp))
        c.execute('''insert into provider_snapshot(project_id,provider,site,dataset,payload,freshness,sync_run_id,updated_at)
                     values(?,'gsc',?,'property',?,?,?,?)
                     on conflict(project_id,provider,site,dataset) do update set payload=excluded.payload,
                       freshness=excluded.freshness,sync_run_id=excluded.sync_run_id,updated_at=excluded.updated_at''',
                  (project_id,site,json.dumps({'siteUrl':property_url},separators=(',',':')),end_date,run_id,stamp))
    return {
        'requested_start':start_date,'requested_end':end_date,
        'rows_received':received,'rows_inserted':inserted,'rows_updated':updated,
        'rows_skipped':skipped,'rows_written':inserted+updated,
        'data_freshness':end_date,'resource_ref':property_url,
        'cursor_before':'','cursor_after':'','rate_limit_state':'','quota_state':'',
    }

def sync_provider(project_id,provider,site,window,run_id):
    if provider=='gsc':
        if not GOOGLE_PROVIDER_URL or not GOOGLE_PROVIDER_TOKEN:
            raise RuntimeError('not_configured')
        return run_gsc_sync(project_id,site,window,run_id)
    with db() as c:
        ensure_project_provider_state(c,project_id)
        state=c.execute(
            'select status from provider_state where project_id=? and provider=?',
            (project_id,provider),
        ).fetchone()
    if not state or state['status']=='not_configured':
        raise RuntimeError('not_configured')
    raise RuntimeError('adapter_not_implemented')

def create_or_run_sync(project_id,provider,site,window,started,request_key=None):
    suffix=request_key.strip() if isinstance(request_key,str) and request_key.strip() else str(uuid.uuid4())
    key=f'{project_id}:{site}:{provider}:{window}:{suffix}'
    run_id=str(uuid.uuid4())
    requested_start,requested_end=ledger_window_dates(window)
    with db() as c:
        ensure_project_provider_state(c,project_id)
        c.execute('''insert into sync_run(
                     id,project_id,provider,site,window,requested_start,requested_end,status,
                     idempotency_key,code_version,started_at)
                     values(?,?,?,?,?,?,?,?,?,?,?)
                     on conflict(project_id,idempotency_key) do nothing''',
                  (run_id,project_id,provider,site,window,requested_start,requested_end,'running',
                   key,CODE_VERSION,started))
        row=c.execute(
            'select * from sync_run where project_id=? and idempotency_key=?',
            (project_id,key),
        ).fetchone()
        if not row:
            raise RuntimeError('sync_receipt_insert_failed')
        if row['id']!=run_id:
            return dict(row),False
        c.execute('''update provider_state set last_attempt=?,updated_at=?
                     where project_id=? and provider=?''',
                  (started,started,project_id,provider))
    try:
        result=sync_provider(project_id,provider,site,window,run_id)
        finished=now()
        freshness=result.get('data_freshness')
        with db() as c:
            c.execute('''update sync_run set status='completed',
                         requested_start=?,requested_end=?,cursor_before=?,cursor_after=?,
                         rows_received=?,rows_inserted=?,rows_updated=?,rows_skipped=?,rows_written=?,
                         rate_limit_state=?,quota_state=?,data_freshness=?,
                         finished_at=?,error_class=null,error_message_safe=null,code_version=?
                         where id=? and project_id=?''',
                      (result.get('requested_start'),result.get('requested_end'),
                       result.get('cursor_before',''),result.get('cursor_after',''),
                       int(result.get('rows_received',0)),int(result.get('rows_inserted',0)),
                       int(result.get('rows_updated',0)),int(result.get('rows_skipped',0)),
                       int(result.get('rows_written',0)),result.get('rate_limit_state',''),
                       result.get('quota_state',''),freshness,finished,CODE_VERSION,run_id,project_id))
            c.execute('''update provider_state set status='ok',auth_type=?,
                         last_success=?,last_attempt=?,last_error=null,freshness=?,updated_at=?
                         where project_id=? and provider=?''',
                      ('service_account' if provider=='gsc' else '',finished,started,freshness,finished,
                       project_id,provider))
            row=c.execute(
                'select * from sync_run where id=? and project_id=?',
                (run_id,project_id),
            ).fetchone()
        return dict(row),True
    except Exception as e:
        finished=now()
        message=safe_error_message(e)
        error_class='not_configured' if message=='not_configured' else (
            'adapter_not_implemented' if message=='adapter_not_implemented' else
            ('property_not_authorised' if message.startswith('gsc_property_not_authorised') else 'provider_error'))
        status='blocked' if error_class in ('not_configured','adapter_not_implemented') else 'error'
        with db() as c:
            c.execute('''update sync_run set status=?,finished_at=?,error_class=?,
                         error_message_safe=?,code_version=? where id=? and project_id=?''',
                      (status,finished,error_class,message,CODE_VERSION,run_id,project_id))
            if error_class=='not_configured':
                c.execute('''update provider_state set status='not_configured',last_attempt=?,last_error=?,
                             updated_at=? where project_id=? and provider=?''',
                          (started,message,finished,project_id,provider))
            else:
                c.execute('''update provider_state set status='error',last_attempt=?,last_error=?,
                             updated_at=? where project_id=? and provider=?''',
                          (started,message,finished,project_id,provider))
            row=c.execute(
                'select * from sync_run where id=? and project_id=?',
                (run_id,project_id),
            ).fetchone()
        return dict(row),True

def metric_rows(project_id,provider,site,dataset,limit=500):
    sql='''select provider,site,dataset,data_date,dimensions,metrics,freshness,sync_run_id,updated_at
           from provider_metric where project_id=?'''
    params=[project_id]
    for column,value in [('provider',provider),('site',site),('dataset',dataset)]:
        if value:
            sql+=f' and {column}=?'; params.append(value)
    sql+=' order by data_date desc,updated_at desc limit ?'; params.append(limit)
    with db() as c:
        rows=c.execute(sql,params).fetchall()
    out=[]
    for row in rows:
        item=dict(row)
        item['dimensions']=json.loads(item['dimensions'] or '{}')
        item['metrics']=json.loads(item['metrics'] or '{}')
        out.append(item)
    return out

def gsc_summary(project_id,site,window):
    start_date,end_date=window_dates(window)
    with db() as c:
        rows=c.execute('''select metrics from provider_metric
                          where project_id=? and provider='gsc' and site=? and dataset='site_daily'
                            and data_date between ? and ?''',
                       (project_id,site,start_date,end_date)).fetchall()
    if not rows: return None
    clicks=impressions=position_weight=0.0
    for row in rows:
        m=json.loads(row['metrics'] or '{}')
        c=float(m.get('clicks') or 0); i=float(m.get('impressions') or 0); pos=float(m.get('position') or 0)
        clicks+=c; impressions+=i; position_weight+=pos*i
    return {
        'clicks':clicks,'impressions':impressions,
        'ctr':(clicks/impressions if impressions else 0),
        'averagePosition':(position_weight/impressions if impressions else 0),
    }

class H(BaseHTTPRequestHandler):
    server_version='MsRobotAnalytics/0.2'
    def log_message(self,fmt,*args):
        print('%s %s'%(self.address_string(),fmt%args),flush=True)
    def sendj(self,code,obj):
        b=json.dumps(obj,separators=(',',':')).encode()
        self.send_response(code); self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(b))); self.send_header('Cache-Control','no-store')
        self.end_headers(); self.wfile.write(b)
    def authed(self):
        return bool(TOKEN) and self.headers.get('Authorization','')=='Bearer '+TOKEN
    def guard(self):
        if self.authed(): return True
        self.sendj(401,{'error':'unauthorized'}); return False
    def project_scope(self):
        project_id=self.headers.get('X-Ms-Robot-Project-Id','').strip()
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:-]{0,127}',project_id):
            self.sendj(400,{'error':'invalid_project_scope'})
            return None
        return project_id
    def read_json(self):
        n=max(0,min(1_000_000,int(self.headers.get('Content-Length','0') or 0)))
        return json.loads(self.rfile.read(n) or b'{}')
    def do_GET(self):
        u=urlparse(self.path)
        if u.path=='/health':
            self.sendj(200,{'ok':True,'service':'ms-robot-analytics','time':now()}); return
        if not self.guard(): return
        project_id=self.project_scope()
        if project_id is None: return
        if u.path=='/v1/providers':
            self.sendj(200,{'providers':safe_provider_rows(project_id),'generatedAt':now()}); return
        if u.path=='/v1/sync-runs':
            try:
                limit=max(1,min(200,int(parse_qs(u.query).get('limit',['50'])[0])))
            except (TypeError,ValueError):
                self.sendj(400,{'error':'invalid_limit'}); return
            with db() as c:
                rows=[dict(r) for r in c.execute(
                    'select * from sync_run where project_id=? order by started_at desc limit ?',
                    (project_id,limit),
                )]
            self.sendj(200,{'runs':rows}); return
        if u.path=='/v1/metrics':
            q=parse_qs(u.query)
            try: limit=max(1,min(2000,int(q.get('limit',['500'])[0])))
            except Exception: limit=500
            rows=metric_rows(project_id,q.get('provider',[''])[0],q.get('site',[''])[0],q.get('dataset',[''])[0],limit)
            self.sendj(200,{'rows':rows,'generatedAt':now()}); return
        if u.path=='/v1/investigations':
            q=parse_qs(u.query)
            try: limit=max(1,min(500,int(q.get('limit',['100'])[0])))
            except Exception: limit=100
            rows=list_investigations(DB,project_id,q.get('site',[''])[0],q.get('status',[''])[0],limit)
            self.sendj(200,{'investigations':rows,'generatedAt':now()}); return
        parts=[unquote(x) for x in u.path.strip('/').split('/')]
        if len(parts)==4 and parts[0]=='v1' and parts[1]=='sites' and parts[3]=='snapshot':
            site=parts[2]; window=parse_qs(u.query).get('window',['7d'])[0]
            gsc=gsc_summary(project_id,site,window)
            warnings=[]
            if not gsc: warnings.append('No GSC metric rows are stored for this window.')
            if health_for(project_id,'ga4')['status']=='not_configured': warnings.append('GA4 is not configured.')
            if health_for(project_id,'clarity')['status']=='not_configured': warnings.append('Clarity is not configured.')
            payload={'site':site,'generatedAt':now(),'window':window,
                     'health':[health_for(project_id,'gsc'),health_for(project_id,'ga4'),health_for(project_id,'clarity')],
                     'warnings':warnings}
            if gsc: payload['gsc']=gsc
            self.sendj(200,payload); return
        self.sendj(404,{'error':'not_found'})
    def do_POST(self):
        if not self.guard(): return
        project_id=self.project_scope()
        if project_id is None: return
        u=urlparse(self.path)
        parts=[unquote(x) for x in u.path.strip('/').split('/')]
        if len(parts)==4 and parts[0]=='v1' and parts[1]=='providers' and parts[3]=='test':
            provider=parts[2]
            if provider=='gsc':
                try:
                    self.sendj(200,connection_test_gsc(project_id))
                except Exception as e:
                    self.sendj(502,{'provider':'gsc','ok':False,'error':safe_error_message(e)[:300]})
                return
            code,result=connection_test_google_discovery(project_id,provider)
            self.sendj(code,result); return
        if u.path=='/v1/monitor/gsc':
            self.sendj(200,run_monitor(DB,project_id)); return
        if len(parts)==4 and parts[0]=='v1' and parts[1]=='sites' and parts[3]=='refresh':
            site=parts[2]
            try: body=self.read_json()
            except Exception: self.sendj(400,{'error':'invalid_json'}); return
            requested=body.get('sources') or ['gsc','ga4','clarity']
            accepted=[p for p in requested if p in PROVIDERS]
            window=str(body.get('window') or '28d')[:80]
            request_key=body.get('idempotencyKey')
            if request_key is not None:
                request_key=str(request_key).strip()
                if not request_key or len(request_key)>120:
                    self.sendj(400,{'error':'invalid_idempotency_key'}); return
            started=now(); runs=[]
            for provider in accepted:
                run,created=create_or_run_sync(project_id,provider,site,window,started,request_key)
                runs.append({**run,'created':created,'coalesced':not created})
            self.sendj(202,{'site':site,'accepted':accepted,'queuedAt':started,'runs':runs}); return
        self.sendj(404,{'error':'not_found'})

def main():
    if not TOKEN: raise SystemExit('ANALYTICS_GATEWAY_TOKEN is required')
    init_db()
    ensure_monitor_schema(DB)
    server=ThreadingHTTPServer((HOST,PORT),H)
    print(f'ms-robot-analytics listening on {HOST}:{PORT}',flush=True)
    server.serve_forever()

if __name__=='__main__': main()
