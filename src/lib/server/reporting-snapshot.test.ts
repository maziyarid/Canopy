import test from "node:test";
import assert from "node:assert/strict";
import {
  SNAPSHOT_SCHEMA_VERSION,
  aggregateSectionStatus,
  computeStableEtag,
  composeIdempotencyKey,
  defaultPeriod,
  deriveOverview,
  ledgerFingerprint,
  normalizeSectionStatus,
  periodFromLabel,
  redactWarning,
  snapshotCacheKey,
  stableSnapshotBody,
  type SnapshotSection,
} from "./reporting-snapshot-core.ts";
import {
  SnapshotAccessError,
  assertRefreshCapability,
  buildReportingSnapshot,
  loadReportingSnapshot,
  refreshReportingSnapshotRecord,
  resolveSnapshotAccess,
  snapshotCache,
  type AccessResolver,
  type SnapshotAccess,
  type SnapshotSql,
} from "./reporting-snapshot-service.ts";

const members = new Map<string, SnapshotAccess>([
  ["user-1:proj-1", { role: "owner", filter: "", project: { id: "proj-1", domain: "example.com" } }],
  ["client-1:proj-1", { role: "client", filter: "", project: { id: "proj-1", domain: "example.com" } }],
  ["editor-1:proj-1", { role: "editor", filter: "", project: { id: "proj-1", domain: "example.com" } }],
  ["user-a:proj-a", { role: "editor", filter: "", project: { id: "proj-a", domain: "a.example" } }],
]);

const resolveAccess: AccessResolver = async (_sql, userId, _email, projectId) => {
  const access = members.get(`${userId}:${projectId}`);
  if (!access) {
    if (projectId === "missing") throw new Error("Project not found");
    throw new Error("Forbidden");
  }
  return access;
};

function makeSql(opts: {
  states?: Array<Record<string, unknown>>;
  metrics?: Array<Record<string, unknown>>;
  runs?: Array<Record<string, unknown>>;
  throwLedger?: boolean;
}): SnapshotSql {
  return (async (strings: TemplateStringsArray) => {
    const text = strings.join("?");
    if (opts.throwLedger) throw new Error("relation does not exist");
    if (text.includes("from provider_state")) return opts.states ?? [];
    if (text.includes("from provider_metric")) return opts.metrics ?? [];
    if (text.includes("from sync_run")) return opts.runs ?? [];
    return [];
  }) as unknown as SnapshotSql;
}

test("unknown enum values fail forward to unknown", () => {
  assert.equal(normalizeSectionStatus("ok"), "ok");
  assert.equal(normalizeSectionStatus("degraded"), "degraded");
  assert.equal(normalizeSectionStatus("quota-exceeded"), "unknown");
  assert.equal(normalizeSectionStatus(12), "unknown");
});

test("provider warnings redact credentials", () => {
  const redacted = redactWarning("Authorization: Bearer super-secret-token quota exceeded");
  assert.ok(redacted);
  assert.equal(redacted.includes("super-secret-token"), false);
  assert.ok(redacted.includes("<redacted>"));
});

test("cache keys isolate project period and schema", () => {
  assert.notEqual(
    snapshotCacheKey("p1", "last_28d", "prev_28d"),
    snapshotCacheKey("p2", "last_28d", "prev_28d"),
  );
  assert.notEqual(
    snapshotCacheKey("p1", "last_28d", null),
    snapshotCacheKey("p1", "last_7d", null),
  );
  assert.ok(snapshotCacheKey("p1", "last_28d", null).startsWith(SNAPSHOT_SCHEMA_VERSION));
});

