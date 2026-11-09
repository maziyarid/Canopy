import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createSqlClient, type QueryRunner } from "../sql-client.ts";
import {
  loadClickUpSettingsRecord,
  MASKED_SETTINGS_SECRET,
  publicClickUpSettings,
  publicStudioSettings,
  saveClickUpSettingsRecord,
  saveStudioSettingsRecord,
} from "./integration-settings-service.ts";
import { bindStoredMangoolsKey, mangoolsFetchWith } from "./mangools-bind.ts";
import { migrateLegacySettingsSecrets, readSettingsSecret } from "./settings-vault.server.ts";

async function fixture(legacy = false) {
  const db = new PGlite();
  const keyring = { activeVersion: 1, keys: { 1: randomBytes(32).toString("base64") } };
  const secrets = { mangools: randomBytes(24).toString("hex"), monday: `https://example.invalid/hooks/${randomBytes(24).toString("hex")}`, clickup: randomBytes(24).toString("hex") };
  const directory = new URL("../../../migrations/", import.meta.url).pathname;
  for (const name of (await readdir(directory)).filter((name) => /^\d+.*\.sql$/.test(name) && name !== "0013_encrypted_settings.sql").sort()) {
    await db.exec(await readFile(join(directory, name), "utf8"));
  }
  if (legacy) {
    await db.query("insert into studio_settings(user_id,mangools_key,monday_webhook,default_location_id,default_language_id) values('owner-a',$1,$2,123,456)", [secrets.mangools, secrets.monday]);
    await db.query("insert into clickup_settings(user_id,api_key,team_id,list_id) values('owner-a',$1,'team-a','list-a')", [secrets.clickup]);
  }
  const run: QueryRunner = async <T>(text: string, params: unknown[]) => (await db.query<T>(text, params)).rows;
  const sql = createSqlClient(run, async (work) => db.transaction(async (tx) => {
    const txRun: QueryRunner = async <T>(text: string, params: unknown[]) => (await tx.query<T>(text, params)).rows;
    return work(txRun);
  }));
  await db.transaction(async (tx) => {
    await tx.exec(await readFile(join(directory, "0013_encrypted_settings.sql"), "utf8"));
    await migrateLegacySettingsSecrets(createSqlClient(async <T>(text: string, params: unknown[]) => (await tx.query<T>(text, params)).rows), keyring);
  });
  return { db, sql, keyring, secrets };
}

function noPlaintext(value: unknown, secrets: Record<string, string>) {
  const serialised = JSON.stringify(value);
  assert.equal(Object.values(secrets).some((secret) => serialised.includes(secret)), false, "A secret must not occur in persisted or public output");
}

test("integration settings save ciphertext only and expose masked or configured metadata", async () => {
  const { db, sql, keyring, secrets } = await fixture();
  try {
    const saved = await saveStudioSettingsRecord(sql, "owner-a", { mangoolsKey: secrets.mangools, mondayWebhook: secrets.monday, defaultLocationId: 123, defaultLanguageId: 456 }, async (candidate) => candidate === secrets.mangools, keyring);
    const clickup = await saveClickUpSettingsRecord(sql, "owner-a", { apiKey: secrets.clickup, teamId: "team-a", listId: "list-a" }, keyring);
    assert.equal(saved.hasKey, true);
    const studio = await publicStudioSettings(sql, "owner-a");
    assert.deepEqual(studio, { hasKey: true, mondayWebhook: MASKED_SETTINGS_SECRET, defaultLocationId: 123, defaultLanguageId: 456 });
    assert.deepEqual(await publicClickUpSettings(sql, "owner-a"), { hasApiKey: true, teamId: "team-a", folderId: "", listId: "list-a" });
    noPlaintext([saved, clickup, studio, await sql.query("select * from credential_vault"), await sql.query("select * from studio_settings"), await sql.query("select * from clickup_settings")], secrets);
    assert.equal(await readSettingsSecret(sql, "owner-a", "monday_webhook", keyring) === secrets.monday, true);
  } finally { await db.close(); }
});

test("masked and omitted values preserve encrypted credentials and ordinary preferences", async () => {
  const { db, sql, keyring, secrets } = await fixture(true);
  try {
    let validations = 0;
    await saveStudioSettingsRecord(sql, "owner-a", { mangoolsKey: MASKED_SETTINGS_SECRET, mondayWebhook: MASKED_SETTINGS_SECRET }, async () => { validations++; return false; }, keyring);
    await saveStudioSettingsRecord(sql, "owner-a", {}, async () => { validations++; return false; }, keyring);
    await saveClickUpSettingsRecord(sql, "owner-a", { apiKey: MASKED_SETTINGS_SECRET, folderId: "folder-a" }, keyring);
    await saveClickUpSettingsRecord(sql, "owner-a", {}, keyring);
    assert.equal(validations, 0);
    assert.equal(await readSettingsSecret(sql, "owner-a", "mangools", keyring) === secrets.mangools, true);
    assert.equal(await readSettingsSecret(sql, "owner-a", "monday_webhook", keyring) === secrets.monday, true);
    assert.equal((await loadClickUpSettingsRecord(sql, "owner-a", keyring)).api_key === secrets.clickup, true);
    assert.deepEqual(await publicStudioSettings(sql, "owner-a"), { hasKey: true, mondayWebhook: MASKED_SETTINGS_SECRET, defaultLocationId: 123, defaultLanguageId: 456 });
    assert.equal((await publicClickUpSettings(sql, "owner-a")).folderId, "folder-a");
  } finally { await db.close(); }
});

