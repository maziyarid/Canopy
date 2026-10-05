import type { ReportingSnapshot, SnapshotMetric } from "./reporting-snapshot-core.ts";
import { redactClientText } from "./client-report-view.ts";

export type ComparisonRow = {
  section: string; provider: string; metric: string;
  current: number | null; previous: number | null;
  difference: number | null; relativeChange: number | null;
  reason: "comparable" | "incomplete" | "unavailable" | "zero_baseline";
};

/** Compare matching definitions only. Partial retrieval is not a growth estimate. */
export function comparisonRows(snapshot: ReportingSnapshot): ComparisonRow[] {
  if (!snapshot.comparison) return [];
  return snapshot.sections.filter(section => section.key !== "overview").flatMap(section => {
    const previous = snapshot.comparisonSections?.find(item => item.key === section.key);
    return section.metrics.map(metric => {
      const baseline = previous?.metrics.find(item => item.name === metric.name && item.provider === metric.provider && item.provenance === metric.provenance);
      let reason: ComparisonRow["reason"] = "comparable";
      const current = finite(metric.value), old = finite(baseline?.value);
      if (current === null || old === null || !previous || [section.status, previous.status].some(status => ["unavailable", "no_data", "degraded", "unknown"].includes(status))) reason = "unavailable";
      else if (!metric.coverage?.complete || !baseline?.coverage?.complete || metric.coverage.start !== snapshot.period.start || metric.coverage.end !== snapshot.period.end || baseline.coverage.start !== snapshot.comparison!.start || baseline.coverage.end !== snapshot.comparison!.end || [section.status, previous.status].includes("partial")) reason = "incomplete";
      else if (old === 0) reason = "zero_baseline";
      const measured = reason === "comparable" || reason === "zero_baseline";
      return { section: section.key, provider: metric.provider, metric: metric.name, current, previous: old, difference: measured ? current! - old! : null, relativeChange: reason === "comparable" ? (current! - old!) / old! : null, reason };
    });
  });
}

/** Client comparisons stay inside granted sections and drop credential-shaped metric names. */
export function clientComparisonRows(
  snapshot: ReportingSnapshot,
  visibleSectionKeys: readonly string[],
): ComparisonRow[] {
  const allow = new Set(visibleSectionKeys.filter((key) => key !== "overview" && key !== "providerHealth"));
  return comparisonRows(snapshot)
    .filter((row) => allow.has(row.section))
    .map((row) => ({ ...row, metric: redactClientText(row.metric) ?? "" }))
    .filter((row) => row.metric.length > 0);
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cell(value: unknown): string {
  let text = value == null ? "" : String(value);
  // Excel/LibreOffice can interpret formula prefixes after whitespace.
  if (/^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Input has already passed current access/grant filtering on the server. */
export function reportCsv(snapshot: ReportingSnapshot): string {
  const header = ["site", "period_start", "period_end", "section", "provider", "metric", "value", "provenance", "data_date", "coverage_complete", "status", "comparison_start", "comparison_end", "previous_value", "difference", "relative_change", "comparison_state"];
  const comparisons = comparisonRows(snapshot);
  const rows = snapshot.sections.filter(section => section.key !== "overview").flatMap(section => section.metrics.map((metric: SnapshotMetric) => {
    const comparison = comparisons.find(row => row.section === section.key && row.metric === metric.name && row.provider === metric.provider);
    return [snapshot.site, snapshot.period.start, snapshot.period.end, section.key, metric.provider, metric.name, finite(metric.value), metric.provenance, metric.dataDate, metric.coverage?.complete ?? false, section.status, snapshot.comparison?.start, snapshot.comparison?.end, comparison?.previous, comparison?.difference, comparison?.relativeChange, comparison?.reason];
  }));
  return [header, ...rows].map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export type ClientExportSection = {
  key: string;
  status: string;
  metrics: Array<{ name: string; provider: string; value: number | null; provenance?: string | null; dataDate?: string | null }>;
};

/** Client export uses the already redacted dashboard view and visible journal titles only. */
export function clientEvidenceExportCsv(input: {
  site: string;
  periodStart: string;
  periodEnd: string;
  sections: readonly ClientExportSection[];
  evidenceTitles: readonly string[];
}): string {
  const header = ["site", "period_start", "period_end", "section", "provider", "metric", "value", "provenance", "data_date", "status", "evidence_title"];
  const metricRows = input.sections
    .filter((section) => section.key !== "overview" && section.key !== "providerHealth")
    .flatMap((section) => section.metrics.map((metric) => [
      input.site, input.periodStart, input.periodEnd, section.key, metric.provider, metric.name,
      finite(metric.value), metric.provenance ?? "", metric.dataDate ?? "", section.status, "",
    ]));
  const evidenceRows = input.evidenceTitles.flatMap((title) => {
    const visible = redactClientText(title);
    if (!visible) return [];
    return [[
      input.site, input.periodStart, input.periodEnd, "evidence_note", "", "", "", "", "", "visible", visible,
    ]];
  });
  return [header, ...metricRows, ...evidenceRows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
