import test from 'node:test';
import assert from 'node:assert/strict';
import { betterAuth } from 'better-auth';
const configModule = await import('./deployment-config.mjs').catch(() => ({}));
const { deploymentConfig } = configModule;
test('deployment config is available', () => assert.equal(typeof deploymentConfig, 'function'));
for (const base of ['/', '/msrobot/app']) {
  test(`auth origin, base and cookie namespace for ${base}`, async () => {
    const cfg = deploymentConfig({ builtBase: base, env: { MSROBOT_APP_BASE_PATH: base, BETTER_AUTH_URL: 'https://product.example', NODE_ENV: 'production' } });
    assert.equal(cfg.appBase, base);
    assert.equal(cfg.authBasePath, `${base === '/' ? '' : base}/api/auth`);
    assert.equal(cfg.publicOrigin, 'https://product.example');
    assert.equal(cfg.sessionTokenCookie, base === '/' ? '__Host-grok-auth.session_token' : '__Host-msrobot-auth.session_token');
    const auth = betterAuth({ baseURL: cfg.publicOrigin, basePath: cfg.authBasePath, secret: 'synthetic-test-secret-not-used-outside-tests', advanced: cfg.advanced });
    const ctx = await auth.$context;
    for (const cookie of [...Object.values(ctx.authCookies), ctx.createAuthCookie('oauth_state')]) {
      assert.equal(cookie.attributes.secure, true);
      assert.equal(cookie.attributes.httpOnly, true);
      assert.equal(cookie.attributes.path, '/');
      assert.equal(cookie.attributes.sameSite, 'lax');
      assert.equal(cookie.attributes.domain, undefined);
      if (base !== '/') assert.ok(cookie.name.startsWith('__Host-msrobot-auth.'));
    }
  });
}
test('build/runtime mount mismatches fail closed', () => {
  for (const [builtBase, runtime] of [['/msrobot/app', '/'], ['/', '/msrobot/app'], ['/msrobot/app', undefined]]) {
    assert.throws(() => deploymentConfig({ builtBase, env: { MSROBOT_APP_BASE_PATH: runtime } }), /build.*runtime/i);
  }
});
test('origin remains path-free and prefixed production requires explicit origin', () => {
  for (const origin of ['https://product.example/msrobot/app', 'https://product.example/', 'https://*.example', 'http://product.example', 'https://product.example?x=1']) {
    assert.throws(() => deploymentConfig({ builtBase: '/msrobot/app', env: { NODE_ENV: 'production', MSROBOT_APP_BASE_PATH: '/msrobot/app', BETTER_AUTH_URL: origin } }));
  }
  assert.throws(() => deploymentConfig({ builtBase: '/msrobot/app', env: { NODE_ENV: 'production', MSROBOT_APP_BASE_PATH: '/msrobot/app' } }), /origin/i);
});

test('prefixed Google OAuth requires the exact registered callback before starting', () => {
  assert.equal(configModule.validateGoogleRedirectUri('https://product.example/msrobot/app/api/google/oauth/callback', '/msrobot/app', 'https://product.example'), 'https://product.example/msrobot/app/api/google/oauth/callback');
  for (const uri of ['https://product.example/api/google/oauth/callback', 'https://other.example/msrobot/app/api/google/oauth/callback', 'https://product.example/msrobot/app/api/google/oauth/callback?x=1']) {
    assert.throws(() => configModule.validateGoogleRedirectUri(uri, '/msrobot/app', 'https://product.example'));
  }
});
