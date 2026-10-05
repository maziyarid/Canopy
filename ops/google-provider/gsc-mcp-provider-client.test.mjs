import test from "node:test";
import assert from "node:assert/strict";
import {
  providerConfig,
  providerRequest,
  formatSites,
  formatSearchAnalytics,
  formatInspection,
  formatSitemaps,
} from "./gsc-mcp-provider-client.mjs";

const env = {
  GOOGLE_PROVIDER_URL: "http://127.0.0.1:9131",
  GOOGLE_PROVIDER_TOKEN: "fixture-secret-token",
};

test("provider client is loopback-only and never accepts an empty token", () => {
  assert.equal(providerConfig(env).baseUrl, "http://127.0.0.1:9131");
  assert.throws(() => providerConfig({ GOOGLE_PROVIDER_URL: "https://example.com", GOOGLE_PROVIDER_TOKEN: "x" }), /loopback/);
  assert.throws(() => providerConfig({ GOOGLE_PROVIDER_URL: "http://127.0.0.1:9131", GOOGLE_PROVIDER_TOKEN: "" }), /token_missing/);
});

test("provider request sends bearer internally but error text never echoes provider body", async () => {
  let observed;
  const okFetch = async (url, init) => {
    observed = { url, init };
    return { ok: true, status: 200, json: async () => ({ sites: [] }) };
  };
  await providerRequest("/v1/sites", {}, env, okFetch);
  assert.equal(observed.url, "http://127.0.0.1:9131/v1/sites");
  assert.equal(observed.init.headers.Authorization, "Bearer fixture-secret-token");

  const failedFetch = async () => ({
    ok: false,
    status: 502,
    json: async () => ({ error: "Authorization: Bearer fixture-secret-token" }),
  });
  await assert.rejects(
    () => providerRequest("/v1/sites", {}, env, failedFetch),
    (error) => {
      assert.equal(error.message, "google_provider_http_502");
      assert.equal(error.message.includes("fixture-secret-token"), false);
      return true;
    },
  );
});

test("provider request forwards only explicit JSON input", async () => {
  let observed;
  const fetchImpl = async (_url, init) => {
    observed = init;
    return { ok: true, status: 200, json: async () => ({ rows: [] }) };
  };
  await providerRequest("/v1/gsc/search-analytics", {
    method: "POST",
    body: {
      siteUrl: "sc-domain:example.com",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      dimensions: ["query"],
      rowLimit: 100,
    },
  }, env, fetchImpl);
  assert.deepEqual(JSON.parse(observed.body), {
    siteUrl: "sc-domain:example.com",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    dimensions: ["query"],
    rowLimit: 100,
  });
});

test("formatters preserve the existing four-tool human-readable contract", () => {
  assert.match(formatSites({ sites: [{ siteUrl: "sc-domain:example.com", permissionLevel: "siteFullUser" }] }), /sc-domain:example.com/);
  assert.match(formatSearchAnalytics({
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    dimensions: ["query"],
    rows: [{ keys: ["example"], clicks: 2, impressions: 100, ctr: 0.02, position: 8.4 }],
  }), /example \| 2 \| 100 \| 2.00% \| 8.4/);
  assert.match(formatInspection({
    inspectionUrl: "https://example.com/a",
    inspectionResult: { indexStatusResult: { verdict: "PASS", coverageState: "Submitted and indexed" } },
  }), /Verdict: PASS/);
  assert.match(formatSitemaps({
    siteUrl: "sc-domain:example.com",
    sitemaps: [{ path: "https://example.com/sitemap.xml", errors: 0, warnings: 1 }],
  }), /warnings: 1/);
});
