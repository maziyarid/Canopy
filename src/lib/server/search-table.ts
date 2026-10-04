import { resolveSnapshotAccess, SnapshotAccessError, type AccessResolver, type SnapshotSql } from "./reporting-snapshot-service.ts";
import type { SnapshotPeriod } from "./reporting-snapshot-core.ts";
import type { GatewayMetricResponse } from "./reporting-ledger.ts";
import { redactForClient } from "./redact.ts";
import { parseReportSections } from "./report-sections.ts";

export type SearchTableRow = { query: string; page: string; clicks: number; impressions: number; ctr: number | null; averagePosition: number | null };
export type SearchTable = { status: "partial" | "no_data" | "unavailable"; rows: SearchTableRow[]; total: number; offset: number; limit: number; truncated: boolean; dataDate: string | null; period: SnapshotPeriod };

/** Date-grained query data is a sample; it never establishes full site totals. */
export async function loadSearchTable(opts: {
  sql: SnapshotSql; resolveAccess: AccessResolver; userId: string; email: string; projectId: string;
  period: SnapshotPeriod; limit?: number; offset?: number;
  readRows(projectId: string, site: string, dataset: string, start: string, end: string): Promise<GatewayMetricResponse>;
}): Promise<SearchTable> {
  const access = await resolveSnapshotAccess(opts.resolveAccess, opts.sql, opts.userId, opts.email, opts.projectId);
  if (access.filter.trim() || (access.role === "client" && !parseReportSections(access.reportSections).includes("search"))) throw new SnapshotAccessError(403, "Forbidden");
  const limit = Math.max(1, Math.min(100, Math.trunc(opts.limit ?? 20)));
  const offset = Math.max(0, Math.min(2000, Math.trunc(opts.offset ?? 0)));
  const base: SearchTable = { status: "unavailable", rows: [], total: 0, offset, limit, truncated: false, dataDate: null, period: opts.period };
  if (!Number.isFinite(limit) || !Number.isFinite(offset)) throw new SnapshotAccessError(400, "Invalid table page");
  let response: GatewayMetricResponse;
  try { response = await opts.readRows(opts.projectId, access.project.domain, "query_page_daily", opts.period.start, opts.period.end); }
  catch { return base; }
  if (!Array.isArray(response.rows)) return base;
  base.truncated = response.truncated === true || response.rows.length > 2000;
  const groups = new Map<string, SearchTableRow & { weightedPosition: number }>();
  const seen = new Set<string>();
  for (const row of response.rows.slice(0, 2000)) {
    if (row.provider !== "gsc" || row.site !== access.project.domain || row.dataset !== "query_page_daily") continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.data_date) || row.data_date < opts.period.start || row.data_date > opts.period.end) continue;
    const { query, page } = row.dimensions ?? {};
    if (typeof query !== "string" || typeof page !== "string" || !query.trim()) return base;
    const { clicks, impressions, position } = row.metrics ?? {};
    if (![clicks, impressions, position].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0)) return base;
    let safePage: string;
    try {
      const url = new URL(page);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hostname.replace(/^www\./, "") !== access.project.domain.replace(/^www\./, "")) continue;
      url.search = ""; url.hash = ""; safePage = url.origin + safeDisplayText(url.pathname);
    } catch { continue; }
    const key = JSON.stringify([query, page]);
    const dailyKey = JSON.stringify([key, row.data_date]);
    if (seen.has(dailyKey)) return base; // Duplicate grains must not inflate totals.
    seen.add(dailyKey);
    const group = groups.get(key) ?? { query: safeDisplayText(query), page: safePage, clicks: 0, impressions: 0, ctr: null, averagePosition: null, weightedPosition: 0 };
    group.clicks += clicks as number; group.impressions += impressions as number;
    group.weightedPosition += (position as number) * (impressions as number); groups.set(key, group);
    base.dataDate = !base.dataDate || row.data_date > base.dataDate ? row.data_date : base.dataDate;
  }
  const rows = [...groups.values()].map(({ weightedPosition, ...row }) => ({ ...row, ctr: row.impressions ? row.clicks / row.impressions : null, averagePosition: row.impressions ? weightedPosition / row.impressions : null }))
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.query.localeCompare(b.query) || a.page.localeCompare(b.page));
  return { ...base, status: rows.length ? "partial" : "no_data", rows: rows.slice(offset, offset + limit), total: rows.length };
}


function safeDisplayText(value: string): string {
  let text = value;
  try {
    for (let pass = 0; pass < 4 && /%[0-9a-f]{2}/i.test(text); pass++) text = decodeURIComponent(text);
    if (/%[0-9a-f]{2}/i.test(text)) return "[REDACTED_PII]";
  } catch { return "[REDACTED_PII]"; }
  return redactForClient(text);
}
