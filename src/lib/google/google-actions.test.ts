import test from "node:test";
import assert from "node:assert/strict";
import { googlePayloadHash, prepareGoogleRequest, validateGoogleAction } from "./google-actions.ts";

test("GSC sitemap submission is resource bound and uses official webmasters endpoint", () => {
  const action = validateGoogleAction("gsc.sitemap.submit", "sc-domain:example.com", { sitemapUrl: "https://example.com/sitemap.xml" });
  const request = prepareGoogleRequest(action);
  assert.equal(request.method, "PUT");
  assert.match(request.url, /webmasters\/v3\/sites\/sc-domain%3Aexample\.com\/sitemaps\/https%3A%2F%2Fexample\.com%2Fsitemap\.xml$/);
});

test("GTM tag cannot escape the granted container", () => {
  assert.throws(
    () => validateGoogleAction("gtm.tag.create", "accounts/1/containers/2", {
      workspacePath: "accounts/1/containers/999/workspaces/4",
      tag: { name: "GA4", type: "gaawe", parameter: [], firingTriggerId: [] },
    }),
    /google_resource_scope_mismatch/,
  );
});

test("GTM publish produces a separate publish endpoint", () => {
  const action = validateGoogleAction("gtm.version.publish", "accounts/1/containers/2", {
    versionPath: "accounts/1/containers/2/versions/8",
    fingerprint: "abc",
  });
  const request = prepareGoogleRequest(action);
  assert.equal(request.method, "POST");
  assert.equal(request.url, "https://tagmanager.googleapis.com/tagmanager/v2/accounts/1/containers/2/versions/8:publish?fingerprint=abc");
});

test("GA4 access binding cannot target a different property", () => {
  assert.throws(
    () => validateGoogleAction("ga4.access_binding.delete", "properties/123", { bindingName: "properties/999/accessBindings/42" }),
    /google_resource_scope_mismatch/,
  );
});

test("Google Ads campaign create is forced PAUSED regardless of caller intent", () => {
  const action = validateGoogleAction("ads.campaign.create_paused", "customers/123", {
    name: "Safe campaign",
    budgetResourceName: "customers/123/campaignBudgets/9",
    advertisingChannelType: "SEARCH",
    containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
  });
  const request = prepareGoogleRequest(action, "v25");
  const body = request.body as any;
  assert.equal(body.operations[0].create.status, "PAUSED");
  assert.equal(body.operations[0].create.campaignBudget, "customers/123/campaignBudgets/9");
});

test("Google Ads cannot reference another customer", () => {
  assert.throws(
    () => validateGoogleAction("ads.budget.update", "customers/123", {
      budgetResourceName: "customers/999/campaignBudgets/9",
      amountMicros: 1000000,
    }),
    /google_resource_scope_mismatch/,
  );
});

test("payload hashing is canonical and ignores object key ordering", () => {
  assert.equal(googlePayloadHash({ b: 2, a: 1 }), googlePayloadHash({ a: 1, b: 2 }));
});