test("explicitly clearing the Monday webhook removes only that encrypted setting", async () => {
  const { db, sql, keyring } = await fixture(true);
  try {
    await saveStudioSettingsRecord(sql, "owner-a", { mondayWebhook: "" }, async () => true, keyring);
    const result = await publicStudioSettings(sql, "owner-a");
    assert.equal(result.mondayWebhook, "");
    assert.equal(result.hasKey, true);
    assert.equal((await publicClickUpSettings(sql, "owner-a")).hasApiKey, true);
  } finally { await db.close(); }
});

test("migrated keys still authorise provider requests and remain bound to their owner", async () => {
  const { db, sql, keyring, secrets } = await fixture(true);
  try {
    const key = await readSettingsSecret(sql, "owner-a", "mangools", keyring);
    let sentStoredKey = false;
    const request = bindStoredMangoolsKey({ method: "GET", path: "/kwfinder/limits" }, key);
    const result = await mangoolsFetchWith(request, async (_url, init) => {
      sentStoredKey = new Headers(init?.headers).get("X-Access-Token") === secrets.mangools;
      return new Response("{}", { status: 200 });
    });
    assert.equal(result.ok, true);
    assert.equal(sentStoredKey, true);
    const clickup = await loadClickUpSettingsRecord(sql, "owner-a", keyring);
    assert.equal(clickup.api_key === secrets.clickup, true);
    assert.equal(await readSettingsSecret(sql, "owner-b", "mangools", keyring), "");
    assert.equal((await publicStudioSettings(sql, "owner-b")).hasKey, false);
    await assert.rejects(loadClickUpSettingsRecord(sql, "owner-b", keyring), /ClickUp is not configured/);
  } finally { await db.close(); }
});

test("an invalid Mangools candidate fails before settings or ciphertext change", async () => {
  const { db, sql, keyring } = await fixture(true);
  try {
    const before = await sql.query("select * from credential_vault order by provider");
    const preferences = await publicStudioSettings(sql, "owner-a");
    const candidate = randomBytes(24).toString("hex");
    await assert.rejects(saveStudioSettingsRecord(sql, "owner-a", { mangoolsKey: candidate, defaultLocationId: 999 }, async () => { throw new Error(candidate); }, keyring), { message: "Mangools key validation failed" });
    assert.deepEqual(await sql.query("select * from credential_vault order by provider"), before);
    assert.deepEqual(await publicStudioSettings(sql, "owner-a"), preferences);
  } finally { await db.close(); }
});

test("multi-setting failures roll back ciphertext changes and preferences together", async () => {
  const { db, sql, keyring } = await fixture(true);
  try {
    const before = await sql.query("select * from credential_vault order by provider");
    const preferences = await publicStudioSettings(sql, "owner-a");
    const invalidPreference = Number.MAX_SAFE_INTEGER;
    await assert.rejects(saveStudioSettingsRecord(sql, "owner-a", { mangoolsKey: randomBytes(24).toString("hex"), mondayWebhook: "https://example.invalid/new-hook", defaultLocationId: invalidPreference }, async () => true, keyring));
    assert.deepEqual(await sql.query("select * from credential_vault order by provider"), before);
    assert.deepEqual(await publicStudioSettings(sql, "owner-a"), preferences);
  } finally { await db.close(); }
});

test("metadata can be read without a key but provider reads fail closed with a wrong key", async () => {
  const { db, sql } = await fixture(true);
  try {
    assert.equal((await publicStudioSettings(sql, "owner-a")).hasKey, true);
    assert.equal((await publicClickUpSettings(sql, "owner-a")).hasApiKey, true);
    const wrongKeyring = { activeVersion: 1, keys: { 1: randomBytes(32).toString("base64") } };
    await assert.rejects(loadClickUpSettingsRecord(sql, "owner-a", wrongKeyring), { message: "settings_credentials_unavailable" });
  } finally { await db.close(); }
});

test("settings updates refuse a client without a pinned transaction", async () => {
  const { db, sql, keyring } = await fixture();
  try {
    const unpinned = createSqlClient(async <T>(text: string, params: unknown[]) => (await db.query<T>(text, params)).rows);
    await assert.rejects(saveStudioSettingsRecord(unpinned, "owner-a", {}, async () => true, keyring), { message: "Settings transaction is unavailable" });
    assert.equal((await sql.query("select user_id from studio_settings")).length, 0);
  } finally { await db.close(); }
});
