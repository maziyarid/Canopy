export type ReportRole = "owner" | "editor" | "client";

export type SectionStatus =
  | "ok"
  | "unavailable"
  | "stale"
  | "partial"
  | "degraded"
  | "no_data"
  | "unknown";

export type ClientFacingStatus = Exclude<SectionStatus, "degraded" | "unknown">;

export type ProvenanceKind = "first_party" | "third_party_estimate";

export type SnapshotMetric = {
  name: string;
  value: number | null;
  provenance: ProvenanceKind;
  provider: string;
  dataDate: string | null;
  coverage?: { start: string; end: string; complete: boolean; observedDates: string[] };
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

/** Per-provider stale thresholds. GSC lag of 2-3 days is expected; GA4 >1 day is stale. */
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

/**
 * Date-only values represent a reporting day, not midnight UTC.
 * Treat them as the end of that UTC day so yesterday's GA4/GSC row
 * stays current through today instead of going stale at 00:00Z.
 */
export function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const isoish = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
  const ts = Date.parse(isoish);
  return Number.isFinite(ts) ? ts : null;
}

export function freshnessStatus(
  provider: string,
  lastSuccessAt: string | null | undefined,
  now = Date.now(),
): "ok" | "stale" | "unavailable" {
  if (!lastSuccessAt) return "unavailable";
  const ts = parseTimestamp(lastSuccessAt);
  if (ts === null) return "unavailable";
  return now - ts > staleAfterMs(provider) ? "stale" : "ok";
}

/** Newest usable measurement date. Historical period rows must not drive stale. */
export function newestMeasurementStamp(section: SnapshotSection): string | null {
  let newest: { raw: string; ts: number } | null = null;
  for (const raw of section.metrics.map((metric) => metric.dataDate)) {
    const ts = parseTimestamp(raw);
    if (ts === null || !raw) continue;
    if (!newest || ts > newest.ts) newest = { raw, ts };
  }
  const freshnessTs = parseTimestamp(section.freshness);
  if (section.freshness && freshnessTs !== null) {
    if (!newest || freshnessTs > newest.ts) newest = { raw: section.freshness, ts: freshnessTs };
  }
  return newest?.raw ?? null;
}

/** Header + newest-per-provider stamps only; historical period rows are ignored. */
export function oldestDisplayStamp(section: SnapshotSection): string | null {
  const newestByProvider = new Map<string, string>();
  for (const metric of section.metrics) {
    const ts = parseTimestamp(metric.dataDate);
    if (!metric.dataDate || ts === null) continue;
    const provider = metric.provider || "unknown";
    const currentTs = parseTimestamp(newestByProvider.get(provider));
    if (currentTs === null || ts > currentTs) newestByProvider.set(provider, metric.dataDate);
  }
  let oldest: { raw: string; ts: number } | null = null;
  const candidates = [section.freshness, ...newestByProvider.values()];
  for (const raw of candidates) {
    const ts = parseTimestamp(raw);
    if (ts === null || !raw) continue;
    if (!oldest || ts < oldest.ts) oldest = { raw, ts };
  }
  return oldest?.raw ?? null;
}

export function sectionProviders(section: SnapshotSection, hint?: string): string[] {
  const providers = section.metrics.map((metric) => metric.provider).filter(Boolean);
  if (hint) providers.push(hint);
  if (providers.length === 0 && section.key) providers.push(section.key);
  return [...new Set(providers)];
}

export function mostRestrictiveProvider(providers: string[]): string {
  if (providers.length === 0) return "unknown";
  return providers.reduce((strictest, provider) =>
    staleAfterMs(provider) < staleAfterMs(strictest) ? provider : strictest,
  );
}

function worstFreshness(
  statuses: Array<"ok" | "stale" | "unavailable">,
): "ok" | "stale" | "unavailable" {
  if (statuses.includes("stale")) return "stale";
  if (statuses.length === 0 || statuses.every((status) => status === "unavailable")) {
    return "unavailable";
  }
  return "ok";
}

