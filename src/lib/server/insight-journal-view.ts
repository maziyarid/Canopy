import type { InsightJournalDay, InsightRecord } from "./evidence-insights.ts";

export type InsightCardView = {
  id: string;
  date: string;
  type: InsightRecord["type"];
  title: string;
  body: string;
  provenance: InsightRecord["provenance"];
  limitation: string;
  recommendedAction: string | null;
  metricNames: string[];
  evidenceCount: number;
};

export type InsightJournalView = {
  days: Array<{ date: string; cards: InsightCardView[] }>;
  truncated: boolean;
  visibleLimit: number;
};

export type MetricPlacement = {
  metricName: string;
  site?: string;
  periodStart?: string;
  periodEnd?: string;
};

function norm(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

/** Fail closed: both sides must agree when either side carries a dimension. */
function sameDimension(left: string | undefined | null, right: string | undefined | null): boolean {
  const evidence = norm(left);
  const wanted = norm(right);
  if (!evidence && !wanted) return true;
  if (!evidence || !wanted) return false;
  return evidence === wanted;
}

export function metricNamesForInsight(insight: InsightRecord): string[] {
  const names = insight.evidenceRefs
    .map((ref) => ref.metricName?.trim())
    .filter((name): name is string => Boolean(name));
  return [...new Set(names)];
}

export function insightsBesideMetric(
  insights: readonly InsightRecord[],
  metric: string | MetricPlacement,
): InsightRecord[] {
  const placement: MetricPlacement = typeof metric === "string" ? { metricName: metric } : metric;
  const wantedName = norm(placement.metricName);
  if (!wantedName) return [];
  return insights.filter((insight) =>
    insight.evidenceRefs.some(
      (ref) =>
        norm(ref.metricName) === wantedName &&
        sameDimension(ref.site, placement.site) &&
        sameDimension(ref.periodStart, placement.periodStart) &&
        sameDimension(ref.periodEnd, placement.periodEnd),
    ),
  );
}

export function toInsightCardView(insight: InsightRecord): InsightCardView {
  return {
    id: insight.id,
    date: insight.generatedAt.slice(0, 10),
    type: insight.type,
    title: insight.title,
    body: insight.body,
    provenance: insight.provenance,
    limitation: insight.limitation,
    recommendedAction: insight.recommendedAction,
    metricNames: metricNamesForInsight(insight),
    evidenceCount: insight.evidenceRefs.length,
  };
}

export function buildInsightJournalView(
  days: InsightJournalDay[],
  options?: { truncated?: boolean; visibleLimit?: number },
): InsightJournalView {
  return {
    days: days.map((day) => ({
      date: day.date,
      cards: day.insights.map(toInsightCardView),
    })),
    truncated: options?.truncated === true,
    visibleLimit: options?.visibleLimit ?? 100,
  };
}
