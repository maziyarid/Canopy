import { randomUUID } from "node:crypto";
import type { Sql } from "../db.ts";
import { assertAppDataServerOnly } from "../app-data/server-only.ts";
import {
  decryptCredential,
  encryptCredential,
  type VaultCiphertext,
} from "../social/credential-vault.server.ts";
import type { VaultKeyring } from "../social/vault-store.server.ts";

assertAppDataServerOnly("server/settings-vault.server");

export type SettingsSecretProvider = "mangools" | "monday_webhook" | "clickup";

const PROVIDERS: readonly string[] = ["mangools", "monday_webhook", "clickup"];
const UNAVAILABLE = "settings_credentials_unavailable";
const MIGRATION_FAILED = "settings_credentials_migration_failed";

type SettingsVaultRow = {
  id: string;
  owner_user_id: string;
  provider: SettingsSecretProvider;
  key_version: number;
  algorithm: "aes-256-gcm";
  nonce_b64: string;
  ciphertext_b64: string;
  auth_tag_b64: string;
};

function assertScope(ownerId: string, provider: SettingsSecretProvider) {
  if (typeof ownerId !== "string" || !ownerId || ownerId.trim() !== ownerId || !PROVIDERS.includes(provider)) {
    throw new Error(UNAVAILABLE);
  }
}

function validVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function validKey(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9+/]{43}=$/.test(value)
    && Buffer.from(value, "base64").length === 32
    && Buffer.from(value, "base64").toString("base64") === value;
}

function checkedKeyring(keyring: VaultKeyring): VaultKeyring {
  if (!keyring || !validVersion(keyring.activeVersion) || !keyring.keys || typeof keyring.keys !== "object" || Array.isArray(keyring.keys)) {
    throw new Error(UNAVAILABLE);
  }
  for (const [version, key] of Object.entries(keyring.keys)) {
    if (!/^[1-9]\d*$/.test(version) || !validVersion(Number(version)) || !validKey(key)) {
      throw new Error(UNAVAILABLE);
    }
  }
  if (!validKey(keyring.keys[keyring.activeVersion])) throw new Error(UNAVAILABLE);
  return keyring;
}

/** The application and migration use protected, operator-provisioned vault keys. */
export function settingsVaultKeyring(
  env: Record<string, string | undefined> = process.env,
): VaultKeyring {
  try {
    const rawVersion = env.MAZ_ROBOT_VAULT_ACTIVE_VERSION?.trim() || "1";
    if (!/^[1-9]\d*$/.test(rawVersion)) throw new Error(UNAVAILABLE);
    const activeVersion = Number(rawVersion);
    const keys: Record<number, string> = {};
    if (env.MAZ_ROBOT_VAULT_KEYS?.trim()) {
      const parsed: unknown = JSON.parse(env.MAZ_ROBOT_VAULT_KEYS);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(UNAVAILABLE);
      for (const [version, key] of Object.entries(parsed)) {
        if (!/^[1-9]\d*$/.test(version) || !validVersion(Number(version)) || !validKey(key)) throw new Error(UNAVAILABLE);
        keys[Number(version)] = key;
      }
    }
    if (env.MAZ_ROBOT_VAULT_KEY?.trim()) {
      const key = env.MAZ_ROBOT_VAULT_KEY.trim();
      if (keys[activeVersion] !== undefined && keys[activeVersion] !== key) throw new Error(UNAVAILABLE);
      keys[activeVersion] = key;
    }
    return checkedKeyring({ activeVersion, keys });
  } catch {
    // JSON parser messages and driver/crypto errors can contain secret input.
    throw new Error(UNAVAILABLE);
  }
}

function aad(ownerId: string, provider: SettingsSecretProvider, credentialId: string) {
  return JSON.stringify(["ms-robot:user-settings:v1", ownerId, provider, credentialId]);
}

async function settingsRow(sql: Sql, ownerId: string, provider: SettingsSecretProvider) {
  assertScope(ownerId, provider);
  const rows = await sql.query<SettingsVaultRow>(
    `select id,owner_user_id,provider,key_version,algorithm,nonce_b64,ciphertext_b64,auth_tag_b64
     from credential_vault
     where owner_user_id=$1 and provider=$2 and tenant_id='' and project_id=''`,
    [ownerId, provider],
  );
  if (rows.length > 1) throw new Error(UNAVAILABLE);
  return rows[0];
}

export async function hasSettingsSecret(sql: Sql, ownerId: string, provider: SettingsSecretProvider): Promise<boolean> {
  try {
    return Boolean(await settingsRow(sql, ownerId, provider));
  } catch {
    throw new Error(UNAVAILABLE);
  }
}

/** Secret plaintext is returned only to server-side provider callers. */
export async function readSettingsSecret(
  sql: Sql,
  ownerId: string,
  provider: SettingsSecretProvider,
  keyring?: VaultKeyring,
): Promise<string> {
  try {
    const row = await settingsRow(sql, ownerId, provider);
    if (!row) return "";
    const ring = checkedKeyring(keyring ?? settingsVaultKeyring());
    const key = ring.keys[Number(row.key_version)];
    if (!key) throw new Error(UNAVAILABLE);
    const encrypted: VaultCiphertext = {
      keyVersion: Number(row.key_version), algorithm: row.algorithm,
      nonceB64: row.nonce_b64, ciphertextB64: row.ciphertext_b64, authTagB64: row.auth_tag_b64,
    };
    return decryptCredential(encrypted, key, aad(ownerId, provider, row.id));
  } catch {
    throw new Error(UNAVAILABLE);
  }
}

