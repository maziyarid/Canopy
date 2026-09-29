import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pendingMigrations } from "./migration-plan.mjs";

const root = new URL("../migrations/", import.meta.url);

test("unified stack migrations apply in order on PGLite", async () => {
  const dir = root.pathname;
  const entries = await readdir(dir);
  const plan = pendingMigrations(entries, []);
  assert.deepEqual(plan.map((x) => x.name), [
    "0001_auth.sql", "0002_canopy.sql", "0003_clickup.sql", "0004_unified_stack.sql", "0005_social_runtime.sql", "0006_provider_sync_ledger.sql", "0007_provider_sync_project_idempotency.sql",
  ]);
  const db = new PGlite();
  try {
    for (const { name } of plan) await db.exec(await readFile(join(dir, name), "utf8"));
    const social = await db.query(
      "select tablename from pg_tables where schemaname='public' and tablename like 'social_%' order by tablename",
    );
    assert.deepEqual(social.rows.map((x) => x.tablename), [
      "social_connections", "social_content_items", "social_metrics",
      "social_publication_jobs", "social_publication_results", "social_schedules",
    ]);
    const shared = await db.query(
      "select tablename from pg_tables where schemaname='public' and tablename in ('tenants','provider_connections','provider_sync_runs','platform_capability_registry','workspace_entitlements','operation_receipts') order by tablename",
    );
    assert.equal(shared.rows.length, 6);
    const syncColumns = await db.query("select column_name from information_schema.columns where table_name='provider_sync_runs' and column_name in ('requested_start','requested_end','cursor_before','cursor_after','rows_received','rows_inserted','rows_updated','rows_skipped','rate_limit_state','quota_state','error_message_safe','data_freshness','code_version') order by column_name");
    assert.equal(syncColumns.rows.length, 13);

    await db.query(
      "insert into provider_sync_runs (id,project_id,provider,status,idempotency_key) values ($1,$2,$3,$4,$5),($6,$7,$8,$9,$10)",
      ["sync-a","project-a","gsc","completed","same-key","sync-b","project-b","gsc","completed","same-key"],
    );
    const scopedIdempotency = await db.query(
      "select project_id,idempotency_key from provider_sync_runs where idempotency_key='same-key' order by project_id",
    );
    assert.deepEqual(scopedIdempotency.rows, [
      { project_id: "project-a", idempotency_key: "same-key" },
      { project_id: "project-b", idempotency_key: "same-key" },
    ]);
    await assert.rejects(
      db.query(
        "insert into provider_sync_runs (id,project_id,provider,status,idempotency_key) values ($1,$2,$3,$4,$5)",
        ["sync-c","project-a","gsc","completed","same-key"],
      ),
    );

    const vault = await db.query("select tablename from pg_tables where schemaname='public' and tablename='credential_vault'");
    assert.equal(vault.rows.length, 1);
    const jobColumns = await db.query("select column_name from information_schema.columns where table_name='social_publication_jobs' and column_name in ('max_attempts','locked_by','lease_until','completed_at','dead_lettered_at','failure_class') order by column_name");
    assert.deepEqual(jobColumns.rows.map((x) => x.column_name), ['completed_at','dead_lettered_at','failure_class','lease_until','locked_by','max_attempts']);
  } finally {
    await db.close();
  }
});
