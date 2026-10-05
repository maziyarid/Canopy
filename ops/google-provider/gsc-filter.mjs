const DIMENSIONS = new Set(["date", "query", "page", "country", "device", "searchAppearance"]);
const TYPES = new Set(["web", "image", "video", "news", "discover", "googleNews"]);
const DEVICES = new Set(["DESKTOP", "MOBILE", "TABLET"]);

function boundedText(value, field, max = 1000) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) throw new Error(`invalid_${field}`);
  return text;
}

export function validateGscDate(value, field) {
  const date = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error(`invalid_${field}`);
  }
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error(`invalid_${field}`);
  return date;
}

export function validateGscDimensions(value) {
  const dimensions = Array.isArray(value) && value.length ? value.map(String) : ["date"];
  if (dimensions.length > 6 || dimensions.some((dimension) => !DIMENSIONS.has(dimension))) {
    throw new Error("invalid_dimensions");
  }
  return dimensions;
}

function filter(dimension, raw) {
  const text = boundedText(raw, `${dimension}_filter`);
  if (!text) return null;
  const isRegex = text.startsWith("regex:");
  const expression = isRegex ? text.slice(6) : text;
  if (!expression) throw new Error(`invalid_${dimension}_filter`);
  return {
    dimension,
    operator: isRegex ? "includingRegex" : "contains",
    expression,
  };
}

export function buildGscSearchRequest(input = {}) {
  const startDate = validateGscDate(input.startDate, "start_date");
  const endDate = validateGscDate(input.endDate, "end_date");
  if (startDate > endDate) throw new Error("invalid_date_range");

  const dimensions = validateGscDimensions(input.dimensions);
  const rawLimit = Number(input.rowLimit ?? 1000);
  const rowLimit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(25_000, Math.trunc(rawLimit))) : 1000;
  const type = TYPES.has(input.type) ? input.type : "web";

  const filters = [];
  const query = filter("query", input.queryFilter);
  if (query) filters.push(query);
  const page = filter("page", input.pageFilter);
  if (page) filters.push(page);

  const country = boundedText(input.countryFilter, "country_filter", 3);
  if (country) {
    if (!/^[A-Za-z]{3}$/.test(country)) throw new Error("invalid_country_filter");
    filters.push({ dimension: "country", operator: "equals", expression: country });
  }

  const device = boundedText(input.deviceFilter, "device_filter", 16);
  if (device) {
    if (!DEVICES.has(device)) throw new Error("invalid_device_filter");
    filters.push({ dimension: "device", operator: "equals", expression: device });
  }

  const requestBody = { startDate, endDate, dimensions, rowLimit, type, dataState: "all" };
  if (filters.length) requestBody.dimensionFilterGroups = [{ filters }];
  return { startDate, endDate, dimensions, rowLimit, type, requestBody };
}
