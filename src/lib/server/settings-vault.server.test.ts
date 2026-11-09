import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import type { VaultKeyring } from "../social/vault-store.server.ts";
import {
  hasSettingsSecret,
  migrateLegacySettingsSecrets,
  readSettingsSecret,
  settingsVaultKeyring,
  writeSettingsSecret,
} from "./settings-vault.server.ts";

const migrationDir = new URL("../../../migrations/", import.meta.url);
const migrationName = "0013_encrypted_settings.sql";
const ring = (): VaultKeyring => ({ activeVersion: 1, keys: { 1: randomBytes(32).toString("base64") } });
const syntheticSecret = () => `fixture-${randomBytes(24).toString("base64url")}`;

function sqlFor(db: PGlite | Transaction): Sql {
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> => {
    const text = strings.reduce((out, part, index) => out + (index ? `$${index}` : "") + part, "");
    return (await db.query<T>(text, values)).rows;
  }) as Sql;
  sql.query = async <T>(text: string, values: unknown[] = []): Promise<T[]> => (await db.query<T>(text, values)).rows;
  return sql;
}

async function fixture() {
  const db = new PGlite();
  for (const name of (await readdir(migrationDir)).filter((name) => /^\d.*\.sql$/.test(name) && name < migrationName).sort()) {
    await db.exec(await readFile(new URL(name, migrationDir), "utf8"));
  }
  const secrets = { mangools: syntheticSecret(), monday_webhook: syntheticSecret(), clickup: syntheticSecret(), other: syntheticSecret() };
  const sql = sqlFor(db);
  await sql.query("insert into studio_settings(user_id,mangools_key,monday_webhook,default_location_id,default_language_id) values($1,$2,$3,1826,1234),($4,$5,'',2840,1000)", ["owner-a", secrets.mangools, secrets.monday_webhook, "owner-without-projects", secrets.other]);
  await sql.query("insert into clickup_settings(user_id,api_key,team_id,folder_id,list_id) values($1,$2,'team','folder','list')", ["owner-a", secrets.clickup]);
  const schema = await readFile(new URL(migrationName, migrationDir), "utf8");
  const migrate = (keyring: VaultKeyring) => db.transaction(async (tx) => {
    await tx.exec(schema);
    return migrateLegacySettingsSecrets(sqlFor(tx), keyring);
  });
  return { db, sql, secrets, schema, migrate };
}

test("legacy settings are encrypted atomically, preserve preferences and need no guessed project", async () => {
  const { db, sql, secrets, migrate } = await fixture();
  try {
    const keyring = ring();
    assert.deepEqual(await migrate(keyring), { migrated: 4 });
    const studio = await sql.query<{ user_id: string; mangools_key: string; monday_webhook: string; default_location_id: number; default_language_id: number }>("select * from studio_settings order by user_id");
    assert.ok(studio.every((row) => row.mangools_key === "" && row.monday_webhook === ""));
    assert.equal(studio[0].default_location_id, 1826);
    assert.equal(studio[0].default_language_id, 1234);
    const clickup = await sql.query<{ api_key: string; team_id: string; folder_id: string; list_id: string }>("select * from clickup_settings");
    assert.equal(clickup[0].api_key, "");
    assert.deepEqual([clickup[0].team_id, clickup[0].folder_id, clickup[0].list_id], ["team", "folder", "list"]);
    const rows = await sql.query<{ tenant_id: string; project_id: string; ciphertext_b64: string }>("select * from credential_vault");
    assert.equal(rows.length, 4);
    assert.ok(rows.every((row) => row.tenant_id === "" && row.project_id === "" && row.ciphertext_b64.length > 0));
    const logicalState = JSON.stringify({ studio, clickup, rows, receipts: await sql.query("select * from operation_receipts") });
    assert.ok(Object.values(secrets).every((secret) => !logicalState.includes(secret)));
    for (const provider of ["mangools", "monday_webhook", "clickup"] as const) {
      assert.ok((await readSettingsSecret(sql, "owner-a", provider, keyring)) === secrets[provider]);
      assert.equal(await hasSettingsSecret(sql, "owner-a", provider), true);
    }
    assert.ok((await readSettingsSecret(sql, "owner-without-projects", "mangools", keyring)) === secrets.other);
    assert.equal((await sql.query("select id from projects")).length, 0);
    assert.equal(await readSettingsSecret(sql, "unknown-owner", "mangools", keyring), "");
    assert.equal(await hasSettingsSecret(sql, "unknown-owner", "mangools"), false);
  } finally { await db.close(); }
});

