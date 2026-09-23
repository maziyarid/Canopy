import {
  SNAPSHOT_SCHEMA_VERSION,
  SnapshotCache,
  IdempotencyStore,
  type LedgerRow,
  type ReportingSnapshot,
  type SnapshotPeriod,
  type SnapshotSection,
  aggregateSectionStatus,
  comparisonPeriod,
  composeIdempotencyKey,
  computeStableEtag,
  periodFromLabel,
  deriveOverview,
  firstPartyProvider,
  ledgerFingerprint,
  mapProviderStatus,
  redactWarning,
  snapshotCacheKey,
  stableSnapshotBody,
} from "./reporting-snapshot-core.ts";

export const snapshotCache = new SnapshotCache();
export const refreshReplays = new IdempotencyStore();

export class SnapshotAccessError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "SnapshotAccessError";
  }
}

export type SnapshotAccess = {
  role: "owner" | "editor" | "client";
  filter: string;
  project: { id: string; domain: string };
};

/** Compatible with repository Sql (tagged template + query). */
export type SnapshotSql = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export type AccessResolver = (
  sql: SnapshotSql,
  userId: string,
  email: string,
  projectId: string,
) => Promise<SnapshotAccess>;

const MISSING_LEDGER_RE = /relation .*does not exist|no such table|undefined_table|42P01/i;

export async function resolveSnapshotAccess(
  resolver: AccessResolver,
  sql: SnapshotSql,
  userId: string,
  email: string,
  projectId: string,
): Promise<SnapshotAccess> {
  try {
    return await resolver(sql, userId, email, projectId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Project not found" || message === "Forbidden") {
      throw new SnapshotAccessError(404, "Not found");
    }
    throw error;
  }
}

export function assertRefreshCapability(access: SnapshotAccess) {
  if (access.role !== "owner" && access.role !== "editor") {
    throw new SnapshotAccessError(403, "Forbidden");
  }
}

async function readLedger(
  sql: SnapshotSql,
  projectId: string,
  period: SnapshotPeriod,
): Promise<{ rows: LedgerRow[]; available: boolean }> {
  try {
    const states = await sql<{
      provider: string;
      status: string;
      last_success: string | null;
      last_attempt: string | null;
      freshness: string | null;
      last_error: string | null;
      updated_at: string | null;
    }>`
      select provider, status, last_success, last_attempt, freshness, last_error, updated_at
      from provider_state
      where project_id = ${projectId}
      order by provider asc
    `;
    const metrics = await sql<{
      provider: string;
      metric_name: string;
      metric_value: number | null;
      data_date: string | null;
      updated_at: string | null;
    }>`
      select provider, metric_name, metric_value, data_date, updated_at
      from provider_metric
      where project_id = ${projectId}
        and (data_date is null or (data_date >= ${period.start} and data_date <= ${period.end}))
      order by provider asc, metric_name asc, data_date asc
    `;
    const runs = await sql<{
      provider: string;
      finished_at: string | null;
    }>`
      select provider, finished_at
      from sync_run
      where project_id = ${projectId}
      order by finished_at desc nulls last
    `;
    const runMap = new Map<string, string | null>();
    for (const run of runs) {
      if (!runMap.has(run.provider)) {
        runMap.set(run.provider, run.finished_at);
      }
    }
    const rows: LedgerRow[] = [];
    for (const state of states) {
      const matchingMetrics = metrics.filter((metric) => metric.provider === state.provider);
      if (!matchingMetrics.length) {
        rows.push({
          provider: state.provider,
          status: state.status,
          lastSuccess: state.last_success,
          lastAttempt: state.last_attempt,
          freshness: state.freshness,
          lastError: state.last_error,
          updatedAt: state.updated_at,
          finishedAt: runMap.get(state.provider) ?? null,
        });
        continue;
      }
      for (const metric of matchingMetrics) {
        rows.push({
          provider: state.provider,
          status: state.status,
          lastSuccess: state.last_success,
          lastAttempt: state.last_attempt,
          freshness: state.freshness,
          lastError: state.last_error,
          metricName: metric.metric_name,
          metricValue: metric.metric_value,
          dataDate: metric.data_date,
          updatedAt: metric.updated_at ?? state.updated_at,
          finishedAt: runMap.get(state.provider) ?? null,
        });
      }
    }
    return { rows, available: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (MISSING_LEDGER_RE.test(message)) {
      return { rows: [], available: false };
    }
    throw error;
  }
}

function sectionFromRows(
  key: string,
  providers: string[],
  rows: LedgerRow[],
  ledgerAvailable: boolean,
): SnapshotSection {
  const subset = rows
    .filter((row) => providers.includes(row.provider))
    .slice()
    .sort((a, b) => a.provider.localeCompare(b.provider) || (a.metricName ?? "").localeCompare(b.metricName ?? ""));
  if (!ledgerAvailable) {
    return { key, status: "unavailable", freshness: null, lastSyncAt: null, warning: null, metrics: [] };
  }
  if (!subset.length) {
    return { key, status: "no_data", freshness: null, lastSyncAt: null, warning: null, metrics: [] };
  }
  const status = aggregateSectionStatus(subset.map((row) => mapProviderStatus(row.status)));
  return {
    key,
    status,
    freshness: subset.find((row) => row.freshness)?.freshness ?? null,
    lastSyncAt:
      subset.find((row) => row.lastSuccess)?.lastSuccess ??
      subset.find((row) => row.finishedAt)?.finishedAt ??
      null,
    warning: redactWarning(subset.find((row) => row.lastError)?.lastError),
    metrics: subset
      .filter((row) => row.metricName)
      .map((row) => ({
        name: row.metricName as string,
        value: row.metricValue ?? null,
        provenance: firstPartyProvider(row.provider) ? "first_party" : "third_party_estimate",
        provider: row.provider,
        dataDate: row.dataDate ?? null,
      })),
  };
}

export function buildReportingSnapshot(input: {
  projectId: string;
  site: string;
  period: SnapshotPeriod;
  comparison: SnapshotPeriod | null;
  correlationId: string;
  requestedAt: string;
  generatedAt: string;
  rows: LedgerRow[];
  ledgerAvailable: boolean;
}): ReportingSnapshot {
  const search = sectionFromRows("search", ["gsc"], input.rows, input.ledgerAvailable);
  const acquisition = sectionFromRows("acquisition", ["ga4"], input.rows, input.ledgerAvailable);
  const conversions = sectionFromRows("conversions", ["ga4", "gsc"], input.rows, input.ledgerAvailable);
  const providerHealth = sectionFromRows(
    "providerHealth",
    [...new Set([...input.rows.map((row) => row.provider), "gsc", "ga4"])].sort(),
    input.rows,
    input.ledgerAvailable,
  );
  const overview = deriveOverview([search, acquisition, conversions]);
  const body = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    projectId: input.projectId,
    site: input.site,
    period: input.period,
    comparison: input.comparison,
    sections: [overview, search, acquisition, conversions],
    providerHealth,
  };
  return {
    ...body,
    correlationId: input.correlationId,
    generatedAt: input.generatedAt,
    requestedAt: input.requestedAt,
    etag: computeStableEtag(stableSnapshotBody(body)),
  };
}

