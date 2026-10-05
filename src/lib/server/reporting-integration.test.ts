import test from "node:test";
import assert from "node:assert/strict";
import { loadReportingSnapshot, refreshReportingSnapshotRecord, buildReportingSnapshot, snapshotCache, type SnapshotSql } from "./reporting-snapshot-service.ts";
import { readGatewayLedger } from "./reporting-ledger.ts";
import { parseReportSections } from "./report-sections.ts";
import { evidenceFromSnapshot, draftsFromSnapshot } from "./snapshot-insight-adapter.ts";

const sql = (async () => { throw new Error("Unexpected SQL analytics query"); }) as unknown as SnapshotSql;
const owner = { role: "owner" as const, filter: "", project: { id: "p1", domain: "example.com" } };
const row = { provider: "gsc", status: "ok", lastSuccess: "2026-09-29", lastAttempt: null, freshness: "2026-09-28", lastError: null, metricName: "clicks", metricValue: 12, dataDate: "2026-09-28" };
const now = new Date("2026-09-30T00:00:00Z");

test("report reads the scoped gateway, aggregates only site daily data and weights GSC ratios", async () => {
  let observed: unknown;
  const result = await readGatewayLedger("p1", "example.com", { start: "2026-09-24", end: "2026-09-30", label: "last_7d" }, {
    states: async (projectId) => { assert.equal(projectId, "p1"); return { providers: [{ provider: "gsc", status: "ok", last_success: "2026-09-29", last_attempt: null, last_error: null, freshness: "2026-09-28" }] }; },
    metrics: async (...args) => {
      observed = args;
      return { rows: [
        { provider: "gsc", site: "example.com", dataset: "site_daily", data_date: "2026-09-27", metrics: { clicks: 10, impressions: 100, position: 2 } },
        { provider: "gsc", site: "example.com", dataset: "site_daily", data_date: "2026-09-28", metrics: { clicks: 10, impressions: 300, position: 6 } },
        { provider: "gsc", site: "other.com", dataset: "site_daily", data_date: "2026-09-28", metrics: { clicks: 9999 } },
        { provider: "gsc", site: "example.com", dataset: "query", data_date: "2026-09-28", metrics: { clicks: 9999 } },
        { provider: "gsc", site: "example.com", dataset: "site_daily", data_date: "2025-09-28", metrics: { clicks: 9999 } },
      ] };
    },
  });
  assert.deepEqual(observed, ["p1", "gsc", "example.com", "site_daily", "2026-09-24", "2026-09-30"]);
  const metrics = Object.fromEntries(result.rows.filter(r => r.metricName).map(r => [r.metricName, r.metricValue]));
  assert.deepEqual(metrics, { clicks: 20, impressions: 400, ctr: 0.05, averagePosition: 5 });
});

test("GA4 summary rows are normalized independently from GSC and require exact scoped coverage", async () => {
  let observed: unknown;
  const result = await readGatewayLedger("p1", "example.com", { start: "2026-09-24", end: "2026-09-30", label: "last_7d" }, {
    states: async (projectId) => {
      assert.equal(projectId, "p1");
      return { providers: [{ provider: "ga4", status: "ok", last_success: "2026-10-01", last_attempt: null, last_error: null, freshness: "2026-09-30" }] };
    },
    metrics: async (...args) => {
      observed = args;
      return {
        rows: [{
          provider: "ga4",
          site: "example.com",
          dataset: "summary",
          data_date: "2026-09-30",
          dimensions: { startDate: "2026-09-24", endDate: "2026-09-30" },
          metrics: {
            activeUsers: 9,
            newUsers: 3,
            sessions: 14,
            engagedSessions: 10,
            engagementRate: 10 / 14,
            averageSessionDuration: 61.5,
            eventCount: 52,
            keyEvents: 2,
          },
        }],
        coverage: { ranges: [{ start: "2026-09-24", end: "2026-09-30" }] },
      };
    },
  });
  assert.deepEqual(observed, ["p1", "ga4", "example.com", "summary", "2026-09-24", "2026-09-30"]);
  const metrics = Object.fromEntries(result.rows.filter(r => r.metricName).map(r => [r.metricName, r.metricValue]));
  assert.deepEqual(metrics, {
    users: 9,
    newUsers: 3,
    sessions: 14,
    engagedSessions: 10,
    engagementRate: 10 / 14,
    averageSessionDurationSeconds: 61.5,
    eventCount: 52,
    keyEvents: 2,
  });
  assert.equal(result.rows.find(row => row.metricName === "sessions")?.coverage?.complete, true);

  const snapshot = buildReportingSnapshot({
    projectId: "p1",
    site: "example.com",
    period: { start: "2026-09-24", end: "2026-09-30", label: "last_7d" },
    comparison: null,
    correlationId: "ga4",
    requestedAt: "t",
    generatedAt: "t",
    rows: result.rows,
    ledgerAvailable: true,
  });
  assert.equal(snapshot.sections.find(section => section.key === "acquisition")?.metrics.find(metric => metric.name === "sessions")?.value, 14);
  assert.equal(snapshot.sections.find(section => section.key === "conversions")?.metrics.find(metric => metric.name === "keyEvents")?.value, 2);
});

