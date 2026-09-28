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
