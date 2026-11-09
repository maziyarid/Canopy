const ALLOWED_DIMENSIONS = new Set([
  "date", "query", "page", "country", "device", "searchAppearance",
]);
const ALLOWED_TYPES = new Set(["web", "image", "video", "news", "discover", "googleNews"]);

export function validateSiteUrl(value) {
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
  if (dimensions.some((dimension) => !ALLOWED_DIMENSIONS.has(dimension))) {
    throw new Error("invalid_dimensions");
  }
  return dimensions;
}

function paginationInteger(value, fallback, minimum, maximum, field) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw Object.assign(new Error(`invalid_${field}`), { code: 400 });
  }
  return value;
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

// The caller supplies its authenticated read-only client; importing this module
// never reads credentials, loads googleapis or starts a server.
export async function querySearchAnalytics(searchconsole, input) {
  const siteUrl = validateSiteUrl(input.siteUrl);
  const startDate = validateDate(input.startDate, "start_date");
  const endDate = validateDate(input.endDate, "end_date");
  const dimensions = validateDimensions(input.dimensions);
  const rowLimit = paginationInteger(input.rowLimit, 1000, 1, 25_000, "row_limit");
  const startRow = paginationInteger(input.startRow, 0, 0, Number.MAX_SAFE_INTEGER, "start_row");
  const type = ALLOWED_TYPES.has(input.type) ? input.type : "web";
  const requestBody = { startDate, endDate, dimensions, rowLimit, startRow, type, dataState: "all" };
  const response = await searchconsole.searchanalytics.query({ siteUrl, requestBody });
  return {
    siteUrl,
    startDate,
    endDate,
    dimensions,
    rows: normaliseSearchRows(response.data.rows || []),
    responseAggregationType: response.data.responseAggregationType || null,
    fetchedAt: new Date().toISOString(),
  };
}
