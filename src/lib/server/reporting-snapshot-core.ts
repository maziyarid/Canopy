import { createHash } from "node:crypto";

export const SNAPSHOT_SCHEMA_VERSION = "ms-robot.reporting.v1";
export const IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;

export const SECTION_STATUSES = [
  "ok",
  "unavailable",
  "stale",
  "partial",
  "degraded",
  "no_data",
  "unknown",
] as const;

export type SectionStatus = (typeof SECTION_STATUSES)[number];
export type ProvenanceKind = "first_party" | "third_party_estimate";

export type SnapshotPeriod = {
  start: string;
  end: string;
  label: string;
};

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
  metrics: SnapshotMetric[];
};

export type ReportingSnapshot = {
  schemaVersion: string;
  projectId: string;
  site: string;
  period: SnapshotPeriod;
  comparison: SnapshotPeriod | null;
  generatedAt: string;
  requestedAt: string;
  etag: string;
  correlationId: string;
  sections: SnapshotSection[];
  providerHealth: SnapshotSection;
};

export type LedgerRow = {
  provider: string;
  status: string;
  lastSuccess: string | null;
  lastAttempt: string | null;
  freshness: string | null;
  lastError: string | null;
  metricName?: string;
  metricValue?: number | null;
  dataDate?: string | null;
  updatedAt?: string | null;
  finishedAt?: string | null;
};

const SECRET_RE =
  /(authorization|bearer|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|credential[_-]?ref)([\s:="']+)(?:bearer[\s]+)?[^\s&,;"']+/gi;

export function normalizeSectionStatus(raw: unknown): SectionStatus {
  if (typeof raw !== "string") return "unknown";
  const value = raw.trim().toLowerCase();
  return (SECTION_STATUSES as readonly string[]).includes(value)
    ? (value as SectionStatus)
    : "unknown";
}

export function redactWarning(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text.replace(SECRET_RE, "$1$2<redacted>").trim();
  return cleaned || null;
}

export function snapshotCacheKey(
  projectId: string,
  periodLabel: string,
  comparisonLabel: string | null,
  schemaVersion = SNAPSHOT_SCHEMA_VERSION,
): string {
  return [schemaVersion, projectId.trim(), periodLabel, comparisonLabel ?? "-"].join("|");
}

export function composeIdempotencyKey(projectId: string, clientKey: string): string {
  return `${projectId.trim()}:${clientKey.trim()}`;
}

export function stableSnapshotBody(snapshot: Omit<ReportingSnapshot, "etag" | "generatedAt" | "requestedAt">) {
  return {
    schemaVersion: snapshot.schemaVersion,
    projectId: snapshot.projectId,
    site: snapshot.site,
    period: snapshot.period,
    comparison: snapshot.comparison,
    sections: snapshot.sections,
    providerHealth: snapshot.providerHealth,
    correlationId: snapshot.correlationId,
  };
}

export function computeStableEtag(body: unknown): string {
  const json = JSON.stringify(body);
  return `"${createHash("sha256").update(json).digest("hex")}"`;
}

export function mapProviderStatus(raw: string | null | undefined): SectionStatus {
  const status = normalizeSectionStatus(raw ?? "unknown");
  if (status !== "unknown") return status;
  switch ((raw ?? "").toLowerCase()) {
    case "ok":
    case "connected":
    case "success":
      return "ok";
    case "error":
    case "failed":
    case "quota":
    case "rate_limited":
      return "degraded";
    case "disabled":
    case "not_configured":
    case "disconnected":
      return "unavailable";
    case "stale":
      return "stale";
    default:
      return "unknown";
  }
}

export function firstPartyProvider(provider: string): boolean {
  return provider === "gsc" || provider === "ga4" || provider === "clarity" || provider === "bing_webmaster";
}

export function deriveOverview(sections: SnapshotSection[]): SnapshotSection {
  const statuses = sections.map((section) => section.status);
  let status: SectionStatus = "no_data";
  if (statuses.includes("ok") && statuses.some((item) => item !== "ok" && item !== "no_data")) {
    status = "partial";
  } else if (statuses.every((item) => item === "unavailable")) {
    status = "unavailable";
  } else if (statuses.includes("degraded")) {
    status = "degraded";
  } else if (statuses.includes("stale") && !statuses.includes("ok")) {
    status = "stale";
  } else if (statuses.includes("ok")) {
    status = "ok";
  } else if (statuses.includes("unknown")) {
    status = "unknown";
  }

  return {
    key: "overview",
    status,
    freshness: sections.map((section) => section.freshness).find(Boolean) ?? null,
    lastSyncAt: sections.map((section) => section.lastSyncAt).find(Boolean) ?? null,
    warning: null,
    metrics: sections.flatMap((section) => section.metrics),
  };
}

export function defaultPeriod(now = new Date()): SnapshotPeriod {
  const end = now.toISOString().slice(0, 10);
  const startDate = new Date(now.getTime() - 27 * 24 * 60 * 60 * 1000);
  return {
    start: startDate.toISOString().slice(0, 10),
    end,
    label: "last_28d",
  };
}

export function comparisonPeriod(period: SnapshotPeriod): SnapshotPeriod {
  const start = new Date(`${period.start}T00:00:00Z`);
  const end = new Date(`${period.end}T00:00:00Z`);
  const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const cmpEnd = new Date(start.getTime() - 86400000);
  const cmpStart = new Date(cmpEnd.getTime() - (span - 1) * 86400000);
  return {
    start: cmpStart.toISOString().slice(0, 10),
    end: cmpEnd.toISOString().slice(0, 10),
    label: `prev_${span}d`,
  };
}

export function ledgerFingerprint(rows: LedgerRow[]): string {
  const tokens = rows
    .map((row) =>
      [
        row.provider,
        row.status,
        row.freshness ?? "",
        row.updatedAt ?? "",
        row.finishedAt ?? "",
        row.dataDate ?? "",
        String(row.metricValue ?? ""),
      ].join(":"),
    )
    .sort();
  return createHash("sha256").update(tokens.join("|")).digest("hex");
}

export class IdempotencyStore {
  private readonly items = new Map<string, { expiresAt: number; payload: unknown }>();

  get(key: string): unknown | undefined {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (item.expiresAt <= Date.now()) {
      this.items.delete(key);
      return undefined;
    }
    return item.payload;
  }

  set(key: string, payload: unknown, ttlMs = IDEMPOTENCY_TTL_MS) {
    this.items.set(key, { expiresAt: Date.now() + ttlMs, payload });
  }
}

export class SnapshotCache {
  private readonly items = new Map<string, { fingerprint: string; snapshot: ReportingSnapshot }>();

  get(key: string, fingerprint: string): ReportingSnapshot | undefined {
    const item = this.items.get(key);
    if (!item || item.fingerprint !== fingerprint) return undefined;
    return item.snapshot;
  }

  set(key: string, fingerprint: string, snapshot: ReportingSnapshot) {
    this.items.set(key, { fingerprint, snapshot });
  }

  clear() {
    this.items.clear();
  }
}
