import test from "node:test";
import assert from "node:assert/strict";
import { CAPABILITY_STATES } from "./contracts.ts";
import { PLATFORM_CAPABILITIES, canAttemptProductionPublish } from "./capabilities.ts";

test("capability registry covers expected platforms and only known states", () => {
  const expected = ["telegram","pinterest","instagram","facebook_pages","threads","linkedin","x","reddit","youtube","tiktok"].sort();
  assert.deepEqual(Object.keys(PLATFORM_CAPABILITIES).sort(), expected);
  for (const row of Object.values(PLATFORM_CAPABILITIES)) assert.ok(CAPABILITY_STATES.includes(row.defaultState));
});

test("provider gates are explicit instead of silently treated as available", () => {
  assert.equal(PLATFORM_CAPABILITIES.x.defaultState, "PAYMENT_REQUIRED");
  assert.equal(PLATFORM_CAPABILITIES.reddit.defaultState, "COMMERCIAL_CONTRACT_REQUIRED");
  assert.equal(PLATFORM_CAPABILITIES.linkedin.defaultState, "LEGAL_ENTITY_REQUIRED");
  assert.equal(canAttemptProductionPublish("x"), false);
  assert.equal(canAttemptProductionPublish("telegram"), true);
});

test("verified runtime state can enable an otherwise gated adapter", () => {
  assert.equal(canAttemptProductionPublish("pinterest", "AVAILABLE"), true);
  assert.equal(canAttemptProductionPublish("pinterest", "TRIAL_OR_SANDBOX"), false);
});
