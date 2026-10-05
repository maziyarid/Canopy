import assert from "node:assert/strict";
import test from "node:test";
import {
  appPath,
  normalizeAppBase,
  safeAppReturnPath,
  validatePublicOrigin,
} from "./public-paths.mjs";

const BASE = "/msrobot/app";

// These expectations are the external URL contract, not another path builder.
test("root deployment remains the default", () => {
  assert.equal(normalizeAppBase(), "/");
  assert.equal(appPath(), "/");
  assert.equal(appPath("/login"), "/login");
  assert.equal(safeAppReturnPath("/p/123?tab=seo#report"), "/p/123?tab=seo#report");
});

test("normalize one optional trailing slash without repairing malformed bases", () => {
  assert.equal(normalizeAppBase(BASE), BASE);
  assert.equal(normalizeAppBase(`${BASE}/`), BASE);
  assert.equal(normalizeAppBase("/"), "/");
  assert.equal(normalizeAppBase("/products/ms-robot_v2.1"), "/products/ms-robot_v2.1");
});

for (const value of [
  "",
  null,
  false,
  3,
  {},
  "msrobot/app",
  "//msrobot/app",
  "/msrobot//app",
  `${BASE}//`,
  `${BASE}?x=1`,
  `${BASE}#section`,
  "https://maziyarid.com/msrobot/app",
  "/msrobot/./app",
  "/msrobot/../app",
  "/msrobot/%2e%2e/app",
  "/msrobot%2fapp",
  "/msrobot/%252e%252e/app",
  "/msrobot\\app",
  "/msrobot/%5c/app",
  `${BASE} `,
  ` ${BASE}`,
  `${BASE}\n`,
  "/ربات/app",
  "/msrobot/app;other",
]) {
  test(`reject configured base ${JSON.stringify(value)}`, () => {
    assert.throws(() => normalizeAppBase(value), TypeError);
  });
}

for (const [route, expected] of [
  ["/", "/msrobot/app/"],
  ["/login", "/msrobot/app/login"],
  ["/p/project-123", "/msrobot/app/p/project-123"],
  ["/api/auth/get-session", "/msrobot/app/api/auth/get-session"],
  ["/api/auth/sign-out", "/msrobot/app/api/auth/sign-out"],
  ["/api/v1/reporting/snapshot", "/msrobot/app/api/v1/reporting/snapshot"],
  ["/api/google/oauth/callback", "/msrobot/app/api/google/oauth/callback"],
  ["/launch/accept", "/msrobot/app/launch/accept"],
  ["/assets/app-123.js", "/msrobot/app/assets/app-123.js"],
  ["/manifest.webmanifest", "/msrobot/app/manifest.webmanifest"],
  ["/__grok/icon-192.png", "/msrobot/app/__grok/icon-192.png"],
]) {
  test(`mount logical route ${route} below the app base`, () => {
    assert.equal(appPath(route, BASE), expected);
    assert.equal(appPath(route, `${BASE}/`), expected);
    assert.equal(appPath(route, "/"), route);
  });
}

test("keep query and fragment opaque and byte-for-byte intact", () => {
  const route = "/p/123?next=%2Flogin&url=https%3A%2F%2Fexample.com%2Fa#details?view=seo";
  assert.equal(appPath(route, BASE), `${BASE}${route}`);
  assert.equal(safeAppReturnPath(`${BASE}${route}`, BASE), `${BASE}${route}`);
  assert.equal(appPath("/?q=hello%20world#", BASE), `${BASE}/?q=hello%20world#`);
  assert.equal(safeAppReturnPath(`${BASE}?q=1#`, BASE), `${BASE}/?q=1#`);
  assert.equal(
    appPath("/p/123?next=//example.com/a#https://example.com/b", BASE),
    `${BASE}/p/123?next=//example.com/a#https://example.com/b`,
  );
});

test("permit valid escaped Unicode and unreserved path segments", () => {
  const route = "/p/%D8%B1%D8%A8%D8%A7%D8%AA/report%20one";
  assert.equal(appPath(route, BASE), `${BASE}${route}`);
  assert.equal(safeAppReturnPath(`${BASE}${route}`, BASE), `${BASE}${route}`);
  assert.equal(appPath("/p/v1.2/~owner_name-1", BASE), `${BASE}/p/v1.2/~owner_name-1`);
});

const unsafeRoutes = [
  "",
  null,
  undefined,
  1,
  {},
  "login",
  "?next=/login",
  "#section",
  "https://evil.example/p",
  "http://maziyarid.com/p",
  "javascript:alert(1)",
  "//evil.example/p",
  "///evil.example/p",
  "/p//123",
  "/p/./123",
  "/p/../login",
  "/p/%2e%2e/login",
  "/p/.%2E/login",
  "/p/%2E./login",
  "/p/%2e/login",
  "/p/%252e%252e/login",
  "/p/%25252e%25252e/login",
  "/%2f%2fevil.example",
  "/p%2F123",
  "/p%5c123",
  "/p%252f123",
  "/p%255c123",
  "/p\\123",
  "/p/%3fnext",
  "/p/%23fragment",
  "/p/%25literal",
  "/p/%00",
  "/p/%0D%0Aheader",
  "/p/%7f",
  "/p/%",
  "/p/%GG",
  "/p/%c0%af",
  "/p/%ed%a0%80",
  "/p/hello world",
  "/p/ربات",
  " /login",
  "/login\n",
  "/p/\t123",
  "/p/123\\?a=1",
  "/login?x=%0d%0aheader",
  "/login#%00",
  "/login?x=%",
  "/login?x=%GG",
];
for (const route of unsafeRoutes) {
  test(`reject unsafe logical/return path ${JSON.stringify(route)}`, () => {
    // undefined is the path builder's documented default, not a valid return target.
    if (route !== undefined) assert.throws(() => appPath(route, BASE), TypeError);
    assert.equal(safeAppReturnPath(route), null);
    assert.equal(safeAppReturnPath(route, BASE), null);
    if (typeof route === "string" && route.startsWith("/")) {
      assert.equal(safeAppReturnPath(`${BASE}${route}`, BASE), null);
    }
  });
}

