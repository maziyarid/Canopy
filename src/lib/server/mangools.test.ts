import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
  bindStoredMangoolsKey,
  commitMangoolsKey,
  mangoolsFetchWith,
  PublicMangoolsRequestSchema,
  resolveMangoolsUrl,
} from "./mangools-bind.ts";
import type { Sql } from "../db.ts";
import { createSqlClient, type QueryRunner } from "../sql-client.ts";
import { saveStudioSettingsRecord } from "./integration-settings-service.ts";
import { readSettingsSecret } from "./settings-vault.server.ts";

async function fixture() {
  const db = new PGlite();
  const dir = new URL("../../../migrations/", import.meta.url).pathname;
  for (const name of (await readdir(dir)).filter((x) => /^\d+.*\.sql$/.test(x)).sort()) {
    await db.exec(await readFile(join(dir, name), "utf8"));
  }
  const run: QueryRunner = async <T>(text: string, params: unknown[]) => (await db.query<T>(text, params)).rows;
  const sql: Sql = createSqlClient(run, async (work) => db.transaction(async (tx) => {
    const txRun: QueryRunner = async <T>(text: string, params: unknown[]) => (await tx.query<T>(text, params)).rows;
    return work(txRun);
  }));
  return { db, sql };
}

test("public Mangools request schema drops caller-supplied apiKey", () => {
  const parsed = PublicMangoolsRequestSchema.parse({
    apiKey: "pk_live_caller_supplied_secret",
    path: "/kwfinder/limits",
    method: "GET",
  });
  assert.equal("apiKey" in parsed, false);
  assert.equal(JSON.stringify(parsed).includes("pk_live_caller_supplied_secret"), false);
  assert.equal(parsed.path, "/kwfinder/limits");
});

test("Mangools proxy binds the stored key and ignores extra caller secrets", () => {
  const publicInput = PublicMangoolsRequestSchema.parse({
    apiKey: "pk_live_caller_supplied_secret",
    path: "/kwfinder/related-keywords",
    query: { kw: "seo" },
  });
  const bound = bindStoredMangoolsKey(publicInput, "stored-mangools-token-value");
  assert.equal(bound.apiKey, "stored-mangools-token-value");
  assert.equal(bound.path, "/kwfinder/related-keywords");
  assert.throws(
    () => bindStoredMangoolsKey(publicInput, "  "),
    /Add your Mangools API key/,
  );
});

test("canonical relative Mangools paths resolve only to api.mangools.com/v3", () => {
  const url = resolveMangoolsUrl("/kwfinder/limits");
  assert.equal(url.origin, "https://api.mangools.com");
  assert.equal(url.pathname, "/v3/kwfinder/limits");
  const tracked = resolveMangoolsUrl("/serpwatcher/trackings/abc-123/detail");
  assert.equal(tracked.pathname, "/v3/serpwatcher/trackings/abc-123/detail");
});

test("hostile Mangools paths never send X-Access-Token off-origin", async () => {
  const calls: Array<{ url: string; token?: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const headers = init?.headers as Record<string, string> | undefined;
    calls.push({
      url: String(input instanceof URL ? input.href : input),
      token: headers?.["X-Access-Token"],
    });
    return new Response("nope", { status: 418 });
  };
  const hostiles = [
    "https://127.0.0.1:9/steal",
    "http://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example",
    "https://api.mangools.com.evil.test/v3/kwfinder/limits",
    "kwfinder/limits",
    "/kwfinder/limits/../../../../steal",
    "/%2f%2fevil.example/steal",
    "/kwfinder/%2e%2e/%2e%2e/%2e%2e/steal",
    "/kwfinder/limits?redirect=https://evil.example",
    "javascript:alert(1)",
    "http:evil.example",
    "HTTPS://evil.example/steal",
    "mangools.com/v3/kwfinder/limits",
    "/kwfinder/limits\\@evil",
    " /kwfinder/limits",
    "/kwfinder/limits ",
    "/not-a-mangools-endpoint",
  ];
  for (const path of hostiles) {
    await assert.rejects(
      () => mangoolsFetchWith({ apiKey: "stored-token-secret", path }, fetchImpl),
    );
    assert.equal(
      PublicMangoolsRequestSchema.safeParse({ path }).success,
      false,
      `schema should reject ${path}`,
    );
  }
  assert.equal(calls.length, 0, "no outbound request may leave with the stored token");
});

test("valid Mangools paths attach the token only after origin allowlist", async () => {
  const calls: Array<{ url: string; token?: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const headers = init?.headers as Record<string, string> | undefined;
    calls.push({
      url: String(input instanceof URL ? input.href : input),
      token: headers?.["X-Access-Token"],
    });
    return new Response(JSON.stringify({ lookups: { remaining: 1, limit: 2 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const res = await mangoolsFetchWith({ apiKey: "stored-token-secret", path: "/kwfinder/limits" }, fetchImpl);
  assert.equal(res.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.startsWith("https://api.mangools.com/v3/kwfinder/limits"), true);
  assert.equal(calls[0].token, "stored-token-secret");
});

test("invalid replacement Mangools key leaves the existing key active", async () => {
  let stored = "good-stored-key-value";
  const validated: string[] = [];
  await assert.rejects(
    () =>
      commitMangoolsKey({
        existingKey: stored,
        candidateKey: "invalid-candidate-key",
        validate: async (candidate) => {
          validated.push(candidate);
          return { ok: false, error: "Mangools 401: unauthorized" };
        },
      }).then((next) => {
        stored = next;
      }),
    /Mangools 401/,
  );
  assert.deepEqual(validated, ["invalid-candidate-key"]);
  assert.equal(stored, "good-stored-key-value");

  const { db, sql } = await fixture();
  try {
    const keyring = { activeVersion: 1, keys: { 1: randomBytes(32).toString("base64") } };
    await saveStudioSettingsRecord(sql, "u1", { mangoolsKey: "good-stored-key-value" }, async () => true, keyring);
    await assert.rejects(
      saveStudioSettingsRecord(sql, "u1", { mangoolsKey: "invalid-candidate-key" }, async () => false, keyring),
      /Mangools key validation failed/,
    );
    const rows = await sql.query<{ mangools_key: string }>("select mangools_key from studio_settings where user_id='u1'");
    assert.equal(rows[0].mangools_key, "");
    assert.equal(await readSettingsSecret(sql, "u1", "mangools", keyring) === "good-stored-key-value", true);
    await saveStudioSettingsRecord(sql, "u1", { mangoolsKey: "new-valid-key-value" }, async () => true, keyring);
    const after = await sql.query<{ mangools_key: string }>("select mangools_key from studio_settings where user_id='u1'");
    assert.equal(after[0].mangools_key, "");
    assert.equal(await readSettingsSecret(sql, "u1", "mangools", keyring) === "new-valid-key-value", true);
  } finally {
    await db.close();
  }
});

test("setup persists Mangools keys only through server-side saveSettings", async () => {
  const source = await readFile(new URL("../../components/setup.tsx", import.meta.url), "utf8");
  assert.match(source, /await saveSettings\(\{ data: \{ mangoolsKey: key \} \}\)/);
  assert.match(source, /liveQuota\(\)/);
  const saveIndex = source.indexOf("saveSettings({ data: { mangoolsKey: key } })");
  const quotaIndex = source.indexOf("liveQuota()");
  assert.equal(saveIndex > 0 && quotaIndex > saveIndex, true);
});