export function applySectionFreshness(
  section: SnapshotSection,
  providerHint?: string,
  now = Date.now(),
): SnapshotSection {
  if (section.status === "unavailable" || section.status === "no_data") {
    return section;
  }
  const providers = sectionProviders(section, providerHint);
  const restrictive = mostRestrictiveProvider(providers);
  const statuses: Array<"ok" | "stale" | "unavailable"> = [];
  const newestByProvider = new Map<string, string>();
  for (const metric of section.metrics) {
    const ts = parseTimestamp(metric.dataDate);
    if (!metric.dataDate || ts === null) continue;
    const provider = metric.provider || restrictive;
    const current = newestByProvider.get(provider);
    const currentTs = parseTimestamp(current);
    if (currentTs === null || ts > currentTs) newestByProvider.set(provider, metric.dataDate);
  }
  const judge = providers.length > 0 ? providers : [restrictive];
  for (const provider of judge) {
    const own = newestByProvider.get(provider);
    if (own) statuses.push(freshnessStatus(provider, own, now));
    else if (section.freshness) statuses.push(freshnessStatus(provider, section.freshness, now));
  }
  if (section.freshness) {
    const longest = judge.reduce((a, b) => (staleAfterMs(b) > staleAfterMs(a) ? b : a));
    statuses.push(freshnessStatus(longest, section.freshness, now));
  }
  if (newestByProvider.size === 0 && !section.freshness && section.lastSyncAt) {
    statuses.push(freshnessStatus(restrictive, section.lastSyncAt, now));
  }

  const fresh = worstFreshness(statuses);
  const displayFreshness = oldestDisplayStamp(section) ?? section.freshness;
  const next: SnapshotSection =
    displayFreshness === section.freshness ? section : { ...section, freshness: displayFreshness };
  if (fresh === "unavailable" && section.status === "ok") {
    return { ...next, status: "unavailable" };
  }
  if (fresh === "stale" && (section.status === "ok" || section.status === "partial")) {
    return { ...next, status: "stale" };
  }
  return next;
}

export function normalizeClientStatus(status: SectionStatus): ClientFacingStatus {
  if (status === "degraded" || status === "unknown") return "unavailable";
  return status;
}

