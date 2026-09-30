import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { redactForClient, redactForLog, redactPii } from "./redact.ts";

test("PII redaction without a server key emits no guessable identifier", () => {
  const previous = process.env.PII_REDACTION_KEY;
  delete process.env.PII_REDACTION_KEY;
  try {
    assert.equal(redactPii("patient@example.com"), "[REDACTED_PII]");
    const guess = createHash("sha256").update("ms-robot-pii-v1").update("patient@example.com").digest("hex").slice(0, 16);
    assert.ok(!redactForLog("patient@example.com").includes(guess));
  } finally {
    if (previous === undefined) delete process.env.PII_REDACTION_KEY;
    else process.env.PII_REDACTION_KEY = previous;
  }
});

test("server log correlation uses HMAC with the configured private key", () => {
  const previous = process.env.PII_REDACTION_KEY;
  process.env.PII_REDACTION_KEY = "test-only-key-that-is-at-least-32-characters";
  try {
    const expected = createHmac("sha256", process.env.PII_REDACTION_KEY).update("patient@example.com").digest("hex");
    assert.equal(redactPii("patient@example.com"), `pii:${expected}`);
    assert.ok(!redactForClient("patient@example.com").includes("pii:"));
  } finally {
    if (previous === undefined) delete process.env.PII_REDACTION_KEY;
    else process.env.PII_REDACTION_KEY = previous;
  }
});

test("client errors remove contact values without exposing correlation IDs", () => {
  assert.equal(redactForClient("contact patient@example.com"), "contact [REDACTED_PII]");
});

test("client removal consumes complete server HMAC markers before phone-like digit runs", () => {
  const previous = process.env.PII_REDACTION_KEY;
  process.env.PII_REDACTION_KEY = "test-only-key-that-is-at-least-32-characters";
  try {
    assert.equal(redactForClient(redactForLog("patient0@example.com")), "[REDACTED_PII]");
    assert.equal(redactForClient(`pii:${"a".repeat(20)}1234567890${"b".repeat(34)}`), "[REDACTED_PII]");
  } finally {
    if (previous === undefined) delete process.env.PII_REDACTION_KEY;
    else process.env.PII_REDACTION_KEY = previous;
  }
});
