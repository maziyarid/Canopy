import {
  type InsightRecord,
  type InsightRole,
  clientMaySee,
  redactInsightForRole,
} from "./evidence-insights.ts";
import {
  buildInsightJournalView,
  insightsBesideMetric,
  toInsightCardView,
  type InsightCardView,
  type InsightJournalView,
} from "./insight-journal-view.ts";
import {
  evidenceFromSnapshot,
  insightsFromSnapshot,
  type ReportingSnapshotLike,
} from "./snapshot-insight-adapter.ts";

export type InsightJournalMountModel = {
  journal: InsightJournalView;
  beside: Array<{ metricName: string; site: string; periodStart: string; periodEnd: string; cards: InsightCardView[] }>;
  warnings: string[];
};

const ADVERSE = new Set(["unavailable", "unknown", "degraded"]);

function scopedInsights(
  insights: readonly InsightRecord[],
  projectId: string | undefined,
): InsightRecord[] {
  if (!projectId) return [...insights];
  return insights.filter((insight) => insight.projectId === projectId);
}

function visibleInsights(insights: readonly InsightRecord[], role: InsightRole): InsightRecord[] {
  return insights
    .map((insight) => redactInsightForRole(insight, role))
    .filter((insight): insight is InsightRecord => insight !== null && clientMaySee(insight, role));
}

function journalDays(insights: readonly InsightRecord[]): InsightJournalView {
  const byDate = new Map<string, InsightRecord[]>();
  for (const insight of insights) {
    const date = insight.generatedAt.slice(0, 10);
    const bucket = byDate.get(date) ?? [];
    bucket.push(insight);
    byDate.set(date, bucket);
  }
  const days = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, rows]) => ({
      date,
      insights: rows.sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1)),
    }));
  return buildInsightJournalView(days);
}

function metricHasUsableValue(value: unknown): boolean {
  return value !== null && value !== undefined && !(typeof value === "number" && Number.isNaN(value));
}

function isGa4Section(section: ReportingSnapshotLike["sections"][number]): boolean {
  const key = section.key.trim().toLowerCase();
  if (key === "acquisition" || key === "engagement" || key === "ga4") return true;
  return section.metrics.some((metric) => metric.provider.trim().toLowerCase() === "ga4");
}

function snapshotHasAdverseGa4Section(snapshot: ReportingSnapshotLike): boolean {
  return snapshot.sections.some((section) => {
    const status = section.status.trim().toLowerCase();
    if (!ADVERSE.has(status)) return false;
    return isGa4Section(section);
  });
}

function snapshotHasEligibleGa4JournalMetric(snapshot: ReportingSnapshotLike): boolean {
  return evidenceFromSnapshot(snapshot).some((ref) => ref.provider === "ga4" && ref.kind === "metric");
}

function ga4JournalWarnings(snapshot: ReportingSnapshotLike): string[] {
  if (!snapshotHasAdverseGa4Section(snapshot)) return [];
  if (snapshotHasEligibleGa4JournalMetric(snapshot)) {
    const names = snapshot.sections
      .filter((section) => ADVERSE.has(section.status.trim().toLowerCase()) && isGa4Section(section))
      .map((section) => section.key.trim() || "GA4")
      .filter((name, index, all) => all.indexOf(name) === index);
    return names.map(
      (name) => `${name} is unavailable; other GA4 metrics for this period are shown independently.`,
    );
  }
  return ["GA4 is unavailable for this period; Search metrics are shown independently."];
}

export function mountInsightJournal(options: {
  insights?: readonly InsightRecord[];
  snapshot?: ReportingSnapshotLike;
  projectId?: string;
  role: InsightRole;
  now?: Date;
}): InsightJournalMountModel {
  const generated = options.snapshot
    ? insightsFromSnapshot(options.snapshot, "assistant:snapshot", options.now ?? new Date())
    : [];
  const projectId = options.snapshot?.projectId ?? options.projectId;
  const combined = scopedInsights([...(options.insights ?? []), ...generated], projectId);
  const visible = visibleInsights(combined, options.role);
  const journal = journalDays(visible);

  const beside: InsightJournalMountModel["beside"] = [];
  const warnings: string[] = [];
  if (options.snapshot) {
    warnings.push(...ga4JournalWarnings(options.snapshot));
    const seen = new Set<string>();
    for (const section of options.snapshot.sections) {
      for (const metric of section.metrics) {
        if (!metric.name.trim()) continue;
        if (!metricHasUsableValue(metric.value)) continue;
        const key = `${metric.name}|${options.snapshot.site}|${options.snapshot.period.start}|${options.snapshot.period.end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const matches = insightsBesideMetric(visible, {
          metricName: metric.name,
          site: options.snapshot.site,
          periodStart: options.snapshot.period.start,
          periodEnd: options.snapshot.period.end,
        });
        if (!matches.length) continue;
        beside.push({
          metricName: metric.name,
          site: options.snapshot.site,
          periodStart: options.snapshot.period.start,
          periodEnd: options.snapshot.period.end,
          cards: matches.map(toInsightCardView),
        });
      }
    }
  }

  return { journal, beside, warnings };
}
