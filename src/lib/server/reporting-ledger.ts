import type { LedgerRow, SnapshotPeriod } from "./reporting-snapshot-core.ts";

type State = {
  provider: string; status: string; last_success: string | null;
  last_attempt: string | null; last_error: string | null; freshness: string | null;
  updated_at?: string;
};
type MetricSource = {
  provider?: string; property?: string | null; timeZone?: string | null; retrievedAt?: string | null;
  coverage?: { complete: boolean; omittedRows?: number; truncated?: boolean };
};
export type GatewayMetricRow = {
  provider: string; site: string; dataset: string; data_date: string;
  dimensions?: Record<string, unknown>; metrics: Record<string, unknown>; updated_at?: string;
  source?: MetricSource | null;
};
export type GatewayMetricResponse = {
  rows: GatewayMetricRow[];
  truncated?: boolean;
  coverage?: { ranges: Array<{ start: string; end: string }> };
  source?: MetricSource | null;
};
export type ReportGateway = {
  states(projectId: string): Promise<{ providers: State[] }>;
  metrics(projectId: string, provider: string, site: string, dataset: string, start: string, end: string): Promise<GatewayMetricResponse>;
};

function verifiedCoverage(period: SnapshotPeriod, ranges: Array<{ start: string; end: string }>, observedDates: string[]) {
  const validRanges = ranges.filter(range =>
    /^\d{4}-\d{2}-\d{2}$/.test(range.start) &&
    /^\d{4}-\d{2}-\d{2}$/.test(range.end) &&
    Number.isFinite(Date.parse(range.start)) &&
    Number.isFinite(Date.parse(range.end)) &&
    range.start <= range.end,
  );
  const expectedDays = Math.round((Date.parse(period.end) - Date.parse(period.start)) / 86_400_000) + 1;
  const complete = expectedDays > 0 && expectedDays <= 366 &&
    Array.from({ length: expectedDays }, (_, day) =>
      new Date(Date.parse(period.start) + day * 86_400_000).toISOString().slice(0, 10),
    ).every(date => validRanges.some(range => range.start <= date && range.end >= date));
  return {
    start: complete ? period.start : (observedDates[0] ?? period.start),
    end: complete ? period.end : (observedDates.at(-1) ?? period.start),
    complete,
    observedDates,
  };
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

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

  const gscState = rows.find(row => row.provider === "gsc");
  if (gscState && gscState.status !== "not_configured" && gscState.status !== "disabled") {
    try {
      const response = await gateway.metrics(projectId, "gsc", site, "site_daily", period.start, period.end);
      const daily = response.rows.filter(row =>
        row.provider === "gsc" && row.site === site && row.dataset === "site_daily" &&
        row.data_date >= period.start && row.data_date <= period.end,
      );
      if (daily.length) {
        const valid = daily.every(row =>
          ["clicks", "impressions", "position"].every(key => finiteNonNegative(row.metrics[key])),
        );
        const sourceIdentities = new Set(daily.filter(row => row.source?.property).map(row =>
          JSON.stringify([row.source?.property, row.source?.timeZone]),
        ));
        if (!valid || sourceIdentities.size > 1 || daily.length > 366 || new Set(daily.map(row => row.data_date)).size !== daily.length) {
          gscState.status = "error";
          gscState.lastError = "Search metrics could not be validated.";
        } else {
          let clicks = 0, impressions = 0, weightedPosition = 0;
          for (const row of daily) {
            clicks += row.metrics.clicks as number;
            impressions += row.metrics.impressions as number;
            weightedPosition += (row.metrics.position as number) * (row.metrics.impressions as number);
          }
          const observedDates = daily.map(row => row.data_date).sort();
          const dataDate = observedDates.at(-1)!;
          const coverage = verifiedCoverage(period, response.coverage?.ranges ?? [], observedDates);
          coverage.complete = coverage.complete && !response.truncated;
          const source = daily.every(row => row.source?.property) ? daily[0].source : null;
          const retrievedAt = daily.map(row => row.source?.retrievedAt ?? row.updated_at ?? "").sort().at(-1) || null;
          if (!coverage.complete) {
            if (gscState.status === "ok") gscState.status = "partial";
            gscState.coverageWarning = `Partial Search data: ${observedDates.length} stored dates from ${coverage.start} to ${coverage.end}. Unverified dates are excluded from totals.`;
          }
          const updatedAt = daily.map(row => row.updated_at ?? "").sort().at(-1) || gscState.updatedAt;
          const aggregate = {
            clicks,
            impressions,
            ctr: impressions ? clicks / impressions : null,
            averagePosition: impressions ? weightedPosition / impressions : null,
          };
          rows.splice(rows.indexOf(gscState), 1, ...Object.entries(aggregate).map(([metricName, metricValue]) => ({
            ...gscState,
            freshness: dataDate,
            dataDate,
            updatedAt,
            metricName,
            metricValue,
            property: source?.property ?? null,
            timeZone: source?.timeZone ?? null,
            retrievedAt,
            coverage,
          })));
        }
      }
    } catch {
      gscState.status = "error";
      gscState.lastError = "Search metrics could not be read. Try again later.";
    }
  }

  const ga4State = rows.find(row => row.provider === "ga4");
  if (ga4State && ga4State.status !== "not_configured" && ga4State.status !== "disabled") {
    try {
      const response = await gateway.metrics(projectId, "ga4", site, "summary", period.start, period.end);
      const exact = response.rows.filter(row =>
        row.provider === "ga4" &&
        row.site === site &&
        row.dataset === "summary" &&
        row.dimensions?.startDate === period.start &&
        row.dimensions?.endDate === period.end,
      );
      if (exact.length > 1) {
        ga4State.status = "error";
        ga4State.lastError = "Analytics metrics could not be validated.";
      } else if (exact.length === 1) {
        const row = exact[0];
        const sourceToMetric = {
          activeUsers: "users",
          newUsers: "newUsers",
          sessions: "sessions",
          engagedSessions: "engagedSessions",
          engagementRate: "engagementRate",
          averageSessionDuration: "averageSessionDurationSeconds",
          eventCount: "eventCount",
          keyEvents: "keyEvents",
        } as const;
        const measured = Object.entries(sourceToMetric).flatMap(([source, metricName]) => {
          const value = row.metrics[source];
          return value === undefined || value === null
            ? []
            : finiteNonNegative(value)
              ? [{ metricName, metricValue: value }]
              : [{ metricName, metricValue: Number.NaN }];
        });
        if (measured.some(metric => !Number.isFinite(metric.metricValue))) {
          ga4State.status = "error";
          ga4State.lastError = "Analytics metrics could not be validated.";
        } else {
          const coverage = verifiedCoverage(period, response.coverage?.ranges ?? [], [period.end]);
          coverage.complete = coverage.complete && !response.truncated && row.source?.coverage?.complete === true;
          if (!coverage.complete) {
            if (ga4State.status === "ok") ga4State.status = "partial";
            ga4State.coverageWarning = "Partial Analytics data: provider quality or the requested period could not be fully verified.";
          }
          const updatedAt = row.updated_at ?? ga4State.updatedAt;
          rows.splice(rows.indexOf(ga4State), 1, ...measured.map(metric => ({
            ...ga4State,
            freshness: period.end,
            dataDate: period.end,
            updatedAt,
            property: row.source?.property ?? null,
            timeZone: row.source?.timeZone ?? null,
            retrievedAt: row.source?.retrievedAt ?? row.updated_at ?? null,
            ...metric,
            coverage,
          })));
        }
      }
    } catch {
      ga4State.status = "error";
      ga4State.lastError = "Analytics metrics could not be read. Try again later.";
    }
  }

  return { rows, available: true };
}
