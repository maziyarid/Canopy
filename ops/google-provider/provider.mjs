#!/usr/bin/env node
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { setDefaultResultOrder } from "node:dns";

setDefaultResultOrder("ipv4first");

const require = createRequire("/srv/maziyar-gsc-mcp/app/package.json");
const { google } = require("googleapis");

const HOST = process.env.GOOGLE_PROVIDER_HOST || "127.0.0.1";
const PORT = Number(process.env.GOOGLE_PROVIDER_PORT || 9131);
const TOKEN = process.env.GOOGLE_PROVIDER_TOKEN || "";
const CREDS = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
const MAX_BODY = 1_000_000;
const ALLOWED_DIMENSIONS = new Set([
  "date", "query", "page", "country", "device", "searchAppearance",
]);
const ALLOWED_TYPES = new Set(["web", "image", "video", "news", "discover", "googleNews"]);
const GA4_REPORTS = Object.freeze({
  summary: {
    dimensions: [],
    metrics: ["activeUsers", "newUsers", "sessions", "engagedSessions", "engagementRate", "averageSessionDuration", "eventCount", "keyEvents"],
    limit: 1,
  },
  daily: {
    dimensions: ["date"],
    metrics: ["activeUsers", "newUsers", "sessions", "engagedSessions", "engagementRate", "averageSessionDuration", "eventCount", "keyEvents"],
    limit: 10000,
  },
  acquisition: {
    dimensions: ["sessionDefaultChannelGroup"],
    metrics: ["sessions", "activeUsers", "engagedSessions", "engagementRate", "keyEvents"],
    limit: 1000,
  },
  landing_pages: {
    dimensions: ["landingPage"],
    metrics: ["sessions", "activeUsers", "engagedSessions", "keyEvents"],
    limit: 1000,
  },
});

if (!TOKEN) throw new Error("GOOGLE_PROVIDER_TOKEN is required");
if (!CREDS) throw new Error("GOOGLE_APPLICATION_CREDENTIALS is required");

const credentials = JSON.parse(readFileSync(CREDS, "utf8"));
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/tagmanager.readonly",
  ],
});
const searchconsole = google.searchconsole({ version: "v1", auth });
const analyticsadmin = google.analyticsadmin({ version: "v1beta", auth });
const tagmanager = google.tagmanager({ version: "v2", auth });

