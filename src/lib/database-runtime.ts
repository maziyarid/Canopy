import { isAbsolute } from "node:path";

export function databaseRuntime(env: Record<string, string | undefined>) {
  const databaseUrl = env.DATABASE_URL?.trim() || undefined;
  const pgliteDataDir = env.PGLITE_DATA_DIR?.trim() || undefined;
  if (!databaseUrl && pgliteDataDir && !isAbsolute(pgliteDataDir)) throw new Error("PGLITE_DATA_DIR must be an absolute path");
  const durable = Boolean(databaseUrl || pgliteDataDir);
  if (env.NODE_ENV === "production" && !durable) throw new Error("A durable application database must be configured before serving production requests");
  if (!databaseUrl && pgliteDataDir && (env.BETTER_AUTH_SECRET?.trim().length ?? 0) < 32) throw new Error("Durable local storage requires a persistent BETTER_AUTH_SECRET of at least 32 characters");
  return { databaseUrl, pgliteDataDir, durable };
}