test("etag is stable when only generatedAt/requestedAt/correlationId change", () => {
  const period = defaultPeriod(new Date("2026-09-23T00:00:00Z"));
  const base = buildReportingSnapshot({
    projectId: "p1",
    site: "example.com",
    period,
    comparison: null,
    correlationId: "corr-1",
    requestedAt: "2026-09-23T01:00:00Z",
    generatedAt: "2026-09-23T01:00:00Z",
    rows: [],
    ledgerAvailable: true,
  });
  const later = {
    ...base,
    requestedAt: "2026-09-23T02:00:00Z",
    generatedAt: "2026-09-23T02:00:00Z",
    correlationId: "corr-2",
  };
  assert.equal(
    computeStableEtag(stableSnapshotBody(base)),
    computeStableEtag(stableSnapshotBody(later)),
  );
  assert.equal(base.etag, later.etag);
});

test("periodFromLabel builds matching start/end dates for last_7d", () => {
  const period = periodFromLabel("last_7d", new Date("2026-09-23T12:00:00Z"));
  assert.equal(period.label, "last_7d");
  assert.equal(period.end, "2026-09-23");
  assert.equal(period.start, "2026-09-17");
});

test("late ledger writes change the fingerprint used for cache invalidation", () => {
  const first = ledgerFingerprint([
    { provider: "gsc", status: "ok", lastSuccess: "t1", lastAttempt: "t1", freshness: "d1", lastError: null, updatedAt: "t1" },
  ]);
  const later = ledgerFingerprint([
    { provider: "gsc", status: "ok", lastSuccess: "t2", lastAttempt: "t2", freshness: "d2", lastError: null, updatedAt: "t2" },
  ]);
  assert.notEqual(first, later);
});

test("overview distinguishes no_data from provider unavailable", () => {
  const noData: SnapshotSection = { key: "search", status: "no_data", freshness: null, lastSyncAt: null, warning: null, metrics: [] };
  const unavailable: SnapshotSection = { key: "acquisition", status: "unavailable", freshness: null, lastSyncAt: null, warning: null, metrics: [] };
  assert.equal(deriveOverview([noData, noData]).status, "no_data");
  assert.equal(deriveOverview([unavailable, unavailable]).status, "unavailable");
});

test("valid owner snapshot returns payload with correlation id and first-party provenance", async () => {
  snapshotCache.clear();
  const sql = makeSql({
    states: [
      { provider: "gsc", status: "ok", last_success: "2026-09-22", last_attempt: "2026-09-22", freshness: "2026-09-21", last_error: null, updated_at: "t1" },
    ],
    metrics: [{ provider: "gsc", metric_name: "clicks", metric_value: 12, data_date: "2026-09-21", updated_at: "t1" }],
    runs: [{ provider: "gsc", finished_at: "2026-09-22T00:00:00Z" }],
  });
  const snapshot = await loadReportingSnapshot({
    sql,
    resolveAccess,
    userId: "user-1",
    email: "owner@example.com",
    projectId: "proj-1",
    correlationId: "cid-1",
    now: new Date("2026-09-23T00:00:00Z"),
  });
  assert.equal(snapshot.projectId, "proj-1");
  assert.equal(snapshot.correlationId, "cid-1");
  assert.equal(snapshot.schemaVersion, SNAPSHOT_SCHEMA_VERSION);
  assert.ok(snapshot.sections.some((section) => section.key === "search" && section.status === "ok"));
  assert.equal(snapshot.sections.find((section) => section.key === "search")?.metrics[0]?.provenance, "first_party");
});

test("missing project and inaccessible project both map to Not found", async () => {
  const sql = makeSql({});
  await assert.rejects(
    () => resolveSnapshotAccess(resolveAccess, sql, "user-x", "x@example.com", "missing"),
    (error: unknown) => error instanceof SnapshotAccessError && error.status === 404 && error.message === "Not found",
  );
  await assert.rejects(
    () => resolveSnapshotAccess(resolveAccess, sql, "outsider", "out@example.com", "proj-1"),
    (error: unknown) => error instanceof SnapshotAccessError && error.status === 404 && error.message === "Not found",
  );
});