test("migration replay is idempotent and does not re-encrypt completed values", async () => {
  const { db, sql, migrate } = await fixture();
  try {
    const keyring = ring();
    await migrate(keyring);
    const before = JSON.stringify(await sql.query("select * from credential_vault order by id"));
    const result = await db.transaction((tx) => migrateLegacySettingsSecrets(sqlFor(tx), keyring));
    assert.deepEqual(result, { migrated: 0 });
    assert.ok(JSON.stringify(await sql.query("select * from credential_vault order by id")) === before);
  } finally { await db.close(); }
});

test("missing or invalid active keys roll back schema and preserve every legacy value", async () => {
  const { db, sql, secrets, migrate } = await fixture();
  try {
    await assert.rejects(migrate({ activeVersion: 1, keys: {} }), { message: "settings_credentials_migration_failed" });
    assert.ok((await sql.query<{ mangools_key: string }>("select mangools_key from studio_settings where user_id='owner-a'"))[0].mangools_key === secrets.mangools);
    assert.ok((await sql.query<{ api_key: string }>("select api_key from clickup_settings"))[0].api_key === secrets.clickup);
    const columns = await sql.query<{ column_name: string }>("select column_name from information_schema.columns where table_name='credential_vault' and column_name='owner_user_id'");
    assert.equal(columns.length, 0);
    assert.equal((await sql.query("select id from credential_vault")).length, 0);
  } finally { await db.close(); }
});

test("a failure after the first encryption rolls back both ciphertext and plaintext changes", async () => {
  const { db, sql, secrets, schema } = await fixture();
  try {
    let writes = 0;
    await assert.rejects(db.transaction(async (tx) => {
      await tx.exec(schema);
      const scoped = sqlFor(tx);
      const query = scoped.query;
      scoped.query = async <T>(text: string, params: unknown[] = []): Promise<T[]> => {
        if (text.includes("insert into credential_vault") && ++writes === 2) throw new Error("fixture write failure");
        return query<T>(text, params);
      };
      await migrateLegacySettingsSecrets(scoped, ring());
    }), { message: "settings_credentials_migration_failed" });
    assert.equal(writes, 2);
    assert.equal((await sql.query("select id from credential_vault")).length, 0);
    const legacy = await sql.query<{ mangools_key: string; monday_webhook: string }>("select mangools_key,monday_webhook from studio_settings where user_id='owner-a'");
    assert.ok(legacy[0].mangools_key === secrets.mangools && legacy[0].monday_webhook === secrets.monday_webhook);
  } finally { await db.close(); }
});

