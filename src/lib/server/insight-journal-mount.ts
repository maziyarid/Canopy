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
  providerAvailability,
  type ReportingSnapshotLike,
} from "./snapshot-insight-adapter.ts";

export type InsightJournalMountModel = {
  journal: InsightJournalView;
  beside: Array<{ metricName: string; site: string; periodStart: string; periodEnd: string; cards: InsightCardView[] }>;
  warnings: string[];
};

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

export function mountInsightJournal(options: {
  insights?: readonly InsightRecord[];
  snapshot?: ReportingSnapshotLike;
  role: InsightRole;
  now?: Date;
}): InsightJournalMountModel {
  const generated = options.snapshot
    ? insightsFromSnapshot(options.snapshot, "assistant:snapshot", options.now ?? new Date())
    : [];
  const combined = [...(options.insights ?? []), ...generated];
  const visible = visibleInsights(combined, options.role);
  const journal = journalDays(visible);

  const beside: InsightJournalMountModel["beside"] = [];
  const warnings: string[] = [];
  if (options.snapshot) {
    const availability = providerAvailability(options.snapshot);
    if (availability.ga4 === "unavailable" || availability.ga4 === "degraded" || availability.ga4 === "unknown") {
      warnings.push("GA4 is unavailable for this period; Search metrics are shown independently.");
    }
    const seen = new Set<string>();
    for (const section of options.snapshot.sections) {
      for (const metric of section.metrics) {
        if (!metric.name.trim()) continue;
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