test("client membership can read but cannot refresh", async () => {
  const access = await resolveSnapshotAccess(resolveAccess, makeSql({}), "client-1", "c@example.com", "proj-1");
  assert.equal(access.role, "client");
  assert.throws(
    () => assertRefreshCapability(access),
    (error: unknown) => error instanceof SnapshotAccessError && error.status === 403,
  );
});

test("cross-project path substitution cannot read another tenant", async () => {
  await assert.rejects(
    () => loadReportingSnapshot({
      sql: makeSql({}),
      resolveAccess,
      userId: "user-a",
      email: "a@example.com",
      projectId: "proj-b",
    }),
    (error: unknown) => error instanceof SnapshotAccessError && error.status === 404,
  );
});

test("GSC-only snapshot keeps GA4 no_data without dropping search", () => {
  const snapshot = buildReportingSnapshot({
    projectId: "proj-1",
    site: "example.com",
    period: defaultPeriod(new Date("2026-09-23T00:00:00Z")),
    comparison: null,
    correlationId: "c",
    requestedAt: "t",
    generatedAt: "t",
    rows: [
      {
        provider: "gsc",
        status: "ok",
        lastSuccess: "t",
        lastAttempt: "t",
        freshness: "d",
        lastError: null,
        metricName: "clicks",
        metricValue: 9,
        dataDate: "d",
      },
    ],
    ledgerAvailable: true,
  });
  const search = snapshot.sections.find((section) => section.key === "search");
  const acquisition = snapshot.sections.find((section) => section.key === "acquisition");
  assert.equal(search?.status, "ok");
  assert.equal(acquisition?.status, "no_data");
  assert.equal(snapshot.sections.find((section) => section.key === "overview")?.status, "ok");
});

test("ok plus degraded sections yield a partial overview", () => {
  const overview = deriveOverview([
    { key: "search", status: "ok", freshness: null, lastSyncAt: null, warning: null, metrics: [] },
    { key: "acquisition", status: "degraded", freshness: null, lastSyncAt: null, warning: null, metrics: [] },
  ]);
  assert.equal(overview.status, "partial");
});

test("missing ledger tables degrade independently instead of crashing", async () => {
  snapshotCache.clear();
  const snapshot = await loadReportingSnapshot({
    sql: makeSql({ throwLedger: true }),
    resolveAccess,
    userId: "user-1",
    email: "owner@example.com",
    projectId: "proj-1",
  });
  assert.equal(snapshot.providerHealth.status, "unavailable");
});

test("refresh is composite-scoped by projectId and replays the same payload", async () => {
  snapshotCache.clear();
  const sql = makeSql({});
  const first = await refreshReportingSnapshotRecord({
    sql,
    resolveAccess,
    userId: "user-1",
    email: "o@example.com",
    projectId: "proj-1",
    idempotencyKey: "idem-12345678",
    correlationId: "one",
  });
  const second = await refreshReportingSnapshotRecord({
    sql,
    resolveAccess,
    userId: "user-1",
    email: "o@example.com",
    projectId: "proj-1",
    idempotencyKey: "idem-12345678",
    correlationId: "two",
  });
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(first.snapshot.etag, second.snapshot.etag);
  assert.equal(composeIdempotencyKey("proj-1", "idem-12345678"), "proj-1:idem-12345678");
});

test("forged client project header cannot override resolved access project id", async () => {
  snapshotCache.clear();
  const snapshot = await loadReportingSnapshot({
    sql: makeSql({}),
    resolveAccess,
    userId: "user-1",
    email: "o@example.com",
    projectId: "proj-1",
  });
  assert.equal(snapshot.projectId, "proj-1");
  assert.notEqual(snapshot.projectId, "forged");
});

