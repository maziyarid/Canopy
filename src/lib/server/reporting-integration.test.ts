import test from "node:test";
import { execFileSync } from "node:child_process";
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
          source: { provider: "ga4", property: "properties/100", timeZone: "Asia/Tehran", retrievedAt: "2026-10-01T00:00:00Z", coverage: { complete: true } },
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
        source: { provider: "ga4", property: "properties/100", timeZone: "Asia/Tehran", retrievedAt: "2026-10-01T00:00:00Z" },
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
  assert.equal(result.rows.find(row => row.metricName === "sessions")?.property, "properties/100");
  assert.equal(result.rows.find(row => row.metricName === "sessions")?.timeZone, "Asia/Tehran");
  assert.equal(result.rows.find(row => row.metricName === "sessions")?.retrievedAt, "2026-10-01T00:00:00Z");

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


test("fresh GA4 sync feeds the default completed UTC-day snapshot without summing daily users", async () => {
  const receipt = JSON.parse(execFileSync("python3", ["-c", `
import json, os, sys, tempfile
from datetime import datetime, date, timezone
from unittest.mock import patch
sys.path.insert(0, 'ops/analytics-gateway')
import gateway
class Clock(datetime):
    @classmethod
    def now(cls, tz=None):
        return datetime(2026, 10, 5, 0, 15, tzinfo=timezone.utc)
class LocalDate(date):
    @classmethod
    def today(cls):
        return date(2026, 10, 4)
def upstream(path, method, body):
    summary = {'dimensions': {}, 'metrics': {'activeUsers': 9, 'sessions': 14}}
    daily = [{'dimensions': {'date': body[key]}, 'metrics': {'activeUsers': 9, 'sessions': 7}} for key in ('startDate', 'endDate')]
    return {'property': body['property'], 'rows': [summary] if body['report'] == 'summary' else daily if body['report'] == 'daily' else [], 'metadata': {'timeZone': 'Asia/Tehran'}, 'fetchedAt': '2026-10-05T00:15:00Z', 'coverage': {'complete': True, 'omittedRows': 0, 'truncated': False, 'reasons': []}}
with tempfile.TemporaryDirectory() as tmp, patch.object(gateway, 'DB', tmp + '/test.db'), patch.object(gateway, 'datetime', Clock), patch.object(gateway, 'date', LocalDate), patch.object(gateway, 'google_request', side_effect=upstream), patch.dict(os.environ, {'MS_ROBOT_PROJECT_GA4_MAP_JSON': '{"p1":{"example.com":"100"}}'}):
    gateway.init_db()
    sync = gateway.run_ga4_sync('p1', 'example.com', '7d', 'fixture')
    print(json.dumps({'sync': sync, 'rows': gateway.metric_rows('p1', 'ga4', 'example.com', 'summary')}))
`], { encoding: "utf8" }));
  snapshotCache.clear();
  const snapshot = await loadReportingSnapshot({
    sql, resolveAccess: async () => owner, userId: "owner", email: "owner@example.com", projectId: "p1",
    periodLabel: "last_7d", comparisonLabel: "", now: new Date("2026-10-05T00:15:00Z"),
    readLedger: (projectId, site, period) => readGatewayLedger(projectId, site, period, {
      states: async () => ({ providers: [{ provider: "ga4", status: "ok", last_success: "2026-10-05", last_attempt: null, last_error: null, freshness: receipt.sync.requested_end }] }),
      metrics: async () => ({ rows: receipt.rows, coverage: { ranges: [{ start: receipt.sync.requested_start, end: receipt.sync.requested_end }] } }),
    }),
  });
  assert.deepEqual(snapshot.period, { label: "last_7d", start: "2026-09-28", end: "2026-10-04" });
  assert.equal(receipt.sync.requested_start, snapshot.period.start);
  assert.equal(receipt.sync.requested_end, snapshot.period.end);
  const users = snapshot.sections.find(section => section.key === "acquisition")?.metrics.find(metric => metric.name === "users");
  assert.equal(users?.value, 9);
  assert.equal(users?.property, "properties/100");
});

