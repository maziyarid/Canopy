export const PROVIDER_KEYS = [
  "gsc",
  "ga4",
  "gtm",
  "clarity",
  "bing_webmaster",
  "semrush",
  "ubersuggest",
  "mangools",
] as const;

export type ProviderKey = (typeof PROVIDER_KEYS)[number];
export type AnalyticsSource = Extract<ProviderKey, "gsc" | "ga4" | "clarity">;
export type ProviderStatus =
  | "ok"
  | "stale"
  | "error"
  | "degraded"
  | "disabled"
  | "not_configured";

export type ProviderState = {
  provider: ProviderKey;
  status: ProviderStatus;
  auth_type: string;
  capability: string;
  last_success: string | null;
  last_attempt: string | null;
  last_error: string | null;
  freshness: string | null;
  enabled: number;
  updated_at: string;
};

export type ProviderSyncRun = {
  id: string;
  provider: ProviderKey;
  site: string;
  window: string;
  status: string;
  retry_count: number;
  rows_written: number;
  idempotency_key: string;
  started_at: string;
  finished_at: string | null;
  error_class: string | null;
};

export type ProviderListResponse = {
  providers: ProviderState[];
  generatedAt: string;
};

export type ProviderSyncRunsResponse = {
  runs: ProviderSyncRun[];
};

export type ProviderRefreshResult = {
  site: string;
  accepted: ProviderKey[];
  queuedAt: string;
};

export type AnalyticsSourceHealth = {
  source: AnalyticsSource;
  status: Extract<ProviderStatus, "ok" | "stale" | "error" | "not_configured">;
  checkedAt?: string;
  lastSuccessfulSync?: string;
  message?: string;
};

export type AnalyticsSiteProfile = {
  site: string;
  baseUrl: string;
  gscProperty?: string;
  ga4PropertyId?: string;
  clarityProjectId?: string;
};

export type GscAnalyticsSummary = {
  clicks?: number;
  impressions?: number;
  ctr?: number;
  averagePosition?: number;
  indexed?: boolean;
  coverageState?: string;
  indexingState?: string;
  lastCrawlTime?: string;
  sitemapStatus?: string;
};

export type Ga4AnalyticsSummary = {
  users?: number;
  newUsers?: number;
  sessions?: number;
  engagedSessions?: number;
  engagementRate?: number;
  averageEngagementTimeSeconds?: number;
  conversions?: number;
};

export type ClarityAnalyticsSummary = {
  sessions?: number;
  distinctUsers?: number;
  scrollDepth?: number;
  engagementTimeSeconds?: number;
  deadClicks?: number;
  rageClicks?: number;
  quickbacks?: number;
  scriptErrors?: number;
};

export type AnalyticsSnapshot = {
  site: string;
  generatedAt: string;
  window: string;
  gsc?: GscAnalyticsSummary;
  ga4?: Ga4AnalyticsSummary;
  clarity?: ClarityAnalyticsSummary;
  health: AnalyticsSourceHealth[];
  warnings?: string[];
};

export type AnalyticsRefreshRequest = {
  site: string;
  sources?: AnalyticsSource[];
};

export type AnalyticsRefreshResult = {
  site: string;
  accepted: AnalyticsSource[];
  queuedAt: string;
};
