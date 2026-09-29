import type {
  AnalyticsRefreshResult,
  AnalyticsSnapshot,
  AnalyticsSource,
  ProviderKey,
  ProviderListResponse,
  ProviderRefreshResult,
  ProviderSyncRunsResponse,
} from "./contracts";

const DEFAULT_TIMEOUT_MS = 15_000;

function getGatewayConfig() {
  const baseUrl = process.env.ANALYTICS_GATEWAY_URL?.replace(/\/+$/, "");
  const token = process.env.ANALYTICS_GATEWAY_TOKEN;

  if (!baseUrl) throw new Error("ANALYTICS_GATEWAY_URL is not configured");
  if (!token) throw new Error("ANALYTICS_GATEWAY_TOKEN is not configured");
  return { baseUrl, token };
}

async function gatewayFetch<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const { baseUrl, token } = getGatewayConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Analytics gateway request failed (${response.status} ${response.statusText})${body ? `: ${body.slice(0, 500)}` : ""}`,
      );
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAnalyticsSnapshot(
  projectId: string,
  site: string,
  window = "7d",
): Promise<AnalyticsSnapshot> {
  return gatewayFetch<AnalyticsSnapshot>(
    `/v1/sites/${encodeURIComponent(site)}/snapshot?window=${encodeURIComponent(window)}`,
    { headers: { "X-Ms-Robot-Project-Id": projectId } },
  );
}

export async function getProviderStates(projectId: string): Promise<ProviderListResponse> {
  return gatewayFetch<ProviderListResponse>("/v1/providers", {
    headers: { "X-Ms-Robot-Project-Id": projectId },
  });
}

export async function getProviderSyncRuns(
  projectId: string,
  limit = 50,
): Promise<ProviderSyncRunsResponse> {
  const bounded = Math.max(1, Math.min(200, Math.trunc(limit)));
  return gatewayFetch<ProviderSyncRunsResponse>(`/v1/sync-runs?limit=${bounded}`, {
    headers: { "X-Ms-Robot-Project-Id": projectId },
  });
}

export async function requestProviderRefresh(
  projectId: string,
  site: string,
  sources: ProviderKey[],
  window = "default",
): Promise<ProviderRefreshResult> {
  return gatewayFetch<ProviderRefreshResult>(
    `/v1/sites/${encodeURIComponent(site)}/refresh`,
    {
      method: "POST",
      headers: { "X-Ms-Robot-Project-Id": projectId },
      body: JSON.stringify({ sources, window }),
    },
  );
}

export async function requestAnalyticsRefresh(
  projectId: string,
  site: string,
  sources: AnalyticsSource[] = ["gsc", "ga4", "clarity"],
): Promise<AnalyticsRefreshResult> {
  const result = await requestProviderRefresh(projectId, site, sources);
  return {
    site: result.site,
    accepted: result.accepted.filter(
      (source): source is AnalyticsSource =>
        source === "gsc" || source === "ga4" || source === "clarity",
    ),
    queuedAt: result.queuedAt,
  };
}