test("persisted ciphertext is verified before legacy clearing and tampering rolls back the migration", async () => {
  const { db, sql, secrets, schema } = await fixture();
  try {
    let encryptedWrites = 0;
    let plaintextClears = 0;
    await assert.rejects(db.transaction(async (tx) => {
      await tx.exec(schema);
      const scoped = sqlFor(tx);
      const query = scoped.query;
      scoped.query = async <T>(text: string, params: unknown[] = []): Promise<T[]> => {
        if (text.startsWith("update studio_settings set mangools_key=''") || text.startsWith("update clickup_settings set api_key=''")) plaintextClears++;
        const rows = await query<T>(text, params);
        if (text.includes("insert into credential_vault")) {
          encryptedWrites++;
          await query("update credential_vault set auth_tag_b64=$2 where id=$1", [params[0], Buffer.alloc(16).toString("base64")]);
        }
        return rows;
      };
      await migrateLegacySettingsSecrets(scoped, ring());
    }), { message: "settings_credentials_migration_failed" });
    assert.equal(encryptedWrites, 1);
    assert.equal(plaintextClears, 0);
    assert.equal((await sql.query("select id from credential_vault")).length, 0);
    const legacy = await sql.query<{ mangools_key: string; monday_webhook: string }>("select mangools_key,monday_webhook from studio_settings where user_id='owner-a'");
    assert.ok(legacy[0].mangools_key === secrets.mangools && legacy[0].monday_webhook === secrets.monday_webhook);
    assert.ok((await sql.query<{ api_key: string }>("select api_key from clickup_settings"))[0].api_key === secrets.clickup);
    assert.equal((await sql.query("select column_name from information_schema.columns where table_name='credential_vault' and column_name='owner_user_id'")).length, 0);
  } finally { await db.close(); }
});

test("wrong keys and modified owner/provider/id bindings fail closed with safe errors", async () => {
  const { db, sql, migrate } = await fixture();
  try {
    const keyring = ring();
    await migrate(keyring);
    await assert.rejects(readSettingsSecret(sql, "owner-a", "mangools", ring()), { message: "settings_credentials_unavailable" });
    const rows = await sql.query<{ id: string; nonce_b64: string; ciphertext_b64: string; auth_tag_b64: string }>("select id,nonce_b64,ciphertext_b64,auth_tag_b64 from credential_vault where owner_user_id='owner-a' and provider='mangools'");
    const source = rows[0];
    for (const [owner, provider] of [["different-owner", "mangools"], ["owner-a", "clickup"]] as const) {
      await sql.query("insert into credential_vault(id,tenant_id,project_id,owner_user_id,provider,key_version,algorithm,nonce_b64,ciphertext_b64,auth_tag_b64) values($1,'','',$2,$3,1,'aes-256-gcm',$4,$5,$6) on conflict(owner_user_id,provider) where owner_user_id<>'' do update set nonce_b64=excluded.nonce_b64,ciphertext_b64=excluded.ciphertext_b64,auth_tag_b64=excluded.auth_tag_b64", [`copied-${provider}`, owner, provider, source.nonce_b64, source.ciphertext_b64, source.auth_tag_b64]);
      await assert.rejects(readSettingsSecret(sql, owner, provider, keyring), { message: "settings_credentials_unavailable" });
    }
    await sql.query("update credential_vault set id='modified-reference' where id=$1", [source.id]);
    await assert.rejects(readSettingsSecret(sql, "owner-a", "mangools", keyring), { message: "settings_credentials_unavailable" });
  } finally { await db.close(); }
});

test("new writes persist ciphertext, support key-version rotation and explicit deletion", async () => {
  const { db, sql, migrate } = await fixture();
  try {
    const initial = ring();
    await migrate(initial);
    const version2 = randomBytes(32).toString("base64");
    const rotated = { activeVersion: 2, keys: { 1: initial.keys[1], 2: version2 } };
    const replacement = syntheticSecret();
    await writeSettingsSecret(sql, "owner-a", "mangools", replacement, rotated);
    assert.ok((await readSettingsSecret(sql, "owner-a", "mangools", { activeVersion: 2, keys: { 2: version2 } })) === replacement);
    await assert.rejects(readSettingsSecret(sql, "owner-a", "mangools", initial), { message: "settings_credentials_unavailable" });
    const raw = await sql.query<{ key_version: number }>("select * from credential_vault where owner_user_id='owner-a' and provider='mangools'");
    assert.equal(raw[0].key_version, 2);
    assert.ok(!JSON.stringify(raw).includes(replacement));
    await writeSettingsSecret(sql, "owner-a", "monday_webhook", "");
    assert.equal(await hasSettingsSecret(sql, "owner-a", "monday_webhook"), false);
    assert.equal(await readSettingsSecret(sql, "owner-a", "monday_webhook"), "");
  } finally { await db.close(); }
});

