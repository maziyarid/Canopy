export function validateGa4Property(value) {
  const raw = String(value || "").trim();
  const property = raw.startsWith("properties/") ? raw : `properties/${raw}`;
  if (!/^properties\/[1-9]\d*$/.test(property)) throw new Error("invalid_ga4_property");
  return property;
}

function stripControlCharacters(value) {
  return [...String(value ?? "")]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .trim();
}

function decodeForDetection(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function identifierLike(segment) {
  const decoded = decodeForDetection(segment).trim();
  return (
    /@/.test(decoded) ||
    /(?:^|\D)\+?\d[\d(). -]{6,}(?:$|\D)/.test(decoded) ||
    /^\d{6,}$/.test(decoded) ||
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(decoded) ||
    /^[A-Za-z0-9_-]{24,}$/.test(decoded)
  );
}

export function safeGa4Dimension(name, value) {
  const raw = stripControlCharacters(value);
  if (name === "date") {
    if (!/^\d{8}$/.test(raw)) throw new Error("invalid_ga4_date");
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (name === "landingPage") {
    const path = raw.split(/[?#]/, 1)[0].slice(0, 500);
    return path
      .split("/")
      .map((segment) => (identifierLike(segment) ? ":redacted" : segment))
      .join("/");
  }
  return raw.slice(0, 200);
}

export function safeGa4Metric(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

// Keep report normalization pure so provider quality can be tested without
// credentials, a Google client, or a running HTTP service.
export function normalizeGa4Report(data, spec) {
  const rawRows = data.rows || [];
  const dimensionNames = (data.dimensionHeaders || []).map((item) => item.name);
  const metricNames = (data.metricHeaders || []).map((item) => item.name);
  const reasons = new Set();
  const candidates = [];
  let omittedRows = 0;

  for (const row of rawRows) {
    const dimensions = {};
    const metrics = {};
    // Only configured fields can cross the provider boundary. Do not echo
    // arbitrary headers or diagnostics containing a raw dimension value.
    for (const name of spec.metrics) {
      metrics[name] = safeGa4Metric(row?.metricValues?.[metricNames.indexOf(name)]?.value);
      if (metrics[name] === null) reasons.add("invalid_metrics");
    }
    try {
      for (const name of spec.dimensions) {
        const value = row?.dimensionValues?.[dimensionNames.indexOf(name)]?.value;
        if (typeof value !== "string" || !value.trim()) throw new Error("invalid_ga4_dimension");
        dimensions[name] = safeGa4Dimension(name, value);
      }
    } catch {
      omittedRows += 1;
      reasons.add("invalid_dimensions");
      continue;
    }
    candidates.push({ dimensions, metrics });
  }

  const landingCounts = new Map();
  if (spec.dimensions.includes("landingPage")) {
    for (const row of candidates) {
      const key = row.dimensions.landingPage;
      landingCounts.set(key, (landingCounts.get(key) || 0) + 1);
    }
  }
  const rows = candidates.filter((row) => {
    if ((landingCounts.get(row.dimensions.landingPage) || 0) <= 1) return true;
    // Unique users are not additive. Neither summing nor picking one member
    // of a sanitized collision group is an honest measurement.
    omittedRows += 1;
    reasons.add("landing_page_collisions");
    return false;
  });

  const reportedCount = safeGa4Metric(data.rowCount);
  const validCount = Number.isSafeInteger(reportedCount) && reportedCount >= rawRows.length;
  const rowCount = validCount ? reportedCount : rawRows.length;
  if (!validCount) reasons.add("invalid_row_count");
  const metadata = data.metadata || {};
  const providerTruncated = Array.isArray(metadata.dataTruncationReasons) && metadata.dataTruncationReasons.length > 0;
  const truncated = rowCount > rawRows.length || providerTruncated;
  if (rowCount > rawRows.length) reasons.add("row_limit");
  if (metadata.dataLossFromOtherRow === true) reasons.add("data_loss_from_other_row");
  if (metadata.subjectToThresholding === true) reasons.add("thresholding");
  if (Array.isArray(metadata.samplingMetadatas) && metadata.samplingMetadatas.length > 0) reasons.add("sampling");
  if (providerTruncated) reasons.add("provider_truncation");

  return {
    rows,
    rowCount,
    coverage: {
      complete: reasons.size === 0,
      // This is the known count dropped locally, not an estimate of upstream
      // rows hidden by thresholds, sampling, or a result limit.
      omittedRows,
      truncated,
      reasons: [...reasons],
    },
  };
}