test("GA4 historical provenance and partial quality come from the matched metric, never latest site metadata", async () => {
  const result = await readGatewayLedger("p1", "example.com", { start: "2026-09-24", end: "2026-09-30", label: "last_7d" }, {
    states: async () => ({ providers: [{ provider: "ga4", status: "ok", last_success: "2026-10-06", last_attempt: null, last_error: null, freshness: "2026-10-05" }] }),
    metrics: async () => ({
      rows: [{ provider: "ga4", site: "example.com", dataset: "summary", data_date: "2026-09-30", dimensions: { startDate: "2026-09-24", endDate: "2026-09-30" }, metrics: { activeUsers: 9 },
        source: { provider: "ga4", property: "properties/100", timeZone: "Asia/Tehran", retrievedAt: "2026-10-01T00:00:00Z", coverage: { complete: false } } }],
      source: { provider: "ga4", property: "properties/200", timeZone: "UTC", retrievedAt: "2026-10-06T00:00:00Z" },
      coverage: { ranges: [{ start: "2026-09-24", end: "2026-09-30" }] },
    }),
  });
  assert.equal(result.rows[0].property, "properties/100");
  assert.equal(result.rows[0].timeZone, "Asia/Tehran");
  assert.equal(result.rows[0].retrievedAt, "2026-10-01T00:00:00Z");
  assert.equal(result.rows[0].coverage?.complete, false);
  assert.equal(result.rows[0].status, "partial");
});

test("GSC aggregates refuse mixed historical property identities", async () => {
  const result = await readGatewayLedger("p1", "example.com", { start: "2026-10-01", end: "2026-10-02", label: "two-days" }, {
    states: async () => ({ providers: [{ provider: "gsc", status: "ok", last_success: "2026-10-03", last_attempt: null, last_error: null, freshness: "2026-10-02" }] }),
    metrics: async () => ({ rows: [
      { provider: "gsc", site: "example.com", dataset: "site_daily", data_date: "2026-10-01", metrics: { clicks: 10, impressions: 100, position: 2 }, source: { property: "sc-domain:example.com", timeZone: "America/Los_Angeles" } },
      { provider: "gsc", site: "example.com", dataset: "site_daily", data_date: "2026-10-02", metrics: { clicks: 10, impressions: 100, position: 2 }, source: { property: "https://example.com/", timeZone: "America/Los_Angeles" } },
    ], coverage: { ranges: [{ start: "2026-10-01", end: "2026-10-02" }] } }),
  });
  assert.equal(result.rows[0].status, "error");
  assert.equal(result.rows.some(row => row.metricName), false);
});

test("legacy GA4 measurements never inherit response-level latest property or retrieval time", async () => {
  const result = await readGatewayLedger("p1", "example.com", { start: "2026-10-01", end: "2026-10-02", label: "two-days" }, {
    states: async () => ({ providers: [{ provider: "ga4", status: "ok", last_success: "2026-10-06", last_attempt: null, last_error: null, freshness: "2026-10-05" }] }),
    metrics: async () => ({ rows: [{
      provider: "ga4", site: "example.com", dataset: "summary", data_date: "2026-10-02",
      dimensions: { startDate: "2026-10-01", endDate: "2026-10-02" }, metrics: { activeUsers: 4 }, updated_at: "2026-10-03T00:00:00Z",
    }], source: { property: "properties/200", retrievedAt: "2026-10-06T00:00:00Z" }, coverage: { ranges: [{ start: "2026-10-01", end: "2026-10-02" }] } }),
  });
  assert.equal(result.rows[0].property, null);
  assert.equal(result.rows[0].retrievedAt, "2026-10-03T00:00:00Z");
  assert.equal(result.rows[0].coverage?.complete, false);
});