test("schema guards reject future plaintext writes and mixed project/user vault scope", async () => {
  const { db, sql, migrate } = await fixture();
  try {
    await migrate(ring());
    await assert.rejects(sql.query("update studio_settings set mangools_key=$1 where user_id='owner-a'", [syntheticSecret()]));
    await assert.rejects(sql.query("update studio_settings set monday_webhook=$1 where user_id='owner-a'", [syntheticSecret()]));
    await assert.rejects(sql.query("update clickup_settings set api_key=$1 where user_id='owner-a'", [syntheticSecret()]));
    await assert.rejects(sql.query("update credential_vault set project_id='guessed-project' where owner_user_id='owner-a'"));
  } finally { await db.close(); }
});

test("existing encrypted/plaintext conflicts and tampering are preserved for operator resolution", async () => {
  const { db, sql, schema, secrets } = await fixture();
  try {
    await db.exec(schema);
    const keyring = ring();
    await writeSettingsSecret(sql, "owner-a", "mangools", syntheticSecret(), keyring);
    for (const configured of [keyring, ring()]) {
      await assert.rejects(db.transaction((tx) => migrateLegacySettingsSecrets(sqlFor(tx), configured)), { message: "settings_credentials_migration_failed" });
      assert.ok((await sql.query<{ mangools_key: string }>("select mangools_key from studio_settings where user_id='owner-a'"))[0].mangools_key === secrets.mangools);
      assert.equal((await sql.query("select id from credential_vault")).length, 1);
    }
  } finally { await db.close(); }
});

test("an empty installation applies without a key and records no synthetic credentials", async () => {
  const { db, sql, schema } = await fixture();
  try {
    await sql.query("delete from studio_settings");
    await sql.query("delete from clickup_settings");
    const result = await db.transaction(async (tx) => {
      await tx.exec(schema);
      return migrateLegacySettingsSecrets(sqlFor(tx), { activeVersion: 0, keys: {} });
    });
    assert.deepEqual(result, { migrated: 0 });
    assert.equal((await sql.query("select id from credential_vault")).length, 0);
  } finally { await db.close(); }
});

test("vault configuration validates versions/base64 without exposing malformed input", () => {
  const key = randomBytes(32).toString("base64");
  assert.equal(settingsVaultKeyring({ MAZ_ROBOT_VAULT_KEY: key }).activeVersion, 1);
  assert.equal(settingsVaultKeyring({ MAZ_ROBOT_VAULT_KEYS: JSON.stringify({ 1: key }), MAZ_ROBOT_VAULT_ACTIVE_VERSION: "1" }).keys[1] === key, true);
  const invalid: Record<string, string | undefined>[] = [
    {}, { MAZ_ROBOT_VAULT_KEY: "private-malformed-input" },
    { MAZ_ROBOT_VAULT_KEYS: "{private-malformed-input" },
    { MAZ_ROBOT_VAULT_KEYS: "[]" },
    { MAZ_ROBOT_VAULT_KEYS: JSON.stringify({ "01": key }) },
    { MAZ_ROBOT_VAULT_KEYS: JSON.stringify({ 1: key }), MAZ_ROBOT_VAULT_ACTIVE_VERSION: "2" },
    { MAZ_ROBOT_VAULT_KEY: key, MAZ_ROBOT_VAULT_ACTIVE_VERSION: "0" },
    { MAZ_ROBOT_VAULT_KEY: key, MAZ_ROBOT_VAULT_ACTIVE_VERSION: "1.5" },
    { MAZ_ROBOT_VAULT_KEY: key, MAZ_ROBOT_VAULT_ACTIVE_VERSION: "9007199254740992" },
  ];
  for (const env of invalid) assert.throws(() => settingsVaultKeyring(env), { message: "settings_credentials_unavailable" });
});
