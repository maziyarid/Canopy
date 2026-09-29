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

function snapshotHasAdverseGa4Section(snapshot: ReportingSnapshotLike): boolean {
  return snapshot.sections.some((section) => {
    const status = section.status.trim().toLowerCase();
    if (!ADVERSE.has(status)) return false;
    const key = section.key.trim().toLowerCase();
    if (key === "acquisition") return true;
    return section.metrics.some((metric) => metric.provider.trim().toLowerCase() === "ga4");
  });
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
    if (snapshotHasAdverseGa4Section(options.snapshot)) {
      warnings.push("GA4 is unavailable for this period; Search metrics are shown independently.");
    }
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
