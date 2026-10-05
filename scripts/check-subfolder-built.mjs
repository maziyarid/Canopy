import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { appPath, normalizeAppBase } from './public-paths.mjs';

// Disposable local node-server acceptance. Never reads a live database or credentials.
assert.ok(!process.env.DATABASE_URL, 'Unset DATABASE_URL for isolated verification');
const base = normalizeAppBase(process.env.MSROBOT_APP_BASE_PATH ?? '/');
const mount = (path) => appPath(path, base);
const dir = await mkdtemp(join(tmpdir(), 'msrobot-subfolder-'));
for (const name of ['pglite.data', 'pglite.wasm', 'initdb.wasm']) {
  await access(new URL(`../.output/server/_libs/${name}`, import.meta.url));
}
const port = 18129;
const origin = 'https://fixture.example';
const env = {
  PATH: process.env.PATH, NODE_ENV: 'production', NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port),
  MSROBOT_APP_BASE_PATH: base, BETTER_AUTH_URL: origin,
  BETTER_AUTH_SECRET: 'synthetic-fixture-secret-never-used-outside-isolated-tests',
  PGLITE_DATA_DIR: dir, VITE_AUTH_ENABLED: 'true',
  GROK_AUTH_CLIENT_ID: 'synthetic-fixture', GROK_AUTH_CLIENT_SECRET: 'synthetic-unused-federation-secret',
  MAZIYARID_LAUNCH_ENABLED: 'true', MAZIYARID_PLATFORM_ORIGIN: 'https://platform.fixture.example',
  MAZIYARID_LAUNCH_SERVICE_TOKEN: 'synthetic-unused-service-token-no-platform-calls',
};
const server = spawn(process.execPath, ['.output/server/index.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
server.stdout.on('data', (v) => { logs += v; });
server.stderr.on('data', (v) => { logs += v; });
async function request(path, options = {}) {
  return fetch(`http://127.0.0.1:${port}${path}`, { ...options, redirect: 'manual', headers: { Host: 'fixture.example', ...options.headers } });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Server exited ${server.exitCode}: ${logs}`);
    try { await request(mount('/login')); ready = true; break; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  assert.ok(ready, logs);
  for (const page of ['/', '/login', '/p/synthetic-project']) {
    const res = await request(mount(page));
    assert.equal(res.status, 200, `${page}: ${await res.clone().text()}`);
    const html = await res.text();
    assert.match(html, /<html/);
    assert.ok(html.includes(mount('/__grok/manifest.webmanifest')));
    const localAssets = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
    for (const asset of localAssets) {
      if (base !== '/') assert.ok(asset.startsWith(`${base}/`), `escaped HTML path: ${asset}`);
      if (/\.(?:js|css|svg|png|webp)(?:\?|$)/.test(asset)) {
        const a = await request(asset.replaceAll('&amp;', '&'));
        assert.equal(a.status, 200, `asset: ${asset}`);
        assert.ok(!a.headers.get('content-type')?.includes('text/html'), `asset returned HTML: ${asset}`);
      }
    }
  }
  console.log(`PASS ${base}: hard refresh, login, deep link, HTML assets`);
  const manifest = await (await request(mount('/__grok/manifest.webmanifest'))).json();
  assert.equal(manifest.scope, mount('/'));
  assert.equal(manifest.start_url, mount('/'));
  assert.equal(manifest.id, mount('/'));
  for (const icon of manifest.icons) assert.ok(icon.src.startsWith(mount('/')));
  const install = await request(mount('/?install=1&platform=ios'), { headers: { Accept: 'text/html' } });
  assert.equal(install.status, 200);
  const installHtml = await install.text();
  assert.ok(installHtml.includes(mount('/__grok/install/styles.css')));
  console.log(`PASS ${base}: manifest and install scope`);
  const callback = await request(mount('/api/google/oauth/callback?error=access_denied'));
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get('location'), `${origin}${mount('/')}?googleOAuth=error`);
  const report = await request(mount('/api/v1/reporting/snapshot'));
  assert.equal(report.status, 503);
  assert.deepEqual(await report.json(), { error: 'reporting_unconfigured' });
  assert.equal(report.headers.get('cache-control'), 'no-store');
  console.log(`PASS ${base}: OAuth error redirect and reporting route`);
  if (base !== '/') {
    const launch = await request(mount('/launch/accept'), { method: 'POST', headers: { Origin: env.MAZIYARID_PLATFORM_ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: `code=${'a'.repeat(43)}` });
    assert.equal(launch.status, 404, 'prefixed launch must remain disabled');
    assert.equal(launch.headers.get('cache-control'), 'no-store');
    for (const path of ['/', '/login', '/api/auth/get-session', '/api/v1/reporting/snapshot', '/__grok/manifest.webmanifest', '/favicon.svg', '/msrobot/app-evil/login', '/msrobot/application/login']) {
      const outside = await request(path);
      assert.equal(outside.status, 404, `outside mount: ${path}`);
    }
  }
  if (base !== '/') {
    const normalized = await request(base + '?next=1');
    assert.equal(normalized.status, 307);
    assert.equal(normalized.headers.get('location'), mount('/') + '?next=1');
    // The complete return corpus is in unit/real-Better-Auth tests. Keep this
    // production-rate-limited endpoint probe below its per-path threshold.
    for (const field of ['callbackURL']) {
      for (const value of ['/apex-outside']) {
        const rejected = await request(mount('/api/auth/sign-in/oauth2'), { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId: 'grok-google', [field]: value }) });
        assert.ok([400, 403].includes(rejected.status), `auth return escaped: ${field} ${value}`);
      }
    }
    const oauth = await request(mount('/api/auth/sign-in/oauth2'), { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId: 'grok-google' }) });
    assert.equal(oauth.status, 200, await oauth.clone().text());
    const authorization = new URL((await oauth.json()).url);
    assert.equal(authorization.searchParams.get('redirect_uri'), origin + mount('/api/auth/oauth2/callback/grok-google'));
    const stateCookie = oauth.headers.getSetCookie().find((v) => v.startsWith('__Host-msrobot-auth.state='));
    assert.ok(stateCookie, 'OAuth state cookie is namespaced too; returned names: ' + oauth.headers.getSetCookie().map((v) => v.split('=')[0]).join(', '));
    const cancelled = await request(mount('/api/auth/oauth2/callback/grok-google?error=access_denied&state=') + authorization.searchParams.get('state'), { headers: { Cookie: stateCookie.split(';')[0] } });
    assert.equal(cancelled.status, 302);
    assert.ok(new URL(cancelled.headers.get('location'), origin).pathname.startsWith(mount('/')), 'OAuth cancellation stays in app');
    console.log(`PASS ${base}: server-side auth return containment, OAuth callback path/state cookie and cancel redirect`);
  }
  const tokenName = base === '/' ? '__Host-grok-auth.session_token' : '__Host-msrobot-auth.session_token';
  const signup = await request(mount('/api/auth/sign-up/email'), { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'synthetic@example.test', password: 'synthetic-password-123!', name: 'Synthetic fixture' }) });
  assert.equal(signup.status, 200, await signup.clone().text());
  const cookies = signup.headers.getSetCookie();
  assert.ok(cookies.some((s) => s.startsWith(`${tokenName}=`)));
  for (const cookie of cookies) {
    assert.match(cookie, /; Secure/i); assert.match(cookie, /; HttpOnly/i); assert.match(cookie, /; Path=\/(?:;|$)/i); assert.match(cookie, /; SameSite=Lax/i); assert.doesNotMatch(cookie, /; Domain=/i);
    if (base !== '/') assert.ok(cookie.startsWith('__Host-msrobot-auth.'));
  }
  const cookieHeader = cookies.map((s) => s.split(';')[0]).join('; ');
  const session = await request(mount('/api/auth/get-session'), { headers: { Cookie: cookieHeader } });
  assert.equal(session.status, 200); assert.equal((await session.json()).user.email, 'synthetic@example.test');
  const ssr = await readFile(new URL('../.output/server/_ssr/ssr.mjs', import.meta.url), 'utf8');
  const id = ssr.match(/"([a-f0-9]+)": \{\s*functionName: "listProjects_createServerFn_handler"/)?.[1];
  assert.ok(id, 'generated server function ID');
  const fn = await request(mount(`/_serverFn/${id}`), { headers: { Cookie: cookieHeader, 'x-tsr-serverFn': 'true', 'Sec-Fetch-Site': 'same-origin' } });
  assert.equal(fn.status, 200, await fn.clone().text());
  assert.doesNotMatch(await fn.text(), /Unauthorized|Error|<html/);
  const deniedLogout = await request(mount('/api/auth/sign-out'), { method: 'POST', headers: { Cookie: cookieHeader, Origin: 'https://wrong.example', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(deniedLogout.status, 403);
  const logout = await request(mount('/api/auth/sign-out'), { method: 'POST', headers: { Cookie: cookieHeader, Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(logout.status, 200, await logout.clone().text());
  const stale = await request(mount('/api/auth/get-session'), { headers: { Cookie: cookieHeader } });
  assert.equal(await stale.json(), null, 'stale cache must not restore signed-out session');
  console.log(`PASS ${base}: native signup/session, real server function, exact Origin, logout and stale-cookie denial`);
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) await once(server, 'exit');
  await rm(dir, { recursive: true, force: true });
}

const mismatch = spawnSync(process.execPath, ['.output/server/index.mjs'], { env: { ...env, MSROBOT_APP_BASE_PATH: base === '/' ? '/msrobot/app' : '/' }, encoding: 'utf8', timeout: 5000 });
assert.notEqual(mismatch.status, 0);
assert.match(mismatch.stderr, /build and runtime/);
assert.doesNotMatch(mismatch.stdout, /Listening on/);
console.log(`PASS ${base}: runtime mismatch refuses startup before listening`);