export async function loadReportingSnapshot(opts: {
  sql: SnapshotSql;
  resolveAccess: AccessResolver;
  userId: string;
  email: string;
  projectId: string;
  periodLabel?: string;
  comparisonLabel?: string | null;
  correlationId?: string;
  now?: Date;
}): Promise<ReportingSnapshot> {
  const access = await resolveSnapshotAccess(opts.resolveAccess, opts.sql, opts.userId, opts.email, opts.projectId);
  const period = periodFromLabel(opts.periodLabel, opts.now);
  const comparison = opts.comparisonLabel === "" ? null : comparisonPeriod(period);
  if (opts.comparisonLabel && comparison) comparison.label = opts.comparisonLabel;
  const requestedAt = (opts.now ?? new Date()).toISOString();
  const { rows, available } = await readLedger(opts.sql, access.project.id, period);
  const fingerprint = ledgerFingerprint(rows);
  const cacheKey = snapshotCacheKey(access.project.id, period.label, comparison?.label ?? null);
  const cached = snapshotCache.get(cacheKey, fingerprint);
  if (cached) {
    return {
      ...cached,
      requestedAt,
      generatedAt: (opts.now ?? new Date()).toISOString(),
      correlationId: opts.correlationId?.trim() || cached.correlationId,
    };
  }
  const snapshot = buildReportingSnapshot({
    projectId: access.project.id,
    site: access.project.domain,
    period,
    comparison,
    correlationId: opts.correlationId?.trim() || crypto.randomUUID(),
    requestedAt,
    generatedAt: requestedAt,
    rows,
    ledgerAvailable: available,
  });
  snapshotCache.set(cacheKey, fingerprint, snapshot);
  return snapshot;
}

export async function refreshReportingSnapshotRecord(opts: {
  sql: SnapshotSql;
  resolveAccess: AccessResolver;
  userId: string;
  email: string;
  projectId: string;
  idempotencyKey: string;
  periodLabel?: string;
  comparisonLabel?: string | null;
  correlationId?: string;
  now?: Date;
}): Promise<{ replayed: boolean; snapshot: ReportingSnapshot }> {
  const access = await resolveSnapshotAccess(opts.resolveAccess, opts.sql, opts.userId, opts.email, opts.projectId);
  assertRefreshCapability(access);
  const scopedKey = composeIdempotencyKey(access.project.id, opts.idempotencyKey);
  const result = await refreshReplays.runOnce(scopedKey, async () => {
    snapshotCache.clear();
    return loadReportingSnapshot(opts);
  });
  return { replayed: result.replayed, snapshot: result.value };
}
