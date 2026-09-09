import type {
  AnalyticsRefreshResult,
  AnalyticsSnapshot,
  AnalyticsSource,
} from './contracts'

const DEFAULT_TIMEOUT_MS = 15_000

function getGatewayConfig() {
  const baseUrl = process.env.ANALYTICS_GATEWAY_URL?.replace(/\/+$/, '')
  const token = process.env.ANALYTICS_GATEWAY_TOKEN

  if (!baseUrl) {
    throw new Error('ANALYTICS_GATEWAY_URL is not configured')
  }

  if (!token) {
    throw new Error('ANALYTICS_GATEWAY_TOKEN is not configured')
  }

  return { baseUrl, token }
}

async function gatewayFetch<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const { baseUrl, token } = getGatewayConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `Analytics gateway request failed (${response.status} ${response.statusText})${
          body ? `: ${body.slice(0, 500)}` : ''
        }`,
      )
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

export async function getAnalyticsSnapshot(
  site: string,
  window = '7d',
): Promise<AnalyticsSnapshot> {
  return gatewayFetch<AnalyticsSnapshot>(
    `/v1/sites/${encodeURIComponent(site)}/snapshot?window=${encodeURIComponent(window)}`,
  )
}

export async function requestAnalyticsRefresh(
  site: string,
  sources: AnalyticsSource[] = ['gsc', 'ga4', 'clarity'],
): Promise<AnalyticsRefreshResult> {
  return gatewayFetch<AnalyticsRefreshResult>(
    `/v1/sites/${encodeURIComponent(site)}/refresh`,
    {
      method: 'POST',
      body: JSON.stringify({ sources }),
    },
  )
}
