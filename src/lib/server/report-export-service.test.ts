import test from "node:test";
import assert from "node:assert/strict";
import { exportReportRecord } from "./report-export-service.ts";
import type { SnapshotSql } from "./reporting-snapshot-service.ts";

test("export rechecks membership and cannot read data from an inaccessible project", async () => {
  let reads = 0;
  await assert.rejects(exportReportRecord({ sql: (async () => []) as unknown as SnapshotSql, resolveAccess: async () => { throw new Error("Forbidden"); }, userId: "u", email: "", projectId: "other", readLedger: async () => { reads++; return { rows: [], available: true }; } }), /Not found/);
  assert.equal(reads, 0);
});

test("client CSV follows current grants and records a content-free audit receipt", async () => {
  const audit: unknown[][] = [];
  const sql = (async (_strings: TemplateStringsArray, ...values: unknown[]) => { audit.push([_strings.join("?"), ...values]); return []; }) as unknown as SnapshotSql;
  const result = await exportReportRecord({ sql, resolveAccess: async () => ({ role: "client", filter: "", reportSections: ["overview"], project: { id: "p1", domain: "example.com" } }), userId: "u", email: "", projectId: "p1", readLedger: async () => ({ available: true, rows: [{ provider: "gsc", status: "ok", metricName: "clicks", metricValue: 777, lastSuccess: null, lastAttempt: null, freshness: null, lastError: null }] }) });
  assert.doesNotMatch(result.content, /777/);
  assert.equal(audit.length, 1); assert.match(String(audit[0][0]), /report.export.csv/);
  assert.doesNotMatch(JSON.stringify(audit), /777|example.com/);
});

test("failed export audit refuses delivery instead of silently losing accountability", async () => {
  await assert.rejects(exportReportRecord({ sql: (async () => { throw new Error("audit unavailable"); }) as unknown as SnapshotSql, resolveAccess: async () => ({ role: "owner", filter: "", project: { id: "p1", domain: "example.com" } }), userId: "u", email: "", projectId: "p1", readLedger: async () => ({ rows: [], available: true }) }), /audit unavailable/);
});
