import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptCredential, encryptCredential, vaultAssociatedData } from "./credential-vault.server.ts";

test("credential vault round-trips with scoped associated data", () => {
  const key = randomBytes(32).toString("base64");
  const aad = vaultAssociatedData({tenantId:"t1",projectId:"p1",provider:"telegram",credentialId:"c1"});
  const enc = encryptCredential("bot-token-value", key, aad);
  assert.notEqual(enc.ciphertextB64, Buffer.from("bot-token-value").toString("base64"));
  assert.equal(decryptCredential(enc, key, aad), "bot-token-value");
});

test("credential vault fails closed for wrong scope or key", () => {
  const key = randomBytes(32).toString("base64");
  const other = randomBytes(32).toString("base64");
  const aad = vaultAssociatedData({tenantId:"t1",projectId:"p1",provider:"telegram",credentialId:"c1"});
  const enc = encryptCredential("secret", key, aad);
  assert.throws(() => decryptCredential(enc, key, aad + "-wrong"));
  assert.throws(() => decryptCredential(enc, other, aad));
});
