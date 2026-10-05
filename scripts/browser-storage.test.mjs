import test from 'node:test';
import assert from 'node:assert/strict';
const { migrateLocalePreference } = await import('./browser-storage.mjs').catch(() => ({}));
function storage(seed) { const data = new Map(Object.entries(seed)); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data }; }
test('locale migration copies only validated non-sensitive preference once', () => {
  const s = storage({ 'canopy-lang': JSON.stringify({ state: { lang: 'fa', token: 'must-not-copy' }, version: 0 }) });
  migrateLocalePreference(s);
  assert.deepEqual(JSON.parse(s.getItem('msrobot:v1:locale')), { state: { lang: 'fa' }, version: 0 });
  s.setItem('canopy-lang', JSON.stringify({ state: { lang: 'en' } }));
  migrateLocalePreference(s);
  assert.equal(JSON.parse(s.getItem('msrobot:v1:locale')).state.lang, 'fa');
  assert.ok(s.getItem('canopy-lang'), 'legacy state is retained');
});
test('locale migration ignores corrupt or unrelated data', () => {
  for (const value of ['broken', '{}', '{"state":{"lang":"xx"}}']) {
    const s = storage({ 'canopy-lang': value }); migrateLocalePreference(s); assert.equal(s.getItem('msrobot:v1:locale'), null);
  }
});
