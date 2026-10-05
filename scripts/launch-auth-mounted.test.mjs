import test from 'node:test';
import assert from 'node:assert/strict';
import { guardLaunchAuthRequest } from '../src/lib/server/platform-launch-auth.server.ts';

const auth = {
  $context: Promise.resolve({ authCookies: { sessionData: { name: '__Host-msrobot-auth.session_data' } } }),
  api: { getSession: async () => null },
};
const sql = { query() { throw new Error('Unexpected database access'); } };
for (const method of ['GET', 'POST']) {
  test(`rebuilds Nitro-compatible ${method} request without native private slots`, async () => {
    const real = new Request('https://product.example/msrobot/app/api/auth/' + (method === 'GET' ? 'get-session' : 'sign-out'), {
      method, headers: { Cookie: '__Host-msrobot-auth.session_data=cached; __Host-msrobot-auth.session_data.0=chunk; __Host-msrobot-auth.session_token=token' },
      ...(method === 'POST' ? { body: '{"synthetic":true}' } : {}),
    });
    const wrapper = Object.create(Request.prototype);
    for (const key of ['url', 'method', 'headers', 'body', 'signal']) Object.defineProperty(wrapper, key, { value: real[key] });
    assert.throws(() => new Request(wrapper), /private member|Invalid|Request/);
    const result = await guardLaunchAuthRequest(auth, sql, wrapper, '/msrobot/app');
    assert.equal(result.method, method);
    assert.equal(result.url, real.url);
    assert.equal(result.headers.get('cookie'), '__Host-msrobot-auth.session_token=token');
    if (method === 'POST') assert.deepEqual(await result.json(), { synthetic: true });
  });
}
test('mounted sign-out still rejects a forged gate identity header', async () => {
  await assert.rejects(guardLaunchAuthRequest(auth, sql, new Request('https://product.example/msrobot/app/api/auth/sign-out', { method: 'POST', headers: { 'x-grok-identity': 'forged' } }), '/msrobot/app'), /Forbidden/);
});