/** Caller owns the settings transaction; the statement itself writes ciphertext only. */
export async function writeSettingsSecret(
  sql: Sql,
  ownerId: string,
  provider: SettingsSecretProvider,
  plaintext: string,
  keyring?: VaultKeyring,
): Promise<void> {
  try {
    assertScope(ownerId, provider);
    if (typeof plaintext !== "string") throw new Error(UNAVAILABLE);
    if (!plaintext) {
      await sql.query("delete from credential_vault where owner_user_id=$1 and provider=$2 and tenant_id='' and project_id=''", [ownerId, provider]);
      return;
    }
    const ring = checkedKeyring(keyring ?? settingsVaultKeyring());
    const id = randomUUID();
    const encrypted = encryptCredential(plaintext, ring.keys[ring.activeVersion], aad(ownerId, provider, id), ring.activeVersion);
    await sql.query(
      `insert into credential_vault
       (id,tenant_id,project_id,owner_user_id,provider,label,key_version,algorithm,nonce_b64,ciphertext_b64,auth_tag_b64,created_by)
       values($1,'','',$2,$3,'User integration setting',$4,$5,$6,$7,$8,$2)
       on conflict(owner_user_id,provider) where owner_user_id<>'' do update set
         id=excluded.id,key_version=excluded.key_version,algorithm=excluded.algorithm,
         nonce_b64=excluded.nonce_b64,ciphertext_b64=excluded.ciphertext_b64,
         auth_tag_b64=excluded.auth_tag_b64,updated_at=now()`,
      [id, ownerId, provider, encrypted.keyVersion, encrypted.algorithm, encrypted.nonceB64, encrypted.ciphertextB64, encrypted.authTagB64],
    );
  } catch {
    throw new Error(UNAVAILABLE);
  }
}

/**
 * Run only inside the schema applier's pinned PostgreSQL/PGlite transaction.
 * Lock the legacy tables so encryption, plaintext clearing and validation have
 * a single atomic outcome, including concurrent application/migration writers.
 */
export async function migrateLegacySettingsSecrets(sql: Sql, keyring?: VaultKeyring): Promise<{ migrated: number }> {
  try {
    await sql.query("lock table studio_settings,clickup_settings in share row exclusive mode");
    const studio = await sql.query<{ user_id: string; mangools_key: string; monday_webhook: string }>(
      "select user_id,mangools_key,monday_webhook from studio_settings where mangools_key<>'' or monday_webhook<>'' order by user_id",
    );
    const clickup = await sql.query<{ user_id: string; api_key: string }>(
      "select user_id,api_key from clickup_settings where api_key<>'' order by user_id",
    );
    const candidates: { ownerId: string; provider: SettingsSecretProvider; plaintext: string }[] = [];
    for (const row of studio) {
      if (row.mangools_key) candidates.push({ ownerId: row.user_id, provider: "mangools", plaintext: row.mangools_key });
      if (row.monday_webhook) candidates.push({ ownerId: row.user_id, provider: "monday_webhook", plaintext: row.monday_webhook });
    }
    for (const row of clickup) candidates.push({ ownerId: row.user_id, provider: "clickup", plaintext: row.api_key });
    const ring = candidates.length ? checkedKeyring(keyring ?? settingsVaultKeyring()) : undefined;
    for (const candidate of candidates) {
      const existing = await settingsRow(sql, candidate.ownerId, candidate.provider);
      if (existing) {
        // Do not overwrite an inconsistent/tampered encrypted value by guessing
        // that the older plaintext is authoritative.
        const current = await readSettingsSecret(sql, candidate.ownerId, candidate.provider, ring);
        if (current !== candidate.plaintext) throw new Error(MIGRATION_FAILED);
      } else {
        await writeSettingsSecret(sql, candidate.ownerId, candidate.provider, candidate.plaintext, ring);
        // Verify the persisted envelope, not merely the in-memory encryption,
        // before removing the only legacy copy in this transaction.
        const persisted = await readSettingsSecret(sql, candidate.ownerId, candidate.provider, ring);
        if (persisted !== candidate.plaintext) throw new Error(MIGRATION_FAILED);
      }
    }
    await sql.query("update studio_settings set mangools_key='',monday_webhook='' where mangools_key<>'' or monday_webhook<>''");
    await sql.query("update clickup_settings set api_key='' where api_key<>''");
    await sql.query("alter table studio_settings validate constraint studio_settings_mangools_encrypted");
    await sql.query("alter table studio_settings validate constraint studio_settings_monday_encrypted");
    await sql.query("alter table clickup_settings validate constraint clickup_settings_key_encrypted");
    return { migrated: candidates.length };
  } catch {
    throw new Error(MIGRATION_FAILED);
  }
}
