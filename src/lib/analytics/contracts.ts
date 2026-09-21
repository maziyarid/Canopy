export type AnalyticsSource = 'gsc' | 'ga4' | 'clarity'

export type AnalyticsSourceHealth = {
  source: AnalyticsSource
  status: 'ok' | 'stale' | 'error' | 'not_configured'
  checkedAt?: string
  lastSuccessfulSync?: string
  message?: string
}

export type AnalyticsSiteProfile = {
  site: string
  baseUrl: string
  gscProperty?: string
  ga4PropertyId?: string
  clarityProjectId?: string
}

export type GscAnalyticsSummary = {
  clicks?: number
  impressions?: number
  ctr?: number
  averagePosition?: number
  indexed?: boolean
  coverageState?: string
  indexingState?: string
  lastCrawlTime?: string
  sitemapStatus?: string
}

export type Ga4AnalyticsSummary = {
  users?: number
  newUsers?: number
  sessions?: number
  engagedSessions?: number
  engagementRate?: number
  averageEngagementTimeSeconds?: number
  conversions?: number
}

export type ClarityAnalyticsSummary = {
  sessions?: number
  distinctUsers?: number
  scrollDepth?: number
  engagementTimeSeconds?: number
  deadClicks?: number
  rageClicks?: number
  quickbacks?: number
  scriptErrors?: number
}

export type AnalyticsSnapshot = {
  site: string
  generatedAt: string
  window: string
  gsc?: GscAnalyticsSummary
  ga4?: Ga4AnalyticsSummary
  clarity?: ClarityAnalyticsSummary
  health: AnalyticsSourceHealth[]
  warnings?: string[]
}

export type AnalyticsRefreshRequest = {
  site: string
  sources?: AnalyticsSource[]
}

export type AnalyticsRefreshResult = {
  site: string
  accepted: AnalyticsSource[]
  queuedAt: string
}