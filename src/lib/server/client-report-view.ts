export type ReportRole = "owner" | "editor" | "client";

export type SectionStatus =
  | "ok"
  | "unavailable"
  | "stale"
  | "partial"
  | "degraded"
  | "no_data"
  | "unknown";

export type ProvenanceKind = "first_party" | "third_party_estimate";

export type SnapshotMetric = {
  name: string;
  value: number | null;
  provenance: ProvenanceKind;
  provider: string;
  dataDate: string | null;
};

export type SnapshotSection = {
  key: string;
  status: SectionStatus;
  freshness: string | null;
  lastSyncAt: string | null;
  warning: string | null;
  reasonCode?: string | null;
  metrics: SnapshotMetric[];
};

export const CHANNEL_KEYS = [
  "direct",
  "organic",
  "referral",
  "social",
  "paid",
  "email",
  "other",
] as const;

export type ChannelKey = (typeof CHANNEL_KEYS)[number];

/** Per-provider stale thresholds. GSC lag of 2–3 days is expected; GA4 >1 day is stale. */
export const STALE_AFTER_MS: Record<string, number> = {
  gsc: 3 * 24 * 60 * 60 * 1000,
  ga4: 1 * 24 * 60 * 60 * 1000,
  clarity: 2 * 24 * 60 * 60 * 1000,
  bing_webmaster: 2 * 24 * 60 * 60 * 1000,
};

const DEFAULT_STALE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;

const SECRET_RE =
  /(authorization|bearer|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|credential[_-]?ref)([\s:="']+)(?:bearer[\s]+)?[^\s&,;"']+/gi;

export function redactClientText(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text.replace(SECRET_RE, "$1$2<redacted>").trim();
  return cleaned || null;
}

export function staleAfterMs(provider: string): number {
  return STALE_AFTER_MS[provider] ?? DEFAULT_STALE_AFTER_MS;
}

export function freshnessStatus(
  provider: string,
  lastSuccessAt: string | null | undefined,
  now = Date.now(),
): "ok" | "stale" | "unavailable" {
  if (!lastSuccessAt) return "unavailable";
  const ts = Date.parse(lastSuccessAt);
  if (!Number.isFinite(ts)) return "unavailable";
  return now - ts > staleAfterMs(provider) ? "stale" : "ok";
}

export function applySectionFreshness(
  section: SnapshotSection,
  providerHint?: string,
  now = Date.now(),
): SnapshotSection {
  if (section.status === "unavailable" || section.status === "no_data") {
    return section;
  }
  const provider = providerHint ?? section.metrics[0]?.provider ?? section.key;
  const stamp = section.lastSyncAt ?? section.freshness;
  const fresh = freshnessStatus(provider, stamp, now);
  if (fresh === "stale" && section.status === "ok") {
    return { ...section, status: "stale" };
  }
  return section;
}

export function clientLabelForStatus(status: SectionStatus): string {
  switch (status) {
    case "ok":
      return "ok";
    case "stale":
      return "stale";
    case "partial":
      return "partial";
    case "degraded":
      return "unavailable";
    case "unavailable":
      return "unavailable";
    case "no_data":
      return "no data";
    default:
      return "unavailable";
  }
}

export type ClientSectionView = {
  key: string;
  status: SectionStatus;
  clientLabel: string;
  freshness: string | null;
  warning: string | null;
  reasonCode: string | null;
  metrics: SnapshotMetric[];
};

export function toClientSectionView(
  section: SnapshotSection,
  role: ReportRole,
): ClientSectionView {
  const showReason = role === "owner" || role === "editor";
  return {
    key: section.key,
    status: section.status,
    clientLabel: clientLabelForStatus(section.status),
    freshness: section.freshness,
    warning: redactClientText(section.warning),
    reasonCode: showReason ? (section.reasonCode ?? null) : null,
    metrics: section.metrics.map((metric) => ({
      ...metric,
      provenance: metric.provenance,
    })),
  };
}

const CHANNEL_ALIASES: Record<string, ChannelKey> = {
  direct: "direct",
  "(direct)": "direct",
  organic: "organic",
  "organic search": "organic",
  referral: "referral",
  social: "social",
  paid: "paid",
  "paid search": "paid",
  cpc: "paid",
  email: "email",
  other: "other",
};

export function classifyChannel(name: string): ChannelKey {
  const key = name.trim().toLowerCase();
  return CHANNEL_ALIASES[key] ?? "other";
}

export function groupAcquisitionChannels(
  metrics: SnapshotMetric[],
): Record<ChannelKey, SnapshotMetric[]> {
  const grouped = Object.fromEntries(CHANNEL_KEYS.map((key) => [key, [] as SnapshotMetric[]])) as Record<
    ChannelKey,
    SnapshotMetric[]
  >;
  for (const metric of metrics) {
    grouped[classifyChannel(metric.name)].push(metric);
  }
  return grouped;
}

export const DEFAULT_CLIENT_SECTIONS = ["overview", "search", "acquisition", "conversions"] as const;

export function visibleSectionKeys(
  role: ReportRole,
  granted: string[] | null | undefined,
): string[] {
  if (role === "owner" || role === "editor") {
    return [...DEFAULT_CLIENT_SECTIONS, "providerHealth"];
  }
  const allow = new Set((granted ?? DEFAULT_CLIENT_SECTIONS).map((item) => item.trim()).filter(Boolean));
  return DEFAULT_CLIENT_SECTIONS.filter((key) => allow.has(key));
}

export function projectSectionGrants(role: ReportRole, grants: string[] | undefined, sections: SnapshotSection[]) {
  const keys = new Set(visibleSectionKeys(role, grants));
  return sections.filter((section) => keys.has(section.key));
}

export type ClientReportView = {
  projectId: string;
  site: string;
  periodLabel: string;
  comparisonLabel: string | null;
  sections: ClientSectionView[];
  channels: Record<ChannelKey, SnapshotMetric[]>;
};

export function buildClientReportView(input: {
  projectId: string;
  site: string;
  periodLabel: string;
  comparisonLabel?: string | null;
  role: ReportRole;
  grants?: string[];
  sections: SnapshotSection[];
  now?: number;
}): ClientReportView {
  const visible = projectSectionGrants(input.role, input.grants, input.sections).map((section) =>
    applySectionFreshness(section, undefined, input.now),
  );
  const views = visible.map((section) => toClientSectionView(section, input.role));
  const acquisition = visible.find((section) => section.key === "acquisition");
  return {
    projectId: input.projectId,
    site: input.site,
    periodLabel: input.periodLabel,
    comparisonLabel: input.comparisonLabel ?? null,
    sections: views,
    channels: groupAcquisitionChannels(acquisition?.metrics ?? []),
  };
}
