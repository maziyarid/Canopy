import {
  createInsight,
  type EvidenceProvider,
  type EvidenceRef,
  type InsightDraft,
  type InsightRecord,
} from "./evidence-insights.ts";

export type SnapshotSectionStatus =
  | "ok"
  | "unavailable"
  | "stale"
  | "partial"
  | "degraded"
  | "no_data"
  | "unknown";

export type SnapshotMetricLike = {
  name: string;
  value: number | null;
  provenance: "first_party" | "third_party_estimate";
  provider: string;
  dataDate: string | null;
};

export type SnapshotSectionLike = {
  key: string;
  status: SnapshotSectionStatus | string;
  warning?: string | null;
  metrics: SnapshotMetricLike[];
};

export type ReportingSnapshotLike = {
  projectId: string;
  site: string;
  period: { start: string; end: string; label?: string };
  sections: SnapshotSectionLike[];
};

const FIRST_PARTY = new Set(["gsc", "ga4"]);

function asProvider(raw: string): EvidenceProvider {
  const value = raw.trim().toLowerCase();
  if (value === "gsc" || value === "ga4" || value === "mangools") return value;
  return "other";
}

function sectionStatus(raw: string | undefined): SnapshotSectionStatus {
  const value = (raw ?? "unknown").trim().toLowerCase();
  switch (value) {
    case "ok":
    case "unavailable":
    case "stale":
    case "partial":
    case "degraded":
    case "no_data":
    case "unknown":
      return value;
    default:
      return "unknown";
  }
}

