/**
 * AAX-55 focused unit tests — redaction helpers and data-domain hard deny.
 * Medical inquiry retention is intentionally not activated (policy-blocked).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  redactCredentials,
  redactPii,
  redactForLog,
  redactForClient,
} from "./redact.ts";
import { applyAmbientDataDomain, assertSameDataDomain } from "./access.ts";
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
    assert.match(out, /pii:[0-9a-f]{64}/);
  });

  it("same email yields same hash", () => {
    const a = redactPii("user@test.org");
    const b = redactPii("user@test.org");
    assert.equal(a, b);
  });

  it("different emails yield different hashes", () => {
    const a = redactPii("a@test.org");
    const b = redactPii("b@test.org");
    assert.notEqual(a, b);
  });

  it("replaces phone-like strings", () => {
    const raw = "call +1 555-123-4567";
    const out = redactPii(raw);
    assert.doesNotMatch(out, /555-123-4567/);
    assert.match(out, /pii:[0-9a-f]{64}/);
  });

  it("hash is full SHA-256 and not a public 64-bit truncation", () => {
    const out = redactPii("secret@clinic.ir");
    const m = out.match(/pii:([0-9a-f]+)/);
    assert.ok(m);
    assert.equal(m![1].length, 64);
    assert.doesNotMatch(out, /ms-robot-pii-v1/);
  });

  it("production fails closed without a server pepper", () => {
    const previousNode = process.env.NODE_ENV;
    const previousPepper = process.env.MS_ROBOT_PII_PEPPER;
    process.env.NODE_ENV = "production";
    delete process.env.MS_ROBOT_PII_PEPPER;
    try {
      assert.throws(() => redactPii("patient@example.com"), /MS_ROBOT_PII_PEPPER is required/);
    } finally {
      process.env.NODE_ENV = previousNode;
      if (previousPepper === undefined) delete process.env.MS_ROBOT_PII_PEPPER;
      else process.env.MS_ROBOT_PII_PEPPER = previousPepper;
    }
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

  it("redactForClient on provider-style error", () => {
    const raw = "Mangools rejected: Bearer sk-live-leak for patient@clinic.com";
    const out = redactForClient(raw);
    assert.doesNotMatch(out, /sk-live-leak/);
    assert.doesNotMatch(out, /patient@clinic\.com/);
    assert.match(out, /\[REDACTED\]/);
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

describe("AAX-55 applyAmbientDataDomain", () => {
  it("no-ops when ambient context is absent (multi-domain membership remains valid)", () => {
    assert.doesNotThrow(() => applyAmbientDataDomain(undefined, "thesis"));
    assert.doesNotThrow(() => applyAmbientDataDomain(null, "medical"));
  });

  it("allows ambient medical against medical target", () => {
    assert.doesNotThrow(() => applyAmbientDataDomain("medical", "medical"));
  });

  it("denies ambient medical against thesis target with Project not found", () => {
    assert.throws(
      () => applyAmbientDataDomain("medical", "thesis"),
      (err: Error) => err.message === "Project not found",
    );
  });

  it("denies ambient other against medical target", () => {
    assert.throws(
      () => applyAmbientDataDomain("other", "medical"),
      (err: Error) => err.message === "Project not found",
    );
  });
});

describe("AAX-55 SEO, published-content, research, agent, provider-admin, monday and invites ambient wiring", () => {
  it("passes optional ambient domain into every resolveAccess call", () => {
    const seo = readFileSync(new URL("./seo-sources.ts", import.meta.url), "utf8");
    const published = readFileSync(new URL("./published-content.ts", import.meta.url), "utf8");
    const research = readFileSync(new URL("./research.ts", import.meta.url), "utf8");
    const agent = readFileSync(new URL("./agent.ts", import.meta.url), "utf8");
    const providerAdmin = readFileSync(new URL("./provider-admin.ts", import.meta.url), "utf8");
    const monday = readFileSync(new URL("./monday.ts", import.meta.url), "utf8");
    const invites = readFileSync(new URL("./invites.ts", import.meta.url), "utf8");
    for (const source of [seo, published, research, agent, providerAdmin, monday, invites]) {
      const calls = source.match(/resolveAccess\([\s\S]*?\);/g) ?? [];
      assert.ok(calls.length > 0);
      for (const call of calls) {
        assert.match(call, /data\.ambientDataDomain/);
      }
      assert.match(source, /ambientDataDomain: z\.enum\(\["medical", "thesis", "other"\]\)\.optional\(\)/);
      assert.equal(source.includes("}, ambientDataDomain"), false);
    }
  });
});
