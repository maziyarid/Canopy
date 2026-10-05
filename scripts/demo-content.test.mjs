import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderWebManifest } from "./grok-pwa-shared.mjs";

const require = createRequire(import.meta.url);
function loadSource(path, replacements = {}, env = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    process: { env },
    require: (name) => name in replacements ? replacements[name] : require(name),
  }, { filename: path });
  return exports;
}

const { copy } = loadSource("src/lib/i18n.ts");
const element = (tag) => ({ children }) => React.createElement(tag, null, children);
const locale = (lang) => ({
  useT: () => (key) => copy[key][lang],
  useLocale: (selector) => selector({ lang, toggle() {} }),
});

for (const lang of ["en", "fa"]) {
  test(`public landing has no invented rankings and explains private reporting (${lang})`, () => {
    const { Landing } = loadSource("src/components/landing.tsx", {
      "@/components/mark": { Mark: element("span") },
      "@/components/ui": { Button: element("button") },
      "@/lib/locale": locale(lang),
    });
    const html = renderToStaticMarkup(React.createElement(Landing));
    assert.doesNotMatch(html, /waterproof field notebook|geology field notebook|جراحی بینی تهران|متخصص گوش حلق بینی/);
    assert.ok(copy.privateReportingBody?.[lang], "private reporting explanation must exist");
    assert.ok(html.includes(copy.privateReportingBody[lang]));
  });

  test(`dashboard empty state does not offer sample insertion (${lang})`, () => {
    const { Dashboard } = loadSource("src/components/dashboard.tsx", {
      "react": { ...React, useEffect() {}, useState: (value) => [value === null ? [] : value, () => {}] },
      "@/components/ui": { Badge: element("span"), Button: element("button"), Field: element("label"), Input: element("input") },
      "@/lib/locations": { LANGUAGES: [], LOCATIONS: [], locationLabel() {} },
      "@/lib/locale": locale(lang),
      "@/lib/server/projects": { createProject() {}, listProjects: async () => [] },
      "@/lib/server/seed": { seedSampleStudio() { throw new Error("sample insertion reached"); } },
      "@tanstack/react-router": { Link: element("a") },
    });
    const html = renderToStaticMarkup(React.createElement(Dashboard));
    assert.doesNotMatch(html, /Load sample studio|load the sample studio|استودیوی نمونه/);
    assert.ok(html.includes(copy.empty[lang]));
  });
}

for (const env of [
  {},
  { NODE_ENV: "production" },
  { NODE_ENV: "production", MSROBOT_ENABLE_SAMPLE_STUDIO: "true" },
  { NODE_ENV: "development" },
  { NODE_ENV: "test", MSROBOT_ENABLE_SAMPLE_STUDIO: "true" },
]) {
  test(`sample handler rejects before its database access: ${JSON.stringify(env)}`, async () => {
    let dbCalls = 0;
    const { seedSampleStudio } = loadSource("src/lib/server/seed.ts", {
      "./platform-launch-scope.server": { assertUnrestrictedSession() {} },
      "@tanstack/react-start": { createServerFn: () => ({ middleware() { return this; }, handler(fn) { return fn; } }) },
      "@/lib/db": { getSql: async () => { dbCalls++; throw new Error("unexpected database access"); } },
      "@/lib/score": { opportunityScore() {} },
      "./studio-auth": { studioAuth: {} },
      "./access": { nid() {} },
    }, env);
    await assert.rejects(seedSampleStudio({ context: { userId: "test-user" } }), /Sample studio is disabled/);
    assert.equal(dbCalls, 0);
  });
}

test("explicit development sample mode retains the existing safe already-loaded path", async () => {
  let dbCalls = 0;
  const { seedSampleStudio } = loadSource("src/lib/server/seed.ts", {
    "./platform-launch-scope.server": { assertUnrestrictedSession() {} },
    "@tanstack/react-start": { createServerFn: () => ({ middleware() { return this; }, handler(fn) { return fn; } }) },
    "@/lib/db": { getSql: async () => { dbCalls++; return async () => [{ id: "a", domain: "northline.studio" }, { id: "b", domain: "drbastaninejad.com" }]; } },
    "@/lib/score": { opportunityScore() {} },
    "./studio-auth": { studioAuth: {} },
    "./access": { nid() {} },
  }, { NODE_ENV: "development", MSROBOT_ENABLE_SAMPLE_STUDIO: "true" });
  const result = await seedSampleStudio({ context: { userId: "test-user" } });
  assert.equal(result.already, true);
  assert.equal(dbCalls, 1);
});

test("missing Mangools connection copy does not classify saved records as demo data", () => {
  assert.doesNotMatch(copy.demoMode.en, /demo data/i);
  assert.doesNotMatch(copy.demoMode.fa, /دادهٔ نمونه/);
});

test("custom-domain manifest uses MS Robot without changing navigation scope", () => {
  for (const host of ["canopy.maziyarid.com", "msrobot.maziyarid.com", "localhost:8080"]) {
    const manifest = JSON.parse(renderWebManifest(host));
    assert.equal(manifest.name, "MS Robot");
    assert.equal(manifest.short_name, "MS Robot");
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.id, "/");
  }
});

test("literal Grok App published slugs retain their existing manifest names", () => {
  for (const host of ["grok-app.grok.me", "grok--app.grok.me"]) {
    assert.equal(JSON.parse(renderWebManifest(host)).name, "Grok App");
  }
});
