import type { VaultKeyring } from "./vault-store.server.ts";

export function parseVaultKeyring(env: NodeJS.ProcessEnv = process.env): VaultKeyring {
  const activeVersion = Number(env.MAZ_ROBOT_VAULT_ACTIVE_VERSION || "1");
  if (!Number.isInteger(activeVersion) || activeVersion < 1) {
    throw new Error("MAZ_ROBOT_VAULT_ACTIVE_VERSION must be a positive integer");
  }

  const keys: Record<number, string> = {};
  if (env.MAZ_ROBOT_VAULT_KEYS?.trim()) {
    const parsed = JSON.parse(env.MAZ_ROBOT_VAULT_KEYS);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("MAZ_ROBOT_VAULT_KEYS must be a JSON object");
    }
    for (const [version, value] of Object.entries(parsed)) {
      const n = Number(version);
      if (!Number.isInteger(n) || n < 1 || typeof value !== "string" || !value.trim()) {
        throw new Error("MAZ_ROBOT_VAULT_KEYS contains an invalid entry");
      }
      keys[n] = value.trim();
    }
  } else if (env.MAZ_ROBOT_VAULT_KEY?.trim()) {
    keys[activeVersion] = env.MAZ_ROBOT_VAULT_KEY.trim();
  }

  if (!keys[activeVersion]) {
    throw new Error("vault key version " + activeVersion + " is not configured");
  }
  return { activeVersion, keys };
}
