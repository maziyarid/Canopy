#!/usr/bin/env node
import { Pool, types } from "pg";
import type { Sql } from "../../src/lib/db.ts";
import {
  processOnePublication,
  type PublicationContext,
  type PublicationJob,
} from "../../src/lib/social/publication-engine.ts";
import { createPublicationStore } from "../../src/lib/social/publication-store.server.ts";
import { resolveCredential, type VaultKeyring } from "../../src/lib/social/vault-store.server.ts";
import {
  publishTelegram,
  type TelegramMedia,
} from "../../src/lib/social/telegram.server.ts";

types.setTypeParser(20, Number);

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

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
      keys[n] = value;
    }
  } else if (env.MAZ_ROBOT_VAULT_KEY?.trim()) {
    keys[activeVersion] = env.MAZ_ROBOT_VAULT_KEY.trim();
  }

  if (!keys[activeVersion]) {
    throw new Error(`vault key version ${activeVersion} is not configured`);
  }
  return { activeVersion, keys };
}

function sqlFromPool(pool: Pool): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    const result = await pool.query(text, values);
    return result.rows as T[];
  }) as Sql;
  sql.query = async <T = Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
  ): Promise<T[]> => {
    const result = await pool.query(text, params);
    return result.rows as T[];
  };
  return sql;
}

export function telegramInput(context: PublicationContext) {
  const media: TelegramMedia[] = [];
  for (const item of context.mediaManifest) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const kind = row.kind;
    const url = typeof row.url === "string" ? row.url.trim() : "";
    if (!url || !["image", "video", "document"].includes(String(kind))) continue;
    media.push({
      kind: kind as TelegramMedia["kind"],
      url,
      ...(typeof row.caption === "string" && row.caption.trim()
        ? { caption: row.caption }
        : {}),
    });
  }
  return {
    chatId: context.accountRef,
    ...(context.body.trim() ? { text: context.body } : {}),
    ...(media.length ? { media } : {}),
  };
}

async function preflight(sql: Sql) {
  const rows = await sql.query<{ jobs: string | null; vault: string | null }>(
    "select to_regclass('public.social_publication_jobs')::text jobs, to_regclass('public.credential_vault')::text vault",
  );
  if (!rows[0]?.jobs || !rows[0]?.vault) {
    throw new Error("Maz Robot database migrations 0004/0005 are not applied");
  }
}

async function main() {
  const databaseUrl = required("DATABASE_URL");
  const keyring = parseVaultKeyring();
  const workerId = process.env.MAZ_ROBOT_WORKER_ID?.trim() || `maz-robot:${process.pid}`;
  const idleMs = Math.max(250, Math.min(Number(process.env.MAZ_ROBOT_IDLE_MS || 2000), 30000));
  const leaseSeconds = Math.max(30, Math.min(Number(process.env.MAZ_ROBOT_LEASE_SECONDS || 120), 3600));

  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const sql = sqlFromPool(pool);
  await preflight(sql);

  if (process.argv.includes("--check")) {
    console.log(JSON.stringify({ ok: true, workerId, database: "reachable", vault: "configured" }));
    await pool.end();
    return;
  }

  const store = createPublicationStore(sql, leaseSeconds);
  let stopping = false;
  const stop = () => { stopping = true; };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  const adapters = {
    telegram: {
      publish: async (context: PublicationContext, credential: string) => {
        const result = await publishTelegram(credential, telegramInput(context));
        return { providerPostIds: result.providerMessageIds };
      },
    },
  };

  console.log(JSON.stringify({ event: "maz_robot_worker_started", workerId }));
  try {
    while (!stopping) {
      const result = await processOnePublication({
        workerId,
        store,
        adapters,
        resolveCredential: (credentialRef: string, job: PublicationJob) =>
          resolveCredential(sql, keyring, {
            credentialRef,
            projectId: job.projectId,
            actorRef: `worker:${workerId}`,
          }),
      });
      if (result.state === "idle") {
        await new Promise((resolve) => setTimeout(resolve, idleMs));
      } else {
        console.log(JSON.stringify({
          event: "publication_iteration",
          workerId,
          state: result.state,
          jobId: "jobId" in result ? result.jobId : undefined,
          failureClass: "failureClass" in result ? result.failureClass : undefined,
        }));
      }
    }
  } finally {
    await pool.end();
    console.log(JSON.stringify({ event: "maz_robot_worker_stopped", workerId }));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(JSON.stringify({
      event: "maz_robot_worker_fatal",
      error: error instanceof Error ? error.message : String(error),
    }));
    process.exitCode = 78;
  });
}