function dateInPeriod(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function metricPeriod(
  metric: SnapshotMetricLike,
  snapshot: ReportingSnapshotLike,
): { start: string; end: string; dataDate?: string } | null {
  if (metric.dataDate && !dateInPeriod(metric.dataDate, snapshot.period.start, snapshot.period.end)) {
    return null;
  }
  // Reporting window stays on periodStart/periodEnd for journal placement.
  // dataDate keeps the measurement date when the snapshot supplies one.
  return {
    start: snapshot.period.start,
    end: snapshot.period.end,
    dataDate: metric.dataDate ?? undefined,
  };
}

function usableFirstPartyMetric(metric: SnapshotMetricLike, status: SnapshotSectionStatus): boolean {
  if (status === "unavailable" || status === "unknown" || status === "degraded") return false;
  if (metric.value == null) return false;
  if (metric.provenance !== "first_party") return false;
  return FIRST_PARTY.has(metric.provider.trim().toLowerCase());
}

export function evidenceFromSnapshot(snapshot: ReportingSnapshotLike): EvidenceRef[] {
  const refs: EvidenceRef[] = [];
  for (const section of snapshot.sections) {
    const status = sectionStatus(section.status);
    for (const metric of section.metrics) {
      if (!usableFirstPartyMetric(metric, status)) continue;
      const period = metricPeriod(metric, snapshot);
      if (!period) continue;
      refs.push({
        provider: asProvider(metric.provider),
        provenance: "first_party",
        kind: "metric",
        metricName: metric.name,
        site: snapshot.site,
        periodStart: period.start,
        periodEnd: period.end,
        dataDate: period.dataDate,
        snapshotId: `${snapshot.projectId}:${snapshot.period.start}:${snapshot.period.end}`,
        value: metric.value,
      });
    }
  }
  return refs;
}

const ADVERSE = new Set<SnapshotSectionStatus>(["unavailable", "unknown", "degraded"]);
const USABLE = new Set<SnapshotSectionStatus>(["ok", "partial", "stale", "no_data"]);

function mergeProviderStatus(
  current: SnapshotSectionStatus | undefined,
  next: SnapshotSectionStatus,
): SnapshotSectionStatus {
  if (!current) return next;
  if (USABLE.has(current) && ADVERSE.has(next)) return current;
  if (ADVERSE.has(current) && USABLE.has(next)) return next;
  if (current === "ok") return current;
  return next;
}

export function providerAvailability(snapshot: ReportingSnapshotLike): Record<string, SnapshotSectionStatus> {
  const out: Record<string, SnapshotSectionStatus> = {};
  for (const section of snapshot.sections) {
    const status = sectionStatus(section.status);
    for (const metric of section.metrics) {
      const provider = metric.provider.trim().toLowerCase();
      if (!provider) continue;
      out[provider] = mergeProviderStatus(out[provider], status);
    }
    const key = section.key.trim().toLowerCase();
    if (key === "acquisition") {
      out.ga4 = mergeProviderStatus(out.ga4, status);
    }
    if (key === "search") {
      out.gsc = mergeProviderStatus(out.gsc, status);
    }
  }
  return out;
}

function hasGa4Section(snapshot: ReportingSnapshotLike): boolean {
  return snapshot.sections.some((section) => {
    const key = section.key.trim().toLowerCase();
    if (key === "acquisition") return true;
    return section.metrics.some((metric) => metric.provider.trim().toLowerCase() === "ga4");
  });
}

function ga4SnapshotEvidence(snapshot: ReportingSnapshotLike): EvidenceRef {
  return {
    provider: "ga4",
    provenance: "first_party",
    kind: "snapshot",
    snapshotId: `${snapshot.projectId}:ga4:${snapshot.period.start}:${snapshot.period.end}`,
    site: snapshot.site,
    periodStart: snapshot.period.start,
    periodEnd: snapshot.period.end,
  };
}

export function draftsFromSnapshot(
  snapshot: ReportingSnapshotLike,
  generatedBy = "assistant:snapshot",
): InsightDraft[] {
  const availability = providerAvailability(snapshot);
  const refs = evidenceFromSnapshot(snapshot);
  const drafts: InsightDraft[] = [];

  const gscRefs = refs.filter((ref) => ref.provider === "gsc");
  if (gscRefs.length) {
    const clicks = gscRefs.find((ref) => ref.metricName === "clicks");
    const title = clicks
      ? `Observed ${clicks.value} Search Console clicks`
      : "Observed Search Console metrics";
    const bodyParts = gscRefs.map((ref) => `${ref.metricName}=${ref.value}`);
    drafts.push({
      projectId: snapshot.projectId,
      periodStart: snapshot.period.start,
      periodEnd: snapshot.period.end,
      type: "observation",
      title,
      body: `Observed first-party GSC metrics for ${snapshot.site}: ${bodyParts.join(", ")}.`,
      evidenceRefs: gscRefs,
      generatedBy,
      limitation: "Causality is not proven; treat as observed GSC facts only.",
    });
  }

  const ga4Refs = refs.filter((ref) => ref.provider === "ga4");
  if (ga4Refs.length) {
    drafts.push({
      projectId: snapshot.projectId,
      periodStart: snapshot.period.start,
      periodEnd: snapshot.period.end,
      type: "observation",
      title: "Observed GA4 first-party metrics",
      body: `Observed first-party GA4 metrics for ${snapshot.site}: ${ga4Refs
        .map((ref) => `${ref.metricName}=${ref.value}`)
        .join(", ")}.`,
      evidenceRefs: ga4Refs,
      generatedBy,
      limitation: "Causality is not proven; treat as observed GA4 facts only.",
    });
  } else if (hasGa4Section(snapshot)) {
    const ga4Status = availability.ga4 ?? "unavailable";
    const adverseWithoutMetrics =
      ga4Status === "unavailable" ||
      ga4Status === "unknown" ||
      ga4Status === "degraded" ||
      snapshot.sections.some((section) => {
        const status = sectionStatus(section.status);
        if (!(status === "unavailable" || status === "unknown" || status === "degraded")) return false;
        const key = section.key.trim().toLowerCase();
        return key === "acquisition" || section.metrics.some((metric) => metric.provider.trim().toLowerCase() === "ga4");
      });
    if (adverseWithoutMetrics) {
      drafts.push({
        projectId: snapshot.projectId,
        periodStart: snapshot.period.start,
        periodEnd: snapshot.period.end,
        type: "observation",
        title: "GA4 section unavailable",
        body: "GA4 is marked unavailable for this period. Search metrics remain usable without blending an estimate.",
        evidenceRefs: [ga4SnapshotEvidence(snapshot)],
        generatedBy,
        limitation: "GA4 live path is not enabled; reports must degrade this section independently.",
      });
    }
  }

  return drafts;
}

export function insightsFromSnapshot(
  snapshot: ReportingSnapshotLike,
  generatedBy = "assistant:snapshot",
  now = new Date(),
): InsightRecord[] {
  return draftsFromSnapshot(snapshot, generatedBy).map((draft) => createInsight(draft, now));
}
