import type { Sql } from "../db.ts";
import type { StudioSettings } from "../types.ts";
import type { VaultKeyring } from "../social/vault-store.server.ts";
import type { ClickUpSettingsRow, PublicClickUpSettings } from "./query-builders.ts";
import { commitMangoolsKey } from "./mangools-bind.ts";
import { hasSettingsSecret, readSettingsSecret, writeSettingsSecret } from "./settings-vault.server.ts";

export const MASKED_SETTINGS_SECRET = "••••••••";

type StudioPreferences = {
  default_location_id: number;
  default_language_id: number;
};

type ClickUpPreferences = Omit<ClickUpSettingsRow, "api_key">;

export type StudioSettingsInput = {
  mangoolsKey?: string;
  mondayWebhook?: string;
  defaultLocationId?: number;
  defaultLanguageId?: number;
};

export type ClickUpSettingsInput = {
  apiKey?: string;
  teamId?: string;
  folderId?: string;
  listId?: string;
};

function requireOwner(ownerId: string) {
  if (!ownerId) throw new Error("Unauthorised");
}

async function transaction<T>(sql: Sql, work: (tx: Sql) => Promise<T>): Promise<T> {
  if (!sql.transaction) throw new Error("Settings transaction is unavailable");
  return sql.transaction(work);
}

export async function publicStudioSettings(sql: Sql, ownerId: string): Promise<StudioSettings> {
  requireOwner(ownerId);
  const [rows, hasKey, hasHook] = await Promise.all([
    sql.query<StudioPreferences>(
      "select default_location_id,default_language_id from studio_settings where user_id=$1",
      [ownerId],
    ),
    hasSettingsSecret(sql, ownerId, "mangools"),
    hasSettingsSecret(sql, ownerId, "monday_webhook"),
  ]);
  return {
    hasKey,
    mondayWebhook: hasHook ? MASKED_SETTINGS_SECRET : "",
    defaultLocationId: Number(rows[0]?.default_location_id ?? 2840),
    defaultLanguageId: Number(rows[0]?.default_language_id ?? 1000),
  };
}

export async function saveStudioSettingsRecord(
  sql: Sql,
  ownerId: string,
  input: StudioSettingsInput,
  validateMangools: (candidate: string) => Promise<boolean>,
  keyring?: VaultKeyring,
) {
  requireOwner(ownerId);
  const candidate = input.mangoolsKey?.trim();
  let mangoolsKey: string | undefined;
  if (candidate && candidate !== MASKED_SETTINGS_SECRET) {
    try {
      mangoolsKey = await commitMangoolsKey({
        existingKey: "",
        candidateKey: candidate,
        validate: validateMangools,
      });
    } catch {
      // Neither provider responses nor submitted credentials belong in errors.
      throw new Error("Mangools key validation failed");
    }
  }
  const hook = input.mondayWebhook?.trim();
  return transaction(sql, async (tx) => {
    await tx.query("insert into studio_settings(user_id) values($1) on conflict(user_id) do nothing", [ownerId]);
    const rows = await tx.query<StudioPreferences>(
      "select default_location_id,default_language_id from studio_settings where user_id=$1 for update",
      [ownerId],
    );
    if (mangoolsKey !== undefined) await writeSettingsSecret(tx, ownerId, "mangools", mangoolsKey, keyring);
    if (hook !== undefined && hook !== MASKED_SETTINGS_SECRET) {
      await writeSettingsSecret(tx, ownerId, "monday_webhook", hook, keyring);
    }
    await tx.query(
      "update studio_settings set default_location_id=$2,default_language_id=$3 where user_id=$1",
      [ownerId, input.defaultLocationId ?? rows[0]?.default_location_id ?? 2840, input.defaultLanguageId ?? rows[0]?.default_language_id ?? 1000],
    );
    return { ok: true as const, hasKey: await hasSettingsSecret(tx, ownerId, "mangools") };
  });
}

export async function publicClickUpSettings(sql: Sql, ownerId: string): Promise<PublicClickUpSettings> {
  requireOwner(ownerId);
  const [rows, hasApiKey] = await Promise.all([
    sql.query<ClickUpPreferences>("select team_id,folder_id,list_id from clickup_settings where user_id=$1", [ownerId]),
    hasSettingsSecret(sql, ownerId, "clickup"),
  ]);
  return {
    hasApiKey,
    teamId: rows[0]?.team_id ?? "",
    folderId: rows[0]?.folder_id ?? "",
    listId: rows[0]?.list_id ?? "",
  };
}

export async function saveClickUpSettingsRecord(
  sql: Sql,
  ownerId: string,
  input: ClickUpSettingsInput,
  keyring?: VaultKeyring,
) {
  requireOwner(ownerId);
  const candidate = input.apiKey?.trim();
  return transaction(sql, async (tx) => {
    await tx.query("insert into clickup_settings(user_id,api_key) values($1,'') on conflict(user_id) do nothing", [ownerId]);
    const rows = await tx.query<ClickUpPreferences>(
      "select team_id,folder_id,list_id from clickup_settings where user_id=$1 for update",
      [ownerId],
    );
    if (candidate && candidate !== MASKED_SETTINGS_SECRET) {
      await writeSettingsSecret(tx, ownerId, "clickup", candidate, keyring);
    } else if (!(await hasSettingsSecret(tx, ownerId, "clickup"))) {
      throw new Error("ClickUp is not configured");
    }
    await tx.query(
      "update clickup_settings set team_id=$2,folder_id=$3,list_id=$4,updated_at=now() where user_id=$1",
      [ownerId, input.teamId?.trim() || rows[0]?.team_id || "", input.folderId?.trim() || rows[0]?.folder_id || "", input.listId?.trim() || rows[0]?.list_id || ""],
    );
    return { ok: true as const, message: "ClickUp settings saved successfully", ...await publicClickUpSettings(tx, ownerId) };
  });
}

/** Private provider input only. The public response is built from metadata. */
export async function loadClickUpSettingsRecord(sql: Sql, ownerId: string, keyring?: VaultKeyring): Promise<ClickUpSettingsRow> {
  requireOwner(ownerId);
  const rows = await sql.query<ClickUpPreferences>(
    "select team_id,folder_id,list_id from clickup_settings where user_id=$1 limit 1",
    [ownerId],
  );
  if (!rows[0]) throw new Error("ClickUp is not configured");
  const apiKey = await readSettingsSecret(sql, ownerId, "clickup", keyring);
  if (!apiKey) throw new Error("ClickUp is not configured");
  return { ...rows[0], api_key: apiKey };
}
