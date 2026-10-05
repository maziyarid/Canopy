import test from "node:test";
import assert from "node:assert/strict";
import {
  GOOGLE_ACTION_POLICIES,
  GOOGLE_ROLE_TEMPLATES,
  googleActionPolicy,
  scopesSatisfy,
  type GoogleCapability,
} from "./google-capabilities.ts";

test("high-impact Google actions always require ADA approval", () => {
  for (const [action, policy] of Object.entries(GOOGLE_ACTION_POLICIES)) {
    if (["DELETE", "PUBLISH", "POLICY_CHANGE", "CANONICAL_OWNERSHIP", "BUDGET_WRITE"].includes(policy.mutationType)) {
      assert.equal(policy.approval, "ada", action);
    }
  }
});

test("editing and publishing are separate GTM capabilities and scopes", () => {
  assert.equal(GOOGLE_ACTION_POLICIES["gtm.tag.create"].capability, "google.gtm.entity.write");
  assert.equal(GOOGLE_ACTION_POLICIES["gtm.version.publish"].capability, "google.gtm.publish");
  assert.deepEqual(GOOGLE_ACTION_POLICIES["gtm.tag.create"].requiredScopes, ["https://www.googleapis.com/auth/tagmanager.edit.containers"]);
  assert.deepEqual(GOOGLE_ACTION_POLICIES["gtm.version.publish"].requiredScopes, ["https://www.googleapis.com/auth/tagmanager.publish"]);
});


test("Search Console ownership verification is separate from property administration", () => {
  assert.equal(GOOGLE_ACTION_POLICIES["gsc.verification.get_token"].capability, "google.gsc.verification.token");
  assert.equal(GOOGLE_ACTION_POLICIES["gsc.verification.get_token"].approval, "grant");
  assert.equal(GOOGLE_ACTION_POLICIES["gsc.verification.verify"].capability, "google.gsc.verification.verify");
  assert.equal(GOOGLE_ACTION_POLICIES["gsc.verification.verify"].approval, "ada");
  assert.deepEqual(
    GOOGLE_ACTION_POLICIES["gsc.verification.verify"].requiredScopes,
    ["https://www.googleapis.com/auth/siteverification.verify_only"],
  );
});

test("GTM preview is separate from publish and remains on the write profile", () => {
  assert.equal(GOOGLE_ACTION_POLICIES["gtm.workspace.preview"].capability, "google.gtm.preview");
  assert.equal(GOOGLE_ACTION_POLICIES["gtm.workspace.preview"].profileMode, "write");
  assert.equal(GOOGLE_ACTION_POLICIES["gtm.workspace.preview"].approval, "grant");
  assert.equal(GOOGLE_ACTION_POLICIES["gtm.version.publish"].profileMode, "publish");
});

test("GA4 configuration and user management cannot share one implicit capability", () => {
  assert.equal(GOOGLE_ACTION_POLICIES["ga4.custom_dimension.create"].capability, "google.ga4.config.write");
  assert.equal(GOOGLE_ACTION_POLICIES["ga4.access_binding.create"].capability, "google.ga4.user.manage");
  assert.notDeepEqual(
    GOOGLE_ACTION_POLICIES["ga4.custom_dimension.create"].requiredScopes,
    GOOGLE_ACTION_POLICIES["ga4.access_binding.create"].requiredScopes,
  );
});

test("Google Ads requires separate adwords scope and developer token", () => {
  for (const [action, policy] of Object.entries(GOOGLE_ACTION_POLICIES)) {
    if (!action.startsWith("ads.")) continue;
    assert.equal(policy.provider, "google_ads");
    assert.equal(policy.requiresDeveloperToken, true);
    assert.deepEqual(policy.requiredScopes, ["https://www.googleapis.com/auth/adwords"]);
  }
});

test("marketing editor cannot publish GTM or mutate Ads", () => {
  const editor = new Set<GoogleCapability>(GOOGLE_ROLE_TEMPLATES.marketing_editor);
  assert.equal(editor.has("google.gtm.entity.write"), true);
  assert.equal(editor.has("google.gtm.publish"), false);
  assert.equal(editor.has("google.ads.campaign.write"), false);
});

test("scope intersection is exact and fail closed", () => {
  assert.equal(scopesSatisfy(["scope:a", "scope:b"], ["scope:a"]), true);
  assert.equal(scopesSatisfy(["scope:a"], ["scope:a", "scope:b"]), false);
  assert.equal(scopesSatisfy(["scope:a "], ["scope:a"]), true);
  assert.equal(googleActionPolicy("unknown.action"), null);
});
