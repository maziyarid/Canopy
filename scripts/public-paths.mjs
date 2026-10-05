/**
 * Pure deployment-path contract. No environment reads, framework dependencies,
 * routing changes, origin allowlists or authentication/authorization decisions.
 */

const RAW_UNSAFE = /[\s\\]/u;

function containsControl(value) {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** Root by default; non-root bases have exactly one leading and no trailing slash. */
export function normalizeAppBase(value = "/") {
  if (typeof value !== "string") throw new TypeError("App base must be a path");
  if (value === "/") return "/";
  if (!/^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*\/?$/.test(value)) {
    throw new TypeError("App base must contain only unescaped path segments");
  }
  const base = value.endsWith("/") ? value.slice(0, -1) : value;
  if (base.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new TypeError("App base must not contain traversal segments");
  }
  return base;
}

/** Validate before URL parsing: URL would silently collapse dot segments. */
function splitTarget(value) {
  if (typeof value !== "string" || RAW_UNSAFE.test(value) || containsControl(value)) {
    throw new TypeError("App target must be a safe absolute path");
  }
  const suffixIndex = value.search(/[?#]/);
  const pathname = suffixIndex === -1 ? value : value.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : value.slice(suffixIndex);
  if (!pathname.startsWith("/") || pathname.includes("//")) {
    throw new TypeError("App target must have one leading slash and no empty segments");
  }
  // Deliberately narrow: ordinary route/asset names and escaped UTF-8 data.
  // Decode each segment once, rejecting percent itself to fail closed on nested
  // encodings that another router or proxy could otherwise decode a second time.
  for (const segment of pathname.split("/")) {
    if (!/^(?:[A-Za-z0-9._~-]|%[A-Fa-f0-9]{2})*$/.test(segment)) {
      throw new TypeError("App target contains an invalid path segment");
    }
    let decoded;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      throw new TypeError("App target contains invalid UTF-8 encoding");
    }
    if (
      decoded === "." ||
      decoded === ".." ||
      /[/%\\?#]/.test(decoded) ||
      containsControl(decoded)
    ) {
      throw new TypeError("App target contains an ambiguous or unsafe path segment");
    }
  }
  // Query/fragment separators are data, not routing. Validate their encoding and
  // reject control characters without decoding or rewriting the returned value.
  try {
    // Validate raw UTF-16 too; browsers silently replace lone surrogates.
    encodeURI(suffix);
    if (containsControl(decodeURIComponent(suffix))) {
      throw new TypeError("App target suffix contains control characters");
    }
  } catch {
    throw new TypeError("App target suffix contains invalid encoding or controls");
  }
  return { pathname, suffix };
}

/**
 * Mount a logical app-local route (e.g. /login) at base. Do not pass an already
 * mounted URL, a router Link destination, a public-site URL or an arbitrary URL.
 */
export function appPath(route = "/", base = "/") {
  const normalizedBase = normalizeAppBase(base);
  const { pathname, suffix } = splitTarget(route);
  return `${normalizedBase === "/" ? "" : normalizedBase}${pathname}${suffix}`;
}

/**
 * Validate an already mounted browser return target. Invalid/untrusted targets
 * return null; invalid deployment configuration throws. No implicit fallback.
 * The bare app mount is normalized to its slash-terminated directory URL.
 * This proves path containment only, not access rights or safe nested redirects.
 */
export function safeAppReturnPath(value, base = "/") {
  const normalizedBase = normalizeAppBase(base);
  let target;
  try {
    target = splitTarget(value);
  } catch {
    return null;
  }
  if (normalizedBase === "/") return value;
  if (target.pathname === normalizedBase) return `${normalizedBase}/${target.suffix}`;
  return target.pathname.startsWith(`${normalizedBase}/`) ? value : null;
}

/**
 * Exact canonical HTTPS origin, never an origin plus an app path. Local HTTP
 * requires explicit opt-in. Syntax validation does not grant origin trust.
 * This helper does not replace the existing launch exactOrigin/security guard.
 */
export function validatePublicOrigin(value, { allowLocalHttp = false } = {}) {
  if (typeof value !== "string") throw new TypeError("Public origin must be a string");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("Public origin must be an exact origin");
  }
  const localHttp =
    allowLocalHttp === true &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.origin !== value ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" && !localHttp)
  ) {
    throw new TypeError("Public origin must be a canonical HTTPS origin without a path");
  }
  return value;
}
