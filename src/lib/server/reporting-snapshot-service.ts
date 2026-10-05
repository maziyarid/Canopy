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
  completedReportDate,
  deriveOverview,
  firstPartyProvider,
  ledgerFingerprint,
  mapProviderStatus,
  redactWarning,
  snapshotCacheKey,
  stableSnapshotBody,
} from "./reporting-snapshot-core.ts";

import { parseReportSections } from "./report-sections.ts";
import { redactForClient } from "./redact.ts";

export type LedgerReader = (projectId: string, site: string, period: SnapshotPeriod) => Promise<{ rows: LedgerRow[]; available: boolean }>;

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
  reportSections?: string[];
  project: { id: string; domain: string; data_domain?: "medical" | "thesis" | "other" };
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

export function reportClosingDate(endDate?: string, now = new Date()): Date {
  if (!endDate) return completedReportDate(now);
  const timestamp = Date.parse(`${endDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== endDate || endDate > now.toISOString().slice(0, 10)) throw new SnapshotAccessError(400, "Invalid reporting date");
  return new Date(timestamp);
}

export function assertRefreshCapability(access: SnapshotAccess) {
  if ((access.role !== "owner" && access.role !== "editor") || access.filter.trim()) {
    throw new SnapshotAccessError(403, "Forbidden");
  }
}

function sectionFromRows(
  key: string,
  providers: string[],
  rows: LedgerRow[],
  ledgerAvailable: boolean,
  metricNames?: string[],
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
  const measured = subset.filter(row => row.metricName && (!metricNames || metricNames.includes(row.metricName)));
  let status = aggregateSectionStatus(subset.map((row) => mapProviderStatus(row.status)));
  if (status === "ok" && !measured.length && key !== "providerHealth") status = "no_data";
  return {
    key,
    status,
    freshness: subset.find((row) => row.freshness)?.freshness ?? null,
    lastSyncAt:
      subset.find((row) => row.lastSuccess)?.lastSuccess ??
      subset.find((row) => row.finishedAt)?.finishedAt ??
      null,
    warning: redactWarning(subset.find((row) => row.lastError)?.lastError ?? subset.find(row => row.coverageWarning)?.coverageWarning),
    metrics: (key === "providerHealth" ? [] : measured)
      .map((row) => ({
        name: row.metricName as string,
        value: row.metricValue ?? null,
        provenance: firstPartyProvider(row.provider) ? "first_party" : "third_party_estimate",
        provider: row.provider,
        dataDate: row.dataDate ?? null,
        property: row.property ?? null,
        timeZone: row.timeZone ?? null,
        retrievedAt: row.retrievedAt ?? row.updatedAt ?? null,
        ...(row.coverage ? { coverage: row.coverage } : {}),
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
  comparisonRows?: LedgerRow[];
  comparisonAvailable?: boolean;
}): ReportingSnapshot {
  const search = sectionFromRows("search", ["gsc"], input.rows, input.ledgerAvailable);
  const acquisition = sectionFromRows("acquisition", ["ga4"], input.rows.filter(row => !["conversions", "keyEvents"].includes(row.metricName ?? "")), input.ledgerAvailable);
  const conversions = sectionFromRows("conversions", ["ga4"], input.rows, input.ledgerAvailable, ["conversions", "keyEvents"]);
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
    ...(input.comparison ? { comparisonSections: buildReportingSnapshot({ ...input, period: input.comparison, comparison: null, rows: input.comparisonRows ?? [], ledgerAvailable: input.comparisonAvailable ?? false }).sections } : {}),
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
  endDate?: string;
  readLedger?: LedgerReader;
}): Promise<ReportingSnapshot> {
  const access = await resolveSnapshotAccess(opts.resolveAccess, opts.sql, opts.userId, opts.email, opts.projectId);
  if (access.filter.trim()) throw new SnapshotAccessError(403, "Forbidden");
  const period = periodFromLabel(opts.periodLabel, reportClosingDate(opts.endDate, opts.now));
  const comparison = opts.comparisonLabel === "" ? null : comparisonPeriod(period);
  if (opts.comparisonLabel && comparison) comparison.label = opts.comparisonLabel;
  const requestedAt = (opts.now ?? new Date()).toISOString();
  const reader = opts.readLedger ?? (async () => ({ rows: [], available: false }));
  const safeRead = async (window: SnapshotPeriod) => {
    try { return await reader(access.project.id, access.project.domain, window); }
    catch { return { rows: [], available: false }; }
  };
  const [current, previous] = await Promise.all([reader(access.project.id, access.project.domain, period), comparison ? safeRead(comparison) : Promise.resolve({ rows: [], available: false })]);
  const { rows, available } = current;
  const fingerprint = `${available}:${ledgerFingerprint(rows)}:${previous.available}:${ledgerFingerprint(previous.rows)}`;
  const audience = access.role === "client" ? parseReportSections(access.reportSections).join(",") : "admin";
  const cacheKey = snapshotCacheKey(access.project.id, `${access.project.domain}:${period.label}:${period.start}:${period.end}:${audience}`, comparison ? `${comparison.label}:${comparison.start}:${comparison.end}` : null);
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
    comparisonRows: previous.rows,
    comparisonAvailable: previous.available,
  });
  const visible = filterSnapshotForAccess(snapshot, access);
  snapshotCache.set(cacheKey, fingerprint, visible);
  return visible;
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
  endDate?: string;
  readLedger?: LedgerReader;
}): Promise<{ replayed: boolean; snapshot: ReportingSnapshot }> {
  const access = await resolveSnapshotAccess(opts.resolveAccess, opts.sql, opts.userId, opts.email, opts.projectId);
  assertRefreshCapability(access);

  // Scope replay identity to the canonical request shape. The same client
  // Idempotency-Key may only replay a refresh for the same effective period
  // and comparison; a different request must not receive the first snapshot.
  const now = opts.now ?? new Date();
  const requestedPeriod = periodFromLabel(opts.periodLabel, reportClosingDate(opts.endDate, now));
  const requestedComparison = opts.comparisonLabel === "" ? null : comparisonPeriod(requestedPeriod);
  if (opts.comparisonLabel && requestedComparison) {
    requestedComparison.label = opts.comparisonLabel;
  }
  const scopedKey = [
    composeIdempotencyKey(access.project.id, opts.idempotencyKey),
    access.project.domain,
    `${requestedPeriod.label}:${requestedPeriod.start}:${requestedPeriod.end}`,
    requestedComparison ? `${requestedComparison.label}:${requestedComparison.start}:${requestedComparison.end}` : "-",
  ].join("|");

  const result = await refreshReplays.runOnce(scopedKey, async () => {
    snapshotCache.clear();
    return loadReportingSnapshot({ ...opts, now });
  });
  return { replayed: result.replayed, snapshot: result.value };
}

/** Apply grants before caching or serializing. Overview reflects granted detail only. */
export function filterSnapshotForAccess(snapshot: ReportingSnapshot, access: SnapshotAccess): ReportingSnapshot {
  if (access.role !== "client") return snapshot;
  const granted = new Set(parseReportSections(access.reportSections));
  const filterSections = (source: SnapshotSection[]) => {
  const details = source.filter(section => section.key !== "overview" && granted.has(section.key as "search" | "acquisition" | "conversions"));
  return source.filter(section => granted.has(section.key as "overview" | "search" | "acquisition" | "conversions")).map(section => {
    const visible = section.key === "overview" ? deriveOverview(details) : section;
    return { ...visible, warning: visible.warning ? redactForClient(visible.warning) : null };
  });
  };
  const sections = filterSections(snapshot.sections);
  const body = { ...snapshot, sections, ...(snapshot.comparisonSections ? { comparisonSections: filterSections(snapshot.comparisonSections) } : {}), providerHealth: { key: "providerHealth", status: "unavailable" as const, freshness: null, lastSyncAt: null, warning: null, metrics: [] } };
  return { ...body, etag: computeStableEtag(stableSnapshotBody(body)) };
}
