const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

export function providerConfig(env = process.env) {
  const rawUrl = String(env.GOOGLE_PROVIDER_URL || "http://127.0.0.1:9131").trim();
  const token = String(env.GOOGLE_PROVIDER_TOKEN || "").trim();
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol) || !LOOPBACK.has(url.hostname)) {
    throw new Error("google_provider_url_must_be_loopback");
  }
  if (!token) throw new Error("google_provider_token_missing");
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return { baseUrl: url.toString().replace(/\/$/, ""), token };
}

export async function providerRequest(path, options = {}, env = process.env, fetchImpl = fetch) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    throw new Error("invalid_provider_path");
  }
  const { baseUrl, token } = providerConfig(env);
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
  };
  let response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    throw new Error("google_provider_unreachable");
  }
  if (!response.ok) throw new Error(`google_provider_http_${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error("google_provider_invalid_json");
  }
}

function n(value, digits = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? digits ? value.toFixed(digits) : String(value)
    : "—";
}

export function formatSites(payload) {
  const sites = Array.isArray(payload?.sites) ? payload.sites : [];
  if (!sites.length) return "No sites found.";
  return "Sites:\n" + sites.map((site) => `${String(site.siteUrl || "")} (${String(site.permissionLevel || "")})`).join("\n");
}

export function formatSearchAnalytics(payload) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const dimensions = Array.isArray(payload?.dimensions) ? payload.dimensions.map(String) : [];
  if (!rows.length) return "No data found for the given parameters.";
  const header = [...dimensions, "clicks", "impressions", "ctr", "position"].join(" | ");
  const separator = header.split("|").map(() => "---").join(" | ");
  const body = rows.map((row) => {
    const keys = Array.isArray(row.keys) ? row.keys.map(String).join(" | ") : "";
    const ctr = typeof row.ctr === "number" && Number.isFinite(row.ctr) ? `${(row.ctr * 100).toFixed(2)}%` : "—";
    return `${keys} | ${n(row.clicks)} | ${n(row.impressions)} | ${ctr} | ${n(row.position, 1)}`;
  });
  return `Search Analytics (${String(payload.startDate || "")} to ${String(payload.endDate || "")})\n${rows.length} rows returned\n\n${[header, separator, ...body].join("\n")}`;
}

export function formatInspection(payload) {
  const result = payload?.inspectionResult;
  if (!result) return "No inspection result returned.";
  const lines = [`URL Inspection: ${String(payload.inspectionUrl || "")}`, ""];
  const indexStatus = result.indexStatusResult;
  if (indexStatus) {
    lines.push("## Indexing");
    lines.push(`Coverage state: ${indexStatus.coverageState || "Unknown"}`);
    lines.push(`Indexing state: ${indexStatus.indexingState || "Unknown"}`);
    if (indexStatus.userCanonical) lines.push(`User canonical: ${indexStatus.userCanonical}`);
    if (indexStatus.googleCanonical) lines.push(`Google canonical: ${indexStatus.googleCanonical}`);
    if (Array.isArray(indexStatus.referringUrls) && indexStatus.referringUrls.length) lines.push(`Referring URLs: ${indexStatus.referringUrls.join(", ")}`);
    if (indexStatus.lastCrawlTime) lines.push(`Last crawled: ${indexStatus.lastCrawlTime}`);
    if (indexStatus.crawledAs) lines.push(`Crawled as: ${indexStatus.crawledAs}`);
    if (indexStatus.robotsTxtState) lines.push(`robots.txt: ${indexStatus.robotsTxtState}`);
    if (indexStatus.pageFetchState) lines.push(`Page fetch: ${indexStatus.pageFetchState}`);
    if (indexStatus.verdict) lines.push(`Verdict: ${indexStatus.verdict}`);
  }
  const mobile = result.mobileUsabilityResult;
  if (mobile) {
    lines.push("", "## Mobile Usability", `Verdict: ${mobile.verdict || "Unknown"}`);
    if (Array.isArray(mobile.issues) && mobile.issues.length) {
      lines.push("Issues:");
      for (const issue of mobile.issues) lines.push(`  - ${issue.issueType || "Unknown"}: ${issue.message || ""}`);
    }
  }
  return lines.join("\n");
}

export function formatSitemaps(payload) {
  const sitemaps = Array.isArray(payload?.sitemaps) ? payload.sitemaps : [];
  const siteUrl = String(payload?.siteUrl || "");
  if (!sitemaps.length) return `No sitemaps found for ${siteUrl}.`;
  const lines = sitemaps.map((item) => {
    const pending = item.isPending ? " (pending)" : "";
    return `${item.path || ""} | ${item.lastSubmitted || "never"} | errors: ${Number(item.errors || 0)} | warnings: ${Number(item.warnings || 0)}${pending}`;
  });
  return `Sitemaps for ${siteUrl}:\n\n${lines.join("\n")}`;
}
