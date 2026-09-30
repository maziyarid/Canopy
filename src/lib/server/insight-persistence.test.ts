import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { persistSnapshotInsights, createManualNote, changeNote, readPeriodNotes } from "./insight-persistence.ts";
import { buildReportingSnapshot, type SnapshotSql } from "./reporting-snapshot-service.ts";

const access = { role: "owner" as const, filter: "", project: { id: "p1", domain: "example.com" } };
const snapshot = buildReportingSnapshot({ projectId: "p1", site: "example.com", period: { start: "2026-09-01", end: "2026-09-28", label: "last_28d" }, comparison: null, requestedAt: "t", generatedAt: "t", correlationId: "c", ledgerAvailable: true, rows: [{ provider: "gsc", status: "ok", lastSuccess: "2026-09-29", lastAttempt: null, freshness: "2026-09-28", lastError: null, metricName: "clicks", metricValue: 12, dataDate: "2026-09-28" }] });

test("notes persist independently, cannot cross projects, require review and keep edit history", async () => {
  const directory = await mkdtemp(join(tmpdir(), "insight-storage-"));
  let db = new PGlite(directory);
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => (await db.query(strings.reduce((out, part, i) => out + (i ? `$${i}` : "") + part, ""), values)).rows) as SnapshotSql;
  try {
    await db.exec(`create table report_insights(id text primary key, project_id text not null, site text not null, period_start date not null, period_end date not null, generated_at timestamptz not null, revision integer not null default 0, payload text not null);
      create table operation_receipts(id text primary key,project_id text,actor_ref text,operation text,target_ref text,status text,evidence text);`);
    await persistSnapshotInsights(sql, access, snapshot);
    await persistSnapshotInsights(sql, access, snapshot);
    assert.equal((await readPeriodNotes(sql, access, snapshot.period)).length, 1);
    assert.deepEqual(await readPeriodNotes(sql, { ...access, role: "client", reportSections: ["search"] }, snapshot.period), []);
    const note = await createManualNote(sql, access, snapshot, { title: "Observed clicks", body: "Observed 12 clicks; investigate the landing pages.", provider: "gsc", metricName: "clicks" }, "owner-1");
    assert.equal(note.generatedBy, "human:owner-1");
    await assert.rejects(changeNote(sql, { ...access, project: { id: "p2", domain: "other.example" } }, note.id, 0, { action: "approve" }, "owner-2"), /Not found/);
    await assert.rejects(changeNote(sql, { ...access, role: "client" }, note.id, 0, { action: "approve" }, "client"), /Forbidden/);
    await changeNote(sql, access, note.id, 0, { action: "approve" }, "owner-1");
    assert.equal((await readPeriodNotes(sql, { ...access, role: "client", reportSections: ["search"] }, snapshot.period)).length, 1);
    assert.deepEqual(await readPeriodNotes(sql, { ...access, role: "client", reportSections: ["overview"] }, snapshot.period), []);
    await assert.rejects(changeNote(sql, access, note.id, 0, { action: "edit", title: "Stale edit", body: "Stale edit" }, "owner-1"), /changed/);
    await changeNote(sql, access, note.id, 1, { action: "edit", title: "Updated observation", body: "Needs further verification." }, "editor-1");
    assert.deepEqual(await readPeriodNotes(sql, { ...access, role: "client", reportSections: ["search"] }, snapshot.period), []);
    await db.close(); db = new PGlite(directory);
    const stored = (await readPeriodNotes(sql, access, snapshot.period)).find(row => row.id === note.id)!;
    assert.equal(stored.body, "Needs further verification.");
    assert.equal(stored.editHistory[0].previousBody, note.body);
    assert.equal(stored.editHistory[0].editedBy, "editor-1");
    assert.equal(stored.reviewState, "pending_review");
    assert.equal(snapshot.sections.find(row => row.key === "search")?.metrics[0].value, 12);
  } finally { await db.close(); await rm(directory, { recursive: true, force: true }); }
});