test("GA4 gateway failure degrades Analytics without discarding valid GSC rows", async () => {
  const result = await readGatewayLedger("p1", "example.com", { start: "2026-09-24", end: "2026-09-30", label: "last_7d" }, {
    states: async () => ({ providers: [
      { provider: "gsc", status: "ok", last_success: "2026-09-30", last_attempt: null, last_error: null, freshness: "2026-09-30" },
      { provider: "ga4", status: "ok", last_success: "2026-09-30", last_attempt: null, last_error: null, freshness: "2026-09-30" },
    ] }),
    metrics: async (_projectId, provider) => {
      if (provider === "ga4") throw new Error("upstream failed");
      return {
        rows: [{
          provider: "gsc",
          site: "example.com",
          dataset: "site_daily",
          data_date: "2026-09-30",
          metrics: { clicks: 4, impressions: 100, position: 7 },
        }],
        coverage: { ranges: [{ start: "2026-09-24", end: "2026-09-30" }] },
      };
    },
  });
  assert.equal(result.rows.find(row => row.provider === "gsc" && row.metricName === "clicks")?.metricValue, 4);
  assert.equal(result.rows.find(row => row.provider === "ga4")?.status, "error");
  assert.match(result.rows.find(row => row.provider === "ga4")?.lastError ?? "", /could not be read/);
});

test("keyword-scoped members cannot read project aggregates, before gateway access", async () => {
  let reads = 0;
  await assert.rejects(loadReportingSnapshot({ sql, resolveAccess: async () => ({ ...owner, role: "editor", filter: "limited" }), userId: "u", email: "", projectId: "p1", readLedger: async () => { reads++; return { rows: [row], available: true }; } }), /Forbidden/);
  assert.equal(reads, 0);
});

test("client snapshot is filtered before serialization and overview cannot bypass section grants", async () => {
  snapshotCache.clear();
  const opts = { sql, userId: "u", email: "", projectId: "p1", now, readLedger: async () => ({ rows: [row], available: true }) };
  await loadReportingSnapshot({ ...opts, resolveAccess: async () => owner });
  const client = await loadReportingSnapshot({ ...opts, resolveAccess: async () => ({ ...owner, role: "client", reportSections: ["overview"] }) });
  assert.deepEqual(client.sections.map(s => s.key), ["overview"]);
  assert.equal(client.sections[0].metrics.length, 0);
  assert.deepEqual(client.providerHealth.metrics, []);
  assert.equal(client.providerHealth.lastSyncAt, null);
  assert.equal(JSON.stringify(client).includes('"value":12'), false);
  const ungranted = await loadReportingSnapshot({ ...opts, resolveAccess: async () => ({ ...owner, role: "client" }) });
  assert.deepEqual(ungranted.sections, []);
});

test("rolling date windows cannot reuse yesterday's cached period", async () => {
  snapshotCache.clear();
  const opts = { sql, userId: "u", email: "", projectId: "p1", resolveAccess: async () => owner, readLedger: async () => ({ rows: [row], available: true }) };
  const yesterday = await loadReportingSnapshot({ ...opts, now: new Date("2026-09-29") });
  const today = await loadReportingSnapshot({ ...opts, now });
  assert.notEqual(today.period.end, yesterday.period.end);
  assert.notEqual(today.etag, yesterday.etag);
});

