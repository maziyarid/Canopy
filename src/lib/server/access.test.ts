import test from "node:test";
import assert from "node:assert/strict";
import { canAdminProviders } from "./access.ts";

test("provider admin requires an unscoped administrative role", () => {
  assert.equal(canAdminProviders("owner", ""), true);
  assert.equal(canAdminProviders("editor", ""), true);
  assert.equal(canAdminProviders("client", ""), false);
  assert.equal(canAdminProviders("editor", "hidden keyword"), false);
  assert.equal(canAdminProviders("client", "keyword"), false);
});
