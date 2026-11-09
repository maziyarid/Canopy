import type { Sql } from "./sql-client.ts";
import { migrateLegacySettingsSecrets } from "./server/settings-vault.server.ts";

export const ENCRYPTED_SETTINGS_MIGRATION = "0013_encrypted_settings.sql";

/**
 * Called inside the same pinned transaction as the schema and migration marker.
 * A failed encryption/backfill leaves neither a partial move nor a done marker.
 */
export async function applyApplicationMigration(
  name: string,
  source: string,
  sql: Sql,
  executeSchema: (source: string) => Promise<unknown>,
) {
  try {
    await executeSchema(source);
    if (name === ENCRYPTED_SETTINGS_MIGRATION) await migrateLegacySettingsSecrets(sql);
    await sql.query("insert into _migrations (name) values ($1)", [name]);
  } catch (error) {
    // PostgreSQL details/constraint diagnostics may contain legacy row values.
    // Do not attach the original error as a cause on this secret-bearing path.
    if (name === ENCRYPTED_SETTINGS_MIGRATION) {
      throw new Error("settings_credentials_migration_failed");
    }
    throw error;
  }
}