test("search clicks are never conversions and overview contains each metric once", () => {
  const snapshot = buildReportingSnapshot({ projectId: "p1", site: "example.com", period: { start: "2026-09-24", end: "2026-09-30", label: "last_7d" }, comparison: null, correlationId: "c", requestedAt: "t", generatedAt: "t", rows: [row], ledgerAvailable: true });
  assert.deepEqual(snapshot.sections.find(s => s.key === "conversions")?.metrics, []);
  assert.equal(snapshot.sections.find(s => s.key === "overview")?.metrics.length, 1);
});

test("malformed, missing or admin section grants fail closed", () => {
  assert.deepEqual(parseReportSections(undefined), []);
  assert.deepEqual(parseReportSections('{"search":true}'), []);
  assert.deepEqual(parseReportSections('["search","providerHealth","search"]'), ["search"]);
});

test("changing a project's site invalidates both state-only cache and metric refresh replays", async () => {
  snapshotCache.clear();
  let site = "old.example";
  const opts = { sql, userId: "u", email: "", projectId: "p1", now, resolveAccess: async () => ({ ...owner, project: { id: "p1", domain: site } }), readLedger: async () => ({ rows: [], available: true }) };
  assert.equal((await loadReportingSnapshot(opts)).site, "old.example");
  site = "new.example";
  assert.equal((await loadReportingSnapshot(opts)).site, "new.example");
  site = "old.example";
  const refresh = { ...opts, idempotencyKey: "domain-switch-123", readLedger: async () => ({ rows: [row], available: true }) };
  await refreshReportingSnapshotRecord(refresh);
  site = "new.example";
  const changed = await refreshReportingSnapshotRecord(refresh);
  assert.equal(changed.replayed, false);
  assert.equal(changed.snapshot.site, "new.example");
});

test("ledger availability changes cannot reuse an unavailable cached response", async () => {
  snapshotCache.clear(); let available = false;
  const opts = { sql, userId: "u", email: "", projectId: "p1", now, resolveAccess: async () => owner, readLedger: async () => ({ rows: [], available }) };
  assert.equal((await loadReportingSnapshot(opts)).providerHealth.status, "unavailable");
  available = true;
  assert.notEqual((await loadReportingSnapshot(opts)).providerHealth.status, "unavailable");
});

test("a fresh sparse ledger cannot claim full reporting-window coverage", async () => {
  const result = await readGatewayLedger("p1", "example.com", { start: "2026-07-03", end: "2026-09-30", label: "last_90d" }, {
    states: async () => ({ providers: [{ provider: "gsc", status: "ok", last_success: "2026-09-29", last_attempt: null, last_error: null, freshness: "2026-09-28" }] }),
    metrics: async () => ({ rows: [{ provider: "gsc", site: "example.com", dataset: "site_daily", data_date: "2026-09-28", metrics: { clicks: 10, impressions: 100, position: 2 } }] }),
  });
  assert.equal(result.rows[0].status, "partial");
  const partial = buildReportingSnapshot({ projectId: "p1", site: "example.com", period: { start: "2026-07-03", end: "2026-09-30", label: "last_90d" }, comparison: null, requestedAt: "t", generatedAt: "t", correlationId: "c", rows: result.rows, ledgerAvailable: true });
  assert.equal(evidenceFromSnapshot(partial)[0].periodStart, "2026-09-28");
  assert.equal(evidenceFromSnapshot(partial)[0].periodEnd, "2026-09-28");
  assert.match(draftsFromSnapshot(partial)[0].body, /Partial coverage/);
});

test("successful sync ranges establish coverage independently of sparse daily rows", async () => {
  const result = await readGatewayLedger("p1", "example.com", { start: "2026-09-24", end: "2026-09-28", label: "five-days" }, {
    states: async () => ({ providers: [{ provider: "gsc", status: "ok", last_success: "2026-09-29", last_attempt: null, last_error: null, freshness: "2026-09-28" }] }),
    metrics: async () => ({ rows: [{ provider: "gsc", site: "example.com", dataset: "site_daily", data_date: "2026-09-28", metrics: { clicks: 10, impressions: 100, position: 2 } }], coverage: { ranges: [{ start: "2026-09-24", end: "2026-09-28" }] } }),
  });
  assert.equal(result.rows[0].status, "ok");
  assert.equal(result.rows[0].coverage?.complete, true);
  assert.equal(result.rows[0].coverage?.start, "2026-09-24");
  assert.equal(result.rows[0].metricValue, 10);
});
