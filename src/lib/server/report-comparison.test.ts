import test from "node:test";
import assert from "node:assert/strict";
import { loadReportingSnapshot, snapshotCache, type SnapshotSql } from "./reporting-snapshot-service.ts";

const sql = (async () => []) as unknown as SnapshotSql;
const owner = { role: "owner" as const, filter: "", project: { id: "p1", domain: "example.com" } };
const now = new Date("2026-10-03T12:00:00Z");
const opts = { sql, resolveAccess: async () => owner, userId: "owner", email: "", projectId: "p1", now, periodLabel: "last_7d" };
const measured = (value: number) => ({ provider: "gsc", status: "ok", lastSuccess: "2026-10-03", lastAttempt: null, freshness: "2026-10-01", lastError: null, metricName: "clicks", metricValue: value, dataDate: "2026-10-01" });

test("comparison loads the actual preceding window and stores its independent values", async () => {
  snapshotCache.clear();
  const requests: string[] = [];
  const snapshot = await loadReportingSnapshot({ ...opts, readLedger: async (_project, _site, period) => { requests.push(`${period.start}/${period.end}`); return { rows: [measured(period.start === "2026-09-26" ? 30 : 10)], available: true }; } });
  assert.deepEqual(requests.sort(), ["2026-09-19/2026-09-25", "2026-09-26/2026-10-02"]);
  assert.equal(snapshot.comparisonSections?.find(s => s.key === "search")?.metrics[0]?.value, 10);
});

test("late writes to the previous window invalidate both cache and ETag", async () => {
  snapshotCache.clear(); let previous = 10;
  const readLedger = async (_project: string, _site: string, period: { start: string }) => ({ rows: [measured(period.start === "2026-09-26" ? 30 : previous)], available: true });
  const before = await loadReportingSnapshot({ ...opts, readLedger });
  previous = 20;
  const after = await loadReportingSnapshot({ ...opts, readLedger });
  assert.notEqual(before.etag, after.etag);
  assert.equal(after.comparisonSections?.find(s => s.key === "search")?.metrics[0]?.value, 20);
});

test("comparison cannot bypass client grants through previous overview or provider health", async () => {
  const snapshot = await loadReportingSnapshot({ ...opts, resolveAccess: async () => ({ ...owner, role: "client", reportSections: ["overview"] }), readLedger: async () => ({ rows: [measured(999)], available: true }) });
  assert.deepEqual(snapshot.comparisonSections?.map(s => s.key), ["overview"]);
  assert.equal(JSON.stringify(snapshot).includes('"value":999'), false);
});

test("a failed comparison reader degrades previous data without erasing current measurements", async () => {
  const snapshot = await loadReportingSnapshot({ ...opts, readLedger: async (_project, _site, period) => { if (period.start === "2026-09-19") throw new Error("private provider failure"); return { rows: [measured(30)], available: true }; } });
  assert.equal(snapshot.sections.find(s => s.key === "search")?.metrics[0]?.value, 30);
  assert.equal(snapshot.comparisonSections?.find(s => s.key === "search")?.status, "unavailable");
  assert.equal(JSON.stringify(snapshot).includes("private provider failure"), false);
});

test("disabled comparison performs no previous-window read", async () => {
  let reads = 0;
  const snapshot = await loadReportingSnapshot({ ...opts, comparisonLabel: "", readLedger: async () => { reads++; return { rows: [], available: true }; } });
  assert.equal(reads, 1);
  assert.equal(snapshot.comparison, null);
});

test("an explicit closing date aligns both windows with delayed provider data", async () => {
  const snapshot = await loadReportingSnapshot({ ...opts, endDate: "2026-10-01", readLedger: async () => ({ rows: [], available: true }) });
  assert.equal(snapshot.period.start, "2026-09-25");
  assert.equal(snapshot.period.end, "2026-10-01");
  assert.equal(snapshot.comparison?.start, "2026-09-18");
  assert.equal(snapshot.comparison?.end, "2026-09-24");
});

test("future and impossible report dates are refused", async () => {
  for (const endDate of ["2026-10-04", "2026-02-30", "invalid"]) {
    await assert.rejects(loadReportingSnapshot({ ...opts, endDate }), /Invalid reporting date/);
  }
});
