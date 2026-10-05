import test from 'node:test';
import assert from 'node:assert/strict';
const { applyAuthReturnPolicy } = await import('./auth-return-policy.mjs').catch(() => ({}));
test('prefixed auth refuses same-origin returns outside its mount and unsafe paths', () => {
  for (const field of ['callbackURL', 'errorCallbackURL', 'newUserCallbackURL', 'redirectTo']) {
    for (const value of ['/apex-outside', 'https://product.example/apex-outside', '//evil.example', '/msrobot/app/../outside', '/msrobot/app/%2e%2e/outside']) {
      assert.throws(() => applyAuthReturnPolicy({ path: '/sign-in/oauth2', body: { [field]: value } }, '/msrobot/app', 'https://product.example'));
    }
  }
});
test('prefixed auth supplies mounted defaults and accepts only exact app returns', () => {
  const context = { path: '/sign-in/oauth2', body: {} };
  applyAuthReturnPolicy(context, '/msrobot/app', 'https://product.example');
  assert.equal(context.body.callbackURL, '/msrobot/app/');
  const c = { path: '/sign-in/oauth2', body: { callbackURL: 'https://product.example/msrobot/app/p/a?q=1' } };
  applyAuthReturnPolicy(c, '/msrobot/app', 'https://product.example');
  assert.equal(c.body.callbackURL, '/msrobot/app/p/a?q=1');
  assert.throws(() => applyAuthReturnPolicy({ path: '/verify-email', query: { callbackURL: '/outside' } }, '/msrobot/app', 'https://product.example'));
});
test('root auth return policy preserves its existing behavior', () => {
  const c = { path: '/sign-in/oauth2', body: { callbackURL: '/' } };
  applyAuthReturnPolicy(c, '/', undefined); assert.equal(c.body.callbackURL, '/');
});