function now() {
  return new Date().toISOString();
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

function authorised(req) {
  const provided = req.headers.authorization || "";
  const expected = `Bearer ${TOKEN}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function bodyJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateSiteUrl(value) {
  const siteUrl = String(value || "").trim();
  if (!siteUrl || !(siteUrl.startsWith("sc-domain:") || /^https?:\/\//i.test(siteUrl))) {
    throw new Error("invalid_site_url");
  }
  return siteUrl;
}

function validateDate(value, field) {
  const date = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`invalid_${field}`);
  return date;
}

function validateDimensions(value) {
  const dimensions = Array.isArray(value) && value.length ? value.map(String) : ["date"];
  if (dimensions.some((d) => !ALLOWED_DIMENSIONS.has(d))) throw new Error("invalid_dimensions");
  return dimensions;
}

function normaliseSearchRows(rows = []) {
  return rows.map((row) => ({
    keys: Array.isArray(row.keys) ? row.keys.map(String) : [],
    clicks: typeof row.clicks === "number" && Number.isFinite(row.clicks) && row.clicks >= 0 ? row.clicks : null,
    impressions: typeof row.impressions === "number" && Number.isFinite(row.impressions) && row.impressions >= 0 ? row.impressions : null,
    ctr: typeof row.ctr === "number" && Number.isFinite(row.ctr) && row.ctr >= 0 ? row.ctr : null,
    position: typeof row.position === "number" && Number.isFinite(row.position) && row.position >= 0 ? row.position : null,
  }));
}

async function listSites() {
  const response = await searchconsole.sites.list();
  return (response.data.siteEntry || []).map((site) => ({
    siteUrl: String(site.siteUrl || ""),
    permissionLevel: String(site.permissionLevel || ""),
  }));
}

async function searchAnalytics(input) {
  const siteUrl = validateSiteUrl(input.siteUrl);
  const startDate = validateDate(input.startDate, "start_date");
  const endDate = validateDate(input.endDate, "end_date");
  const dimensions = validateDimensions(input.dimensions);
  const rowLimit = Math.max(1, Math.min(25_000, Number(input.rowLimit || 1000)));
  const type = ALLOWED_TYPES.has(input.type) ? input.type : "web";
  const requestBody = { startDate, endDate, dimensions, rowLimit, type, dataState: "all" };
  const response = await searchconsole.searchanalytics.query({ siteUrl, requestBody });
  return {
    siteUrl,
    startDate,
    endDate,
    dimensions,
    rows: normaliseSearchRows(response.data.rows || []),
    responseAggregationType: response.data.responseAggregationType || null,
    fetchedAt: now(),
  };
}

async function listSitemaps(siteUrl) {
  const valid = validateSiteUrl(siteUrl);
  const response = await searchconsole.sitemaps.list({ siteUrl: valid });
  return {
    siteUrl: valid,
    sitemaps: (response.data.sitemap || []).map((item) => ({
      path: item.path || "",
      lastSubmitted: item.lastSubmitted || null,
      isPending: Boolean(item.isPending),
      isSitemapsIndex: Boolean(item.isSitemapsIndex),
      type: item.type || null,
      lastDownloaded: item.lastDownloaded || null,
      warnings: Number(item.warnings || 0),
      errors: Number(item.errors || 0),
      contents: item.contents || [],
    })),
    fetchedAt: now(),
  };
}

async function listGa4AccountSummaries() {
  const response = await analyticsadmin.accountSummaries.list({ pageSize: 200 });
  return {
    accounts: (response.data.accountSummaries || []).map((account) => ({
      account: String(account.account || ""),
      displayName: String(account.displayName || ""),
      properties: (account.propertySummaries || []).map((property) => ({
        property: String(property.property || ""),
        displayName: String(property.displayName || ""),
        propertyType: String(property.propertyType || ""),
      })),
    })),
    fetchedAt: now(),
  };
}

function validateGa4Property(value) {
  const raw = String(value || "").trim();
  const property = raw.startsWith("properties/") ? raw : `properties/${raw}`;
  if (!/^properties\/[1-9]\d*$/.test(property)) throw new Error("invalid_ga4_property");
  return property;
}

function safeGa4Dimension(name, value) {
  const raw = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (name === "date") {
    if (!/^\d{8}$/.test(raw)) throw new Error("invalid_ga4_date");
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (name === "landingPage") {
    const path = raw.split(/[?#]/, 1)[0].slice(0, 500);
    return path
      .split("/")
      .map((segment) =>
        /^\d{6,}$/.test(segment) ||
        /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) ||
        /^[A-Za-z0-9_-]{24,}$/.test(segment)
          ? ":redacted"
          : segment,
      )
      .join("/");
  }
  return raw.slice(0, 200);
}

function safeGa4Metric(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

async function runGa4Report(input) {
  const property = validateGa4Property(input.property);
  const startDate = validateDate(input.startDate, "start_date");
  const endDate = validateDate(input.endDate, "end_date");
  if (startDate > endDate) throw new Error("invalid_date_range");
  const report = String(input.report || "summary");
  const spec = GA4_REPORTS[report];
  if (!spec) throw new Error("invalid_ga4_report");

  const client = await auth.getClient();
  const requestBody = {
    dateRanges: [{ startDate, endDate }],
    dimensions: spec.dimensions.map((name) => ({ name })),
    metrics: spec.metrics.map((name) => ({ name })),
    limit: spec.limit,
    keepEmptyRows: false,
    returnPropertyQuota: true,
  };
  const response = await client.request({
    url: `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`,
    method: "POST",
    data: requestBody,
  });
  const data = response.data || {};
  const dimensionNames = (data.dimensionHeaders || []).map((item) => String(item.name || ""));
  const metricNames = (data.metricHeaders || []).map((item) => String(item.name || ""));
  const rows = (data.rows || []).map((row) => {
    const dimensions = {};
    const metrics = {};
    dimensionNames.forEach((name, index) => {
      dimensions[name] = safeGa4Dimension(name, row.dimensionValues?.[index]?.value);
    });
    metricNames.forEach((name, index) => {
      metrics[name] = safeGa4Metric(row.metricValues?.[index]?.value);
    });
    return { dimensions, metrics };
  });
  return {
    property,
    report,
    startDate,
    endDate,
    rows,
    rowCount: Number(data.rowCount || rows.length),
    metadata: {
      currencyCode: data.metadata?.currencyCode || null,
      timeZone: data.metadata?.timeZone || null,
      dataLossFromOtherRow: Boolean(data.metadata?.dataLossFromOtherRow),
    },
    propertyQuota: data.propertyQuota || null,
    fetchedAt: now(),
  };
}

async function listGtmAccounts() {
  const response = await tagmanager.accounts.list();
  return {
    accounts: (response.data.account || []).map((account) => ({
      accountId: String(account.accountId || ""),
      name: String(account.name || ""),
      path: String(account.path || ""),
    })),
    fetchedAt: now(),
  };
}

async function inspectUrl(input) {
  const siteUrl = validateSiteUrl(input.siteUrl);
  const inspectionUrl = String(input.inspectionUrl || "").trim();
  if (!/^https?:\/\//i.test(inspectionUrl)) throw new Error("invalid_inspection_url");
  const response = await searchconsole.urlInspection.index.inspect({
    requestBody: {
      siteUrl,
      inspectionUrl,
      languageCode: String(input.languageCode || "en-US"),
    },
  });
  return {
    siteUrl,
    inspectionUrl,
    inspectionResult: response.data.inspectionResult || null,
    fetchedAt: now(),
  };
}

function safeError(error) {
  const status = Number(error?.code || error?.response?.status || 500);
  const message = String(error?.message || "provider_error").slice(0, 500);
  return { status: status >= 400 && status <= 599 ? status : 500, message };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    if (req.method === "GET" && url.pathname === "/health") {
      send(res, 200, { ok: true, service: "ms-robot-google-provider", time: now() });
      return;
    }
    if (!authorised(req)) {
      send(res, 401, { error: "unauthorised" });
      return;
    }
    if (req.method === "GET" && url.pathname === "/v1/sites") {
      send(res, 200, { sites: await listSites(), fetchedAt: now() });
      return;
    }
    if (req.method === "GET" && url.pathname === "/v1/ga4/accounts") {
      send(res, 200, await listGa4AccountSummaries());
      return;
    }
    if (req.method === "POST" && url.pathname === "/v1/ga4/run-report") {
      send(res, 200, await runGa4Report(await bodyJson(req)));
      return;
    }
    if (req.method === "GET" && url.pathname === "/v1/gtm/accounts") {
      send(res, 200, await listGtmAccounts());
      return;
    }
    if (req.method === "POST" && url.pathname === "/v1/gsc/search-analytics") {
      send(res, 200, await searchAnalytics(await bodyJson(req)));
      return;
    }
    if (req.method === "GET" && url.pathname === "/v1/gsc/sitemaps") {
      send(res, 200, await listSitemaps(url.searchParams.get("siteUrl")));
      return;
    }
    if (req.method === "POST" && url.pathname === "/v1/gsc/inspect") {
      send(res, 200, await inspectUrl(await bodyJson(req)));
      return;
    }
    send(res, 404, { error: "not_found" });
  } catch (error) {
    const safe = safeError(error);
    send(res, safe.status, { error: safe.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ms-robot-google-provider listening on ${HOST}:${PORT}`);
});
