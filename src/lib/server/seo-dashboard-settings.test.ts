import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("SEO dashboard Connect Sources modal wires to server-side save APIs", async () => {
  const source = await readFile(new URL("../../components/seo-dashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /saveClickUpSettings/);
  assert.match(source, /saveSettings/);
  assert.match(source, /handleSaveSources/);
  assert.match(source, /sourceForm/);
  assert.match(source, /clickUpApiKey/);
  assert.match(source, /clickUpListId/);
  assert.equal(source.includes('toast.success("Settings saved!")'), false);
  assert.doesNotMatch(source, /<Input type="password" placeholder=\{t\("enterClickUpKey"\)/);
  assert.match(source, /value=\{sourceForm\.clickUpApiKey\}/);
  assert.match(source, /value=\{sourceForm\.mangoolsKey\}/);
  assert.match(source, /clickUpSettings\?\.hasApiKey \? "••••••••"/);
  assert.doesNotMatch(source, /setClickUpSettings\([^)]*api_key/);
  assert.doesNotMatch(source, /setSourceForm\([^)]*api_key/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /Some settings saved/);
});
