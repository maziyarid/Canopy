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
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