test("same-app return targets must already carry the exact base boundary", () => {
  for (const value of [
    "/",
    "/login",
    "/msrobot",
    "/msrobot/application",
    `${BASE}2/p/123`,
    `${BASE}-other/p/123`,
    "/MSROBOT/app/p/123",
    "/msrobot/%61pp/p/123",
    `https://maziyarid.com${BASE}/p/123`,
  ]) {
    assert.equal(safeAppReturnPath(value, BASE), null, value);
  }
  assert.equal(safeAppReturnPath(BASE, BASE), `${BASE}/`);
  assert.equal(safeAppReturnPath(`${BASE}/`, BASE), `${BASE}/`);
  assert.equal(safeAppReturnPath(`${BASE}/p/123`, BASE), `${BASE}/p/123`);
});

test("invalid configuration throws even when the return target is invalid", () => {
  assert.throws(() => appPath("/login", "//evil.example"), TypeError);
  assert.throws(() => safeAppReturnPath(null, "//evil.example"), TypeError);
});

test("accept exact HTTPS origins without combining the origin and app base", () => {
  assert.equal(validatePublicOrigin("https://maziyarid.com"), "https://maziyarid.com");
  assert.equal(validatePublicOrigin("https://app.maziyarid.com"), "https://app.maziyarid.com");
  assert.equal(validatePublicOrigin("https://example.com:8443"), "https://example.com:8443");
});

for (const origin of [
  undefined,
  null,
  123,
  {},
  "",
  "maziyarid.com",
  "//maziyarid.com",
  "http://maziyarid.com",
  "https://maziyarid.com/",
  "https://maziyarid.com/msrobot/app",
  "https://maziyarid.com?",
  "https://maziyarid.com#",
  "https://user:pass@maziyarid.com",
  "https://maziyarid.com:443",
  "https://MAZIYARID.com",
  " https://maziyarid.com",
  "https://maziyarid.com\n",
  "https:\\maziyarid.com",
  "file:///msrobot/app",
  "data:text/plain,hello",
  "null",
]) {
  test(`reject non-origin or noncanonical origin ${JSON.stringify(origin)}`, () => {
    assert.throws(() => validatePublicOrigin(origin), TypeError);
  });
}

test("HTTP is restricted to an explicit local-development opt-in", () => {
  for (const origin of ["http://localhost:8080", "http://127.0.0.1:8080", "http://[::1]:8080"]) {
    assert.throws(() => validatePublicOrigin(origin), TypeError);
    assert.equal(validatePublicOrigin(origin, { allowLocalHttp: true }), origin);
  }
  for (const origin of [
    "http://maziyarid.com",
    "http://localhost.evil.test:8080",
    "http://0.0.0.0:8080",
  ]) {
    assert.throws(() => validatePublicOrigin(origin, { allowLocalHttp: true }), TypeError);
  }
  assert.throws(
    () => validatePublicOrigin("http://localhost:8080", { allowLocalHttp: "true" }),
    TypeError,
  );
});

test("accepted return paths stay on the fixed origin and inside the base in URL parsing", () => {
  const origin = "https://maziyarid.com";
  for (const base of ["/", BASE]) {
    for (const route of ["/", "/login", "/p/123", "/p/%D8%B1", "/p/v1.2?x=%2F..#f"]) {
      const result = safeAppReturnPath(appPath(route, base), base);
      assert.notEqual(result, null);
      const parsed = new URL(result, origin);
      assert.equal(parsed.origin, origin);
      assert.equal(`${parsed.pathname}${parsed.search}${parsed.hash}`, result);
      assert.ok(base === "/" || parsed.pathname.startsWith(`${base}/`));
    }
  }
});

test("reject malformed raw UTF-16 in query or fragment", () => {
  for (const suffix of ["?q=\ud800", "#\udfff", "?q=\ud800x", "#x\udfff"]) {
    assert.throws(() => appPath(`/login${suffix}`, BASE), TypeError);
    assert.equal(safeAppReturnPath(`${BASE}/login${suffix}`, BASE), null);
  }
});

test("opaque Unicode suffixes are preserved, not browser-canonicalized", () => {
  const target = `${BASE}/login?q=ربات#صفحه`;
  assert.equal(safeAppReturnPath(target, BASE), target);
  assert.notEqual(new URL(target, "https://maziyarid.com").search, "?q=ربات");
});
