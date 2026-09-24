/**
 * AAX-55 focused unit tests — redaction helpers and data-domain hard deny.
 * Medical inquiry retention is intentionally not activated (policy-blocked).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  redactCredentials,
  redactPii,
  redactForLog,
  redactForClient,
} from "./redact.ts";
import { assertSameDataDomain } from "./access.ts";
import type { DataDomain } from "./access.ts";

describe("AAX-55 redactCredentials", () => {
  it("redacts Bearer tokens", () => {
    const raw = "Authorization: Bearer sk-live-abc123xyz";
    const out = redactCredentials(raw);
    assert.match(out, /\[REDACTED\]/);
    assert.doesNotMatch(out, /sk-live/);
  });

  it("redacts api_key patterns", () => {
    const raw = 'api_key="super-secret-key-99"';
    const out = redactCredentials(raw);
    assert.match(out, /\[REDACTED\]/);
    assert.doesNotMatch(out, /super-secret/);
  });

  it("redacts x-access-token", () => {
    const raw = "X-Access-Token: tok_abcdef";
    const out = redactCredentials(raw);
    assert.match(out, /\[REDACTED\]/);
    assert.doesNotMatch(out, /tok_abcdef/);
  });

  it("leaves non-credential text intact", () => {
    const raw = "sync completed with 42 rows";
    assert.equal(redactCredentials(raw), raw);
  });
});

describe("AAX-55 redactPii", () => {
  it("replaces email with stable hash ref", () => {
    const raw = "contact patient@example.com for follow-up";
    const out = redactPii(raw);
    assert.doesNotMatch(out, /patient@example\.com/);
    assert.match(out, /pii:[0-9a-f]+/);
  });

  it("same email yields same hash", () => {
    const a = redactPii("user@test.org");
    const b = redactPii("user@test.org");
    assert.equal(a, b);
  });

  it("replaces phone-like strings", () => {
    const raw = "call +1 555-123-4567";
    const out = redactPii(raw);
    assert.doesNotMatch(out, /555-123-4567/);
    assert.match(out, /pii:[0-9a-f]+/);
  });
});

describe("AAX-55 redactForLog / redactForClient", () => {
  it("applies both credential and PII redaction", () => {
    const raw = "Bearer abc123 failed for user@clinic.ir phone 09121234567";
    const out = redactForLog(raw);
    assert.match(out, /\[REDACTED\]/);
    assert.doesNotMatch(out, /abc123/);
    assert.doesNotMatch(out, /user@clinic\.ir/);
    assert.doesNotMatch(out, /09121234567/);
  });

  it("redactForClient never returns plaintext credentials or PII", () => {
    const raw = "api_key=xyz email=admin@host.com";
    const out = redactForClient(raw);
    assert.doesNotMatch(out, /xyz/);
    assert.doesNotMatch(out, /admin@host\.com/);
  });
});

describe("AAX-55 assertSameDataDomain", () => {
  const domains: DataDomain[] = ["medical", "thesis", "other"];

  for (const d of domains) {
    it(`allows same domain ${d}`, () => {
      assert.doesNotThrow(() => assertSameDataDomain(d, d));
    });
  }

  it("denies medical vs thesis with Project not found", () => {
    assert.throws(
      () => assertSameDataDomain("medical", "thesis"),
      (err: Error) => err.message === "Project not found",
    );
  });

  it("denies thesis vs other", () => {
    assert.throws(
      () => assertSameDataDomain("thesis", "other"),
      (err: Error) => err.message === "Project not found",
    );
  });

  it("denies other vs medical", () => {
    assert.throws(
      () => assertSameDataDomain("other", "medical"),
      (err: Error) => err.message === "Project not found",
    );
  });
});