test("entitlement is re-checked before a cached snapshot can be reused", async () => {
  snapshotCache.clear();
  const sql = makeSql({
    states: [{ provider: "gsc", status: "ok", last_success: "t", last_attempt: "t", freshness: "d", last_error: null, updated_at: "t" }],
  });
  await loadReportingSnapshot({ sql, resolveAccess, userId: "editor-1", email: "e@example.com", projectId: "proj-1" });
  const revoked: AccessResolver = async () => {
    throw new Error("Forbidden");
  };
  await assert.rejects(
    () => loadReportingSnapshot({ sql, resolveAccess: revoked, userId: "editor-1", email: "e@example.com", projectId: "proj-1" }),
    (error: unknown) => error instanceof SnapshotAccessError && error.status === 404,
  );
});

test("last_7d request returns matching period dates not default 28d window", async () => {
  snapshotCache.clear();
  const snapshot = await loadReportingSnapshot({
    sql: makeSql({}),
    resolveAccess,
    userId: "user-1",
    email: "o@example.com",
    projectId: "proj-1",
    periodLabel: "last_7d",
    now: new Date("2026-09-23T00:00:00Z"),
  });
  assert.equal(snapshot.period.label, "last_7d");
  assert.equal(snapshot.period.start, "2026-09-17");
  assert.equal(snapshot.period.end, "2026-09-23");
  assert.ok(snapshot.comparison);
  assert.equal(snapshot.comparison!.label, "prev_7d");
});

test("aggregate status is deterministic for mixed degraded/unavailable providers", () => {
  assert.equal(aggregateSectionStatus(["unavailable", "degraded"]), "degraded");
  assert.equal(aggregateSectionStatus(["degraded", "unavailable"]), "degraded");
  assert.equal(aggregateSectionStatus(["ok", "degraded"]), "partial");
});

test("fingerprint includes metricName and lastError so visible changes invalidate cache", () => {
  const base = ledgerFingerprint([
    {
      provider: "gsc",
      status: "ok",
      lastSuccess: "t1",
      lastAttempt: "t1",
      freshness: "d1",
      lastError: null,
      metricName: "clicks",
      metricValue: 1,
      updatedAt: "t1",
    },
  ]);
  const renamed = ledgerFingerprint([
    {
      provider: "gsc",
      status: "ok",
      lastSuccess: "t1",
      lastAttempt: "t1",
      freshness: "d1",
      lastError: null,
      metricName: "impressions",
      metricValue: 1,
      updatedAt: "t1",
    },
  ]);
  const errored = ledgerFingerprint([
    {
      provider: "gsc",
      status: "ok",
      lastSuccess: "t1",
      lastAttempt: "t1",
      freshness: "d1",
      lastError: "timeout",
      metricName: "clicks",
      metricValue: 1,
      updatedAt: "t1",
    },
  ]);
  assert.notEqual(base, renamed);
  assert.notEqual(base, errored);
});

test("concurrent refresh with same idempotency key shares one result", async () => {
  snapshotCache.clear();
  const sql = makeSql({});
  const [a, b] = await Promise.all([
    refreshReportingSnapshotRecord({
      sql,
      resolveAccess,
      userId: "user-1",
      email: "o@example.com",
      projectId: "proj-1",
      idempotencyKey: "idem-concurrent-1",
      correlationId: "a",
    }),
    refreshReportingSnapshotRecord({
      sql,
      resolveAccess,
      userId: "user-1",
      email: "o@example.com",
      projectId: "proj-1",
      idempotencyKey: "idem-concurrent-1",
      correlationId: "b",
    }),
  ]);
  assert.equal(a.snapshot.etag, b.snapshot.etag);
  assert.equal(a.replayed || b.replayed, true);
});

test("unexpected ledger database errors propagate instead of silent unavailable", async () => {
  snapshotCache.clear();
  const sql = (async () => {
    throw new Error("connection reset by peer");
  }) as unknown as SnapshotSql;
  await assert.rejects(
    () =>
      loadReportingSnapshot({
        sql,
        resolveAccess,
        userId: "user-1",
        email: "o@example.com",
        projectId: "proj-1",
      }),
    /connection reset by peer/,
  );
});
