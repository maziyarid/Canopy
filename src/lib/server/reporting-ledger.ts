import type { LedgerRow, SnapshotPeriod } from "./reporting-snapshot-core.ts";

type State = {
  provider: string; status: string; last_success: string | null;
  last_attempt: string | null; last_error: string | null; freshness: string | null;
  updated_at?: string;
};
export type GatewayMetricRow = {
  provider: string; site: string; dataset: string; data_date: string;
  dimensions?: Record<string, unknown>; metrics: Record<string, unknown>; updated_at?: string;
};

const OBSERVED_KINDS = new Set(["observed", "complete", "unsampled"]);

function stringKind(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Copy explicit sampling metadata. Absent metadata stays unset so older canonical rows do not flip. */
export function measurementKindFromGatewayRow(row: GatewayMetricRow): string | null {
  const dims = row.dimensions ?? {};
  const metrics = row.metrics ?? {};
  const explicit = stringKind(dims.measurementKind) ?? stringKind(dims.measurement_kind) ?? stringKind(metrics.measurementKind) ?? stringKind(metrics.measurement_kind);
  if (explicit) return explicit;
  const sampling = dims.samplingMetadatas ?? metrics.samplingMetadatas;
  if (sampling != null && !(Array.isArray(sampling) && sampling.length === 0)) return "sampled";
  const flags = dims.qualityFlags ?? metrics.qualityFlags;
  if (flags != null) {
    const list = Array.isArray(flags) ? flags : [flags];
    const hit = list.map(stringKind).find((flag) => flag && !OBSERVED_KINDS.has(flag.toLowerCase()));
    if (hit) return hit;
    if (list.some((flag) => stringKind(flag) == null)) return "unknown";
  }
  if (dims.subjectToThresholding === true || metrics.subjectToThresholding === true) return "thresholded";
  return null;
}

export function aggregateMeasurementKind(rows: GatewayMetricRow[]): string | null {
  const kinds = rows.map(measurementKindFromGatewayRow).filter((kind): kind is string => Boolean(kind));
  if (!kinds.length) return null;
  return kinds.find((kind) => !OBSERVED_KINDS.has(kind.trim().toLowerCase())) ?? kinds[0]!;
}
export type GatewayMetricResponse = { rows: GatewayMetricRow[]; truncated?: boolean; coverage?: { ranges: Array<{ start: string; end: string }> } };
export type ReportGateway = {
  states(projectId: string): Promise<{ providers: State[] }>;
  metrics(projectId: string, provider: string, site: string, dataset: string, start: string, end: string): Promise<GatewayMetricResponse>;
};

/** The analytics ledger is SQLite behind the gateway, not the app's SQL database. */
export async function readGatewayLedger(projectId: string, site: string, period: SnapshotPeriod, gateway: ReportGateway): Promise<{ rows: LedgerRow[]; available: boolean }> {
  let states: State[];
  try { states = (await gateway.states(projectId)).providers; }
  catch { return { rows: [], available: false }; }
  const rows: LedgerRow[] = states.map(state => ({
    provider: state.provider, status: state.status, lastSuccess: state.last_success,
    lastAttempt: state.last_attempt, lastError: state.last_error,
    freshness: state.freshness, updatedAt: state.updated_at ?? null,
  }));
  const state = rows.find(row => row.provider === "gsc");
  if (!state || state.status === "not_configured" || state.status === "disabled") return { rows, available: true };
  let metrics: GatewayMetricRow[];
  let ranges: Array<{ start: string; end: string }> = [];
  try {
    const response = await gateway.metrics(projectId, "gsc", site, "site_daily", period.start, period.end);
    metrics = response.rows;
    ranges = response.coverage?.ranges ?? [];
  } catch {
    state.status = "error";
    state.lastError = "Search metrics could not be read. Try again later.";
    return { rows, available: true };
  }
  const daily = metrics.filter(row => row.provider === "gsc" && row.site === site && row.dataset === "site_daily" && row.data_date >= period.start && row.data_date <= period.end);
  if (!daily.length) return { rows, available: true };
  // Refuse partial/invalid rows instead of turning missing measurements into zero.
  const valid = daily.every(row => ["clicks", "impressions", "position"].every(key => typeof row.metrics[key] === "number" && Number.isFinite(row.metrics[key]) && (row.metrics[key] as number) >= 0));
  if (!valid || daily.length > 366 || new Set(daily.map(row => row.data_date)).size !== daily.length) {
    state.status = "error";
    state.lastError = "Search metrics could not be validated.";
    return { rows, available: true };
  }
  let clicks = 0, impressions = 0, weightedPosition = 0;
  for (const row of daily) {
    clicks += row.metrics.clicks as number;
    impressions += row.metrics.impressions as number;
    weightedPosition += (row.metrics.position as number) * (row.metrics.impressions as number);
  }
  const observedDates = daily.map(row => row.data_date).sort();
  const dataDate = observedDates.at(-1)!;
  const expectedDays = Math.round((Date.parse(period.end) - Date.parse(period.start)) / 86_400_000) + 1;
  const validRanges = ranges.filter(range => /^\d{4}-\d{2}-\d{2}$/.test(range.start) && /^\d{4}-\d{2}-\d{2}$/.test(range.end) && Number.isFinite(Date.parse(range.start)) && Number.isFinite(Date.parse(range.end)) && range.start <= range.end);
  const complete = expectedDays > 0 && expectedDays <= 366 && Array.from({ length: expectedDays }, (_, day) => new Date(Date.parse(period.start) + day * 86_400_000).toISOString().slice(0, 10)).every(date => validRanges.some(range => range.start <= date && range.end >= date));
  // Receipt ranges establish coverage; sparse rows alone never establish zero days.
  const coverage = { start: complete ? period.start : observedDates[0]!, end: complete ? period.end : dataDate, complete, observedDates };
  if (!complete) {
    if (state.status === "ok") state.status = "partial";
    state.coverageWarning = `Partial Search data: ${observedDates.length} stored dates from ${coverage.start} to ${coverage.end}. Unverified dates are excluded from totals.`;
  }
  const updatedAt = daily.map(row => row.updated_at ?? "").sort().at(-1) || state.updatedAt;
  const aggregate = { clicks, impressions, ctr: impressions ? clicks / impressions : null, averagePosition: impressions ? weightedPosition / impressions : null };
  const measurementKind = aggregateMeasurementKind(daily);
  rows.splice(rows.indexOf(state), 1, ...Object.entries(aggregate).map(([metricName, metricValue]) => ({ ...state, freshness: dataDate, dataDate, updatedAt, metricName, metricValue, coverage, ...(measurementKind ? { measurementKind } : {}) })));
  return { rows, available: true };
}
