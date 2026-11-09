import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  applyApplicationMigration,
  ENCRYPTED_SETTINGS_MIGRATION,
} from "./application-migrations.ts";
import { createSqlClient, type Sql } from "./sql-client.ts";
import { readSettingsSecret } from "./server/settings-vault.server.ts";
import { pendingMigrations } from "../../scripts/migration-plan.mjs";

const dir = new URL("../../migrations/", import.meta.url);

async function fixture() {
  const db = new PGlite();
  await db.exec("create table _migrations(name text primary key)");
  for (const name of (await readdir(dir))
    .filter((name) => name.endsWith(".sql") && name < ENCRYPTED_SETTINGS_MIGRATION)
    .sort()) {
    await db.transaction(async (tx) => {
      const sql = createSqlClient(
        async <T>(text: string, params: unknown[]) => (await tx.query<T>(text, params)).rows,
      );
      await applyApplicationMigration(
        name,
        await readFile(new URL(name, dir), "utf8"),
        sql,
        (source) => tx.exec(source),
      );
    });
  }
  const source = await readFile(new URL(ENCRYPTED_SETTINGS_MIGRATION, dir), "utf8");
  const migrate = (wrap: (sql: Sql) => Sql = (sql) => sql) =>
    db.transaction(async (tx) => {
      const sql = createSqlClient(
        async <T>(text: string, params: unknown[]) => (await tx.query<T>(text, params)).rows,
      );
      await applyApplicationMigration(ENCRYPTED_SETTINGS_MIGRATION, source, wrap(sql), (text) =>
        tx.exec(text),
      );
    });
  return { db, migrate };
}

async function withKey<T>(key: string | undefined, work: () => Promise<T>) {
  const names = ["MAZ_ROBOT_VAULT_KEY", "MAZ_ROBOT_VAULT_KEYS", "MAZ_ROBOT_VAULT_ACTIVE_VERSION"];
  const previous = names.map((name) => process.env[name]);
  names.forEach((name) => delete process.env[name]);
  if (key) process.env.MAZ_ROBOT_VAULT_KEY = key;
  try {
    return await work();
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
}

test("schema, actual secret backfill and migration marker commit together", async () => {
  const { db, migrate } = await fixture();
  const secret = randomBytes(24).toString("hex");
  const key = randomBytes(32).toString("base64");
  try {
    await db.query(
      "insert into studio_settings(user_id,mangools_key,default_language_id) values('owner-without-project',$1,1065)",
      [secret],
    );
    await withKey(key, migrate);
    const sql = createSqlClient(
      async <T>(text: string, params: unknown[]) => (await db.query<T>(text, params)).rows,
    );
    assert.equal(
      (await readSettingsSecret(sql, "owner-without-project", "mangools", {
        activeVersion: 1,
        keys: { 1: key },
      })) === secret,
      true,
    );
    const rows = await db.query<{ mangools_key: string; default_language_id: number }>(
      "select mangools_key,default_language_id from studio_settings",
    );
    assert.equal(rows.rows[0].mangools_key === "", true);
    assert.equal(rows.rows[0].default_language_id, 1065);
    const done = (await db.query<{ name: string }>("select name from _migrations")).rows.map(
      (row) => row.name,
    );
    assert.equal(done.includes(ENCRYPTED_SETTINGS_MIGRATION), true);
    assert.deepEqual(pendingMigrations(await readdir(dir), done), []);
    const constraints = await db.query<{ convalidated: boolean }>(
      "select convalidated from pg_constraint where conname in ('studio_settings_mangools_encrypted','studio_settings_monday_encrypted','clickup_settings_key_encrypted')",
    );
    assert.equal(constraints.rows.length, 3);
    assert.equal(
      constraints.rows.every((row) => row.convalidated),
      true,
    );
    await assert.rejects(
      db.query("update studio_settings set mangools_key=$1", [secret]),
      (error: any) => error.code === "23514",
    );
  } finally {
    await db.close();
  }
});

test("missing key rolls back schema, ciphertext and done marker without logging legacy values", async () => {
  const { db, migrate } = await fixture();
  const secret = randomBytes(24).toString("hex");
  try {
    await db.query("insert into studio_settings(user_id,mangools_key) values('owner',$1)", [
      secret,
    ]);
    await withKey(undefined, async () => {
      await assert.rejects(
        migrate(),
        (error: any) =>
          error.message === "settings_credentials_migration_failed" &&
          error.cause === undefined &&
          !String(error.stack).includes(secret),
      );
    });
    assert.equal(
      (await db.query("select name from _migrations where name=$1", [ENCRYPTED_SETTINGS_MIGRATION]))
        .rows.length,
      0,
    );
    assert.equal((await db.query("select id from credential_vault")).rows.length, 0);
    assert.equal(
      (await db.query<{ mangools_key: string }>("select mangools_key from studio_settings")).rows[0]
        .mangools_key === secret,
      true,
    );
    assert.equal(
      (
        await db.query(
          "select column_name from information_schema.columns where table_name='credential_vault' and column_name='owner_user_id'",
        )
      ).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});

test("marker persistence failure rolls back already encrypted values and clearing", async () => {
  const { db, migrate } = await fixture();
  const secret = randomBytes(24).toString("hex");
  const key = randomBytes(32).toString("base64");
  try {
    await db.query(
      "insert into clickup_settings(user_id,api_key,list_id) values('owner',$1,'existing-list')",
      [secret],
    );
    await withKey(key, async () => {
      await assert.rejects(
        migrate((sql) =>
          createSqlClient(async <T>(text: string, params: unknown[]) => {
            if (text.startsWith("insert into _migrations")) throw new Error(secret);
            return sql.query<T>(text, params);
          }),
        ),
        (error: any) =>
          error.message === "settings_credentials_migration_failed" &&
          !String(error.stack).includes(secret),
      );
    });
    assert.equal(
      (
        await db.query<{ api_key: string; list_id: string }>(
          "select api_key,list_id from clickup_settings",
        )
      ).rows[0].api_key === secret,
      true,
    );
    assert.equal((await db.query("select id from credential_vault")).rows.length, 0);
    assert.equal(
      (await db.query("select name from _migrations where name=$1", [ENCRYPTED_SETTINGS_MIGRATION]))
        .rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});

test("fresh empty settings schema migrates without generating or requiring a vault key", async () => {
  const { db, migrate } = await fixture();
  try {
    await withKey(undefined, migrate);
    assert.equal(
      (await db.query("select name from _migrations where name=$1", [ENCRYPTED_SETTINGS_MIGRATION]))
        .rows.length,
      1,
    );
    assert.equal((await db.query("select id from credential_vault")).rows.length, 0);
  } finally {
    await db.close();
  }
});