export function clientLabelForStatus(status: SectionStatus): string {
  switch (normalizeClientStatus(status)) {
    case "ok":
      return "ok";
    case "stale":
      return "stale";
    case "partial":
      return "partial";
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
  const status = role === "client" ? normalizeClientStatus(section.status) : section.status;
  return {
    key: section.key,
    status,
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

/** Sum measured channel values; null when every value is missing so UI can show "\u2014" not 0. */
export function channelMeasuredTotal(rows: SnapshotMetric[]): number | null {
  let total = 0;
  let seen = false;
  for (const row of rows) {
    if (typeof row.value === "number" && Number.isFinite(row.value)) {
      total += row.value;
      seen = true;
    }
  }
  return seen ? total : null;
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
  acquisitionStatus: SectionStatus | null;
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
  const acquisitionView = views.find((section) => section.key === "acquisition");
  return {
    projectId: input.projectId,
    site: input.site,
    periodLabel: input.periodLabel,
    comparisonLabel: input.comparisonLabel ?? null,
    sections: views,
    channels: groupAcquisitionChannels(acquisition?.metrics ?? []),
    acquisitionStatus: acquisitionView?.status ?? null,
  };
}

export const CLIENT_DASHBOARD_TRANSPORT = "local_view_model_only" as const;
export const DISABLED_REPORTING_ROUTE = "/api/v1/reporting/snapshot";

export type DashboardAccess = {
  role: ReportRole;
  boundProjectId: string;
  requestedProjectId?: string | null;
  reportingConfigured: boolean;
};

export class ClientDashboardScopeError extends Error {
  readonly code = "client_supplied_scope_rejected";
  constructor() {
    super("client_supplied_scope_rejected");
    this.name = "ClientDashboardScopeError";
  }
}

export function bindResolvedDashboardAccess(input: {
  role: ReportRole;
  resolvedProjectId: string;
  requestedProjectId: string;
  snapshotProjectId: string;
  reportingConfigured: boolean;
}): DashboardAccess {
  const resolved = input.resolvedProjectId?.trim();
  if (!resolved || resolved !== input.resolvedProjectId) {
    throw new ClientDashboardScopeError();
  }
  if (input.requestedProjectId !== resolved || input.snapshotProjectId !== resolved) {
    throw new ClientDashboardScopeError();
  }
  return {
    role: input.role,
    boundProjectId: resolved,
    requestedProjectId: input.requestedProjectId,
    reportingConfigured: input.reportingConfigured,
  };
}

export function assertDashboardScope(access: DashboardAccess): void {
  const bound = access.boundProjectId?.trim();
  if (!bound || bound !== access.boundProjectId) {
    throw new ClientDashboardScopeError();
  }
  const requested = access.requestedProjectId?.trim();
  if (requested && requested !== bound) {
    throw new ClientDashboardScopeError();
  }
}

export type GatedClientDashboard = ClientReportView & {
  transport: typeof CLIENT_DASHBOARD_TRANSPORT;
  remoteRoute: null;
  reportingConfigured: boolean;
};

function emptyClientDashboard(access: DashboardAccess, site: string, periodLabel: string): GatedClientDashboard {
  return {
    projectId: access.boundProjectId,
    site: redactClientText(site) ?? "",
    periodLabel: redactClientText(periodLabel) ?? "",
    comparisonLabel: null,
    sections: [],
    channels: groupAcquisitionChannels([]),
    acquisitionStatus: "unavailable",
    transport: CLIENT_DASHBOARD_TRANSPORT,
    remoteRoute: null,
    reportingConfigured: false,
  };
}

/**
 * AAX-80 adapter. Uses the local view-model only.
 * The public reporting route stays disabled (PR #17); this function must not fetch it.
 */

export function clientSafePeriod<T extends { label: string }>(period: T | null | undefined): T | null {
  if (!period) return null;
  return { ...period, label: redactClientText(period.label) ?? "" };
}

export function buildGatedClientDashboard(input: {
  access: DashboardAccess;
  site: string;
  periodLabel: string;
  comparisonLabel?: string | null;
  grants?: string[];
  sections: SnapshotSection[];
  now?: number;
  fetchImpl?: (input: string) => Promise<unknown>;
}): GatedClientDashboard {
  assertDashboardScope(input.access);
  if (input.fetchImpl) {
    throw new Error("client_dashboard_remote_route_forbidden");
  }
  if (!input.access.reportingConfigured) {
    return emptyClientDashboard(input.access, input.site, input.periodLabel);
  }
  const view = buildClientReportView({
    projectId: input.access.boundProjectId,
    site: input.site,
    periodLabel: input.periodLabel,
    comparisonLabel: input.comparisonLabel,
    role: input.access.role,
    grants: input.grants,
    sections: input.sections,
    now: input.now,
  });
  const sections = view.sections
    .filter((section) => input.access.role !== "client" || section.key !== "providerHealth")
    .map((section) =>
      input.access.role === "client"
        ? {
            ...section,
            reasonCode: null,
            status: normalizeClientStatus(section.status),
            warning: redactClientText(section.warning),
            freshness: redactClientText(section.freshness),
            metrics: section.metrics
              .map((metric) => ({
                ...metric,
                name: redactClientText(metric.name) ?? "",
                provider: redactClientText(metric.provider) ?? "unknown",
                provenance: metric.provenance,
              }))
              .filter((metric) => metric.name.length > 0),
          }
        : section,
    );
  const acquisition = sections.find((section) => section.key === "acquisition");
  return {
    ...view,
    site: redactClientText(view.site) ?? "",
    periodLabel: redactClientText(view.periodLabel) ?? view.periodLabel,
    comparisonLabel: redactClientText(view.comparisonLabel),
    projectId: input.access.boundProjectId,
    sections,
    channels: input.access.role === "client"
      ? groupAcquisitionChannels(acquisition?.metrics ?? [])
      : view.channels,
    transport: CLIENT_DASHBOARD_TRANSPORT,
    remoteRoute: null,
    reportingConfigured: true,
  };
}
