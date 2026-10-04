#!/usr/bin/env node
import { Pool, types } from "pg";
import type { Sql } from "../../src/lib/db.ts";
import {
  createPublicationStore,
  type PublicationReconciliationDecision,
} from "../../src/lib/social/publication-store.server.ts";

types.setTypeParser(20, Number);

type ParsedArgs =
  | { mode: "list"; limit: number }
  | {
      mode: "reconcile";
      jobId: string;
      actorRef: string;
      decision: PublicationReconciliationDecision;
    };

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
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

function parseEvidence(raw: string | undefined) {
  if (!raw?.trim()) throw new Error("--evidence-json is required");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--evidence-json must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export function parseReconcileArgs(argv: string[]): ParsedArgs {
  const values = new Map<string, string>();
  const providerPostIds: string[] = [];
  let list = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list-parked") {
      list = true;
      continue;
    }
    if (arg === "--provider-post-id") {
      const value = argv[++i]?.trim();
      if (!value) throw new Error("--provider-post-id requires a value");
      providerPostIds.push(value);
      continue;
    }
    if (![
      "--limit",
      "--reconcile",
      "--outcome",
      "--actor",
      "--evidence-json",
      "--provider-url",
      "--reason",
    ].includes(arg)) {
      throw new Error(`unknown argument: ${arg}`);
    }
    const value = argv[++i];
    if (!value) throw new Error(`${arg} requires a value`);
    values.set(arg, value);
  }

  if (list) {
    if (values.has("--reconcile") || values.has("--outcome")) {
      throw new Error("--list-parked cannot be combined with reconciliation arguments");
    }
    const limit = Number(values.get("--limit") ?? "100");
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new Error("--limit must be an integer from 1 to 500");
    }
    return { mode: "list", limit };
  }

  const jobId = values.get("--reconcile")?.trim();
  const actorRef = values.get("--actor")?.trim();
  const outcome = values.get("--outcome")?.trim();
  if (!jobId) throw new Error("--reconcile JOB_ID is required");
  if (!actorRef) throw new Error("--actor is required");
  if (!outcome || !["succeeded", "not-published", "dead"].includes(outcome)) {
    throw new Error("--outcome must be succeeded, not-published, or dead");
  }
  const evidence = parseEvidence(values.get("--evidence-json"));

  if (outcome === "succeeded") {
    const providerUrl = values.get("--provider-url")?.trim();
    if (!providerPostIds.length && !providerUrl) {
      throw new Error("succeeded reconciliation requires --provider-post-id or --provider-url");
    }
    return {
      mode: "reconcile",
      jobId,
      actorRef,
      decision: {
        outcome: "succeeded",
        receipt: {
          providerPostIds,
          ...(providerUrl ? { providerUrl } : {}),
        },
        evidence,
      },
    };
  }

  if (outcome === "dead") {
    const reason = values.get("--reason")?.trim();
    if (!reason) throw new Error("dead reconciliation requires --reason");
    return {
      mode: "reconcile",
      jobId,
      actorRef,
      decision: { outcome: "dead", reason, evidence },
    };
  }

  return {
    mode: "reconcile",
    jobId,
    actorRef,
    decision: { outcome: "not_published", evidence },
  };
}

async function main() {
  const args = parseReconcileArgs(process.argv.slice(2));
  const pool = new Pool({ connectionString: requiredEnv("DATABASE_URL"), max: 1 });
  const store = createPublicationStore(sqlFromPool(pool));

  try {
    if (args.mode === "list") {
      const parked = await store.listParked(args.limit);
      console.log(JSON.stringify({ parked }, null, 2));
      return;
    }

    const result = await store.reconcileParked(
      args.jobId,
      args.decision,
      args.actorRef,
      new Date(),
    );
    console.log(JSON.stringify({ ok: true, ...result }));
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }));
    process.exitCode = 78;
  });
}
