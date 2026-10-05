import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import {
  createHeadInjector,
  injectGrokPwaHead,
  isDocumentPath,
  renderInstallPageHtml,
  renderWebManifest,
} from "./grok-pwa-shared.mjs";
import { grokPwaPlugin, renderInstallPage } from "./grok-pwa-plugin.mjs";

const BASE = "/msrobot/app";
const EMPTY_ROOT = mkdtempSync(join(tmpdir(), "grok-pwa-subfolder-"));
const TEMPLATE = readFileSync(new URL("./install-page.html", import.meta.url), "utf8");
const DOCUMENT = "<html><head><title>MS Robot</title></head><body>Demo</body></html>";

test("mounted manifest confines app identity, launch, scope and icons", () => {
  const manifest = JSON.parse(renderWebManifest("maziyarid.com", { appBase: `${BASE}/` }));
  assert.equal(manifest.name, "MS Robot");
  assert.equal(manifest.id, `${BASE}/`);
  assert.equal(manifest.start_url, `${BASE}/`);
  assert.equal(manifest.scope, `${BASE}/`);
  assert.equal(manifest.icons[0].src, `${BASE}/__grok/icon-180.png`);
});

test("default manifest keeps the original root contract", () => {
  const manifest = JSON.parse(renderWebManifest("maziyarid.com"));
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.icons[0].src, "/__grok/icon-180.png");
});

test("install tutorial mounts every local asset and its app link", () => {
  const html = renderInstallPage(
    "wild-race.grok.me",
    `${BASE}/p/123?install=1&platform=ios&tab=2`,
    { appBase: BASE },
  );
  const localUrls = [...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((match) => match[1]);
  assert.ok(localUrls.length >= 10);
  assert.ok(
    localUrls.every((url) => url.startsWith(`${BASE}/`)),
    localUrls.join("\n"),
  );
  assert.match(html, /href="\/msrobot\/app\/p\/123\?tab=2"/);
  assert.match(html, /Powered by Grok/);
  assert.doesNotMatch(html, /\{\{/);
});

test("install tutorial return targets cannot leave the app mount", () => {
  for (const url of [
    undefined,
    "/",
    "/msrobot/application",
    "//evil.example",
    `${BASE}/../outside`,
    `${BASE}/%2e%2e/outside`,
  ]) {
    const html = renderInstallPageHtml(TEMPLATE, { appBase: BASE, url });
    assert.match(html, /class="desktop-open" href="\/msrobot\/app\/"/, String(url));
  }
});

test("PWA and local share-card images use the mounted base without changing chrome", () => {
  const context = {
    appBase: BASE,
    host: "maziyarid.com",
    cwd: EMPTY_ROOT,
    site: { title: "MS Robot", image: "/og.jpg", banner: "/x-banner.jpg" },
  };
  const html = injectGrokPwaHead(DOCUMENT, context);
  assert.match(html, /href="\/msrobot\/app\/__grok\/manifest.webmanifest"/);
  assert.match(html, /href="\/msrobot\/app\/__grok\/icon-180.png"/);
  assert.match(html, /content="https:\/\/maziyarid.com\/msrobot\/app\/og.jpg"/);
  assert.match(html, /content="https:\/\/maziyarid.com\/msrobot\/app\/x-banner.jpg"/);
  assert.match(html, /src="https:\/\/grok.com\/grok-app-builder\/extensions.js"/);
  assert.equal(injectGrokPwaHead(html, context), html);
});

test("streaming head injection preserves its mounted context", () => {
  const injector = createHeadInjector({ appBase: BASE, cwd: EMPTY_ROOT });
  const chunks = [
    ...injector.push("<html><head></he"),
    ...injector.push("ad><body>Demo</body></html>"),
    ...injector.flush(),
  ];
  const html = Buffer.concat(chunks).toString("utf8");
  assert.match(html, /href="\/msrobot\/app\/__grok\/manifest.webmanifest"/);
  assert.match(html, /<body>Demo<\/body>/);
});

test("document filtering accepts only documents within the exact mount", () => {
  for (const path of [BASE, `${BASE}/`, `${BASE}/p/project-123`, `${BASE}/login`]) {
    assert.equal(isDocumentPath(path, { appBase: BASE }), true, path);
  }
  for (const path of [
    "/",
    "/p/123",
    "/msrobot/application",
    `${BASE}2/`,
    `${BASE}/api`,
    `${BASE}/api/auth/get-session`,
    `${BASE}/_serverFn`,
    `${BASE}/_serverFn/id`,
    `${BASE}/__grok`,
    `${BASE}/__grok/icon-180.png`,
    `${BASE}/@vite/client`,
    `${BASE}/node_modules/x`,
    `${BASE}/assets/index.js`,
    `${BASE}/../outside`,
    `${BASE}/%61pi/auth`,
    `${BASE}/%5fserverFn/id`,
  ]) {
    assert.equal(isDocumentPath(path, { appBase: BASE }), false, path);
  }
  assert.equal(isDocumentPath("/"), true);
  assert.equal(isDocumentPath("/p/123"), true);
  assert.equal(isDocumentPath("/_serverFn/id"), false);
});

function runViteMiddleware(hooks, url, { method = "GET", accept = "text/html", originalUrl } = {}) {
  const chunks = [];
  const headers = new Map();
  let ended = false;
  const req = { url, originalUrl, method, headers: { host: "maziyarid.com", accept } };
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader: (name, value) => headers.set(name, value),
    getHeader: (name) => headers.get(name),
    removeHeader: (name) => headers.delete(name),
    write(chunk) {
      if (chunk) chunks.push(Buffer.from(chunk));
      return true;
    },
    end(chunk) {
      if (chunk) chunks.push(Buffer.from(chunk));
      ended = true;
    },
  };
  const dispatch = (index) => {
    if (hooks[index]) return hooks[index](req, res, () => dispatch(index + 1));
    res.setHeader("content-type", "text/html");
    res.end(DOCUMENT);
  };
  dispatch(0);
  assert.equal(ended, true);
  return { body: Buffer.concat(chunks).toString("utf8"), headers };
}

for (const lifecycle of ["configureServer", "configurePreviewServer"]) {
  test(`Vite ${lifecycle} confines manifest/install/injection to the resolved mount`, () => {
    const plugin = grokPwaPlugin();
    plugin.configResolved({ root: EMPTY_ROOT, base: `${BASE}/` });
    const hooks = [];
    const post = plugin[lifecycle]({ middlewares: { use: (hook) => hooks.push(hook) } });
    post?.();
    const manifest = runViteMiddleware(hooks, `${BASE}/__grok/manifest.webmanifest`);
    assert.equal(JSON.parse(manifest.body).scope, `${BASE}/`);
    assert.match(manifest.headers.get("content-type"), /application\/manifest\+json/);
    assert.match(
      runViteMiddleware(hooks, `${BASE}/?install=1&platform=ios`).body,
      /Add Grok App to your/,
    );
    assert.match(
      runViteMiddleware(hooks, `${BASE}/p/123`).body,
      /href="\/msrobot\/app\/__grok\/manifest.webmanifest"/,
    );
    for (const path of [
      "/",
      "/__grok/manifest.webmanifest",
      "/?install=1&platform=ios",
      `${BASE}/api/auth?install=1&platform=ios`,
      `${BASE}/_serverFn/id`,
    ]) {
      assert.equal(runViteMiddleware(hooks, path).body, DOCUMENT, path);
    }
    assert.equal(runViteMiddleware(hooks, `${BASE}/`, { method: "POST" }).body, DOCUMENT);
    assert.match(
      plugin.transformIndexHtml(DOCUMENT),
      /href="\/msrobot\/app\/__grok\/manifest.webmanifest"/,
    );
  });
}

test("Vite preview post-hook filters with originalUrl after base stripping", () => {
  const plugin = grokPwaPlugin();
  plugin.configResolved({ root: EMPTY_ROOT, base: `${BASE}/` });
  const hooks = [];
  const post = plugin.configurePreviewServer({ middlewares: { use: (hook) => hooks.push(hook) } });
  hooks.length = 0;
  post();
  const html = runViteMiddleware(hooks, "/p/123", { originalUrl: `${BASE}/p/123` }).body;
  assert.match(html, /href="\/msrobot\/app\/__grok\/manifest.webmanifest"/);
  assert.equal(
    runViteMiddleware(hooks, "/api/auth", { originalUrl: `${BASE}/api/auth` }).body,
    DOCUMENT,
  );
});

// Transpile the real middleware, substituting only its build-time raw/virtual
// imports and BASE_URL exactly as Vite does. No listener or live server needed.
async function loadNitroMiddleware(appBase) {
  const source = readFileSync(new URL("../server/middleware/grok-pwa.ts", import.meta.url), "utf8")
    .replace(
      /import installPageTemplate from "[^"]+";/,
      `const installPageTemplate = ${JSON.stringify(TEMPLATE)};`,
    )
    .replace(
      /import \{ grokOgIdentity \} from "virtual:grok-og-identity";/,
      'const grokOgIdentity = {site: {title: "MS Robot", image: "/og.jpg"}};',
    )
    .replaceAll(
      '"../../scripts/grok-pwa-shared.mjs"',
      JSON.stringify(new URL("./grok-pwa-shared.mjs", import.meta.url).href),
    )
    .replaceAll(
      '"../../scripts/public-paths.mjs"',
      JSON.stringify(new URL("./public-paths.mjs", import.meta.url).href),
    )
    .replaceAll("import.meta.env.BASE_URL", JSON.stringify(appBase));
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`))
    .default;
}

for (const appBase of ["/", `${BASE}/`]) {
  test(`Nitro middleware uses the build base ${appBase} for serving and injection`, async () => {
    const middleware = await loadNitroMiddleware(appBase);
    const request = async (path) => {
      const url = new URL(path, "https://maziyarid.com");
      return middleware(
        { url, req: { method: "GET", headers: new Headers({ accept: "text/html" }) } },
        () => new Response(DOCUMENT, { headers: { "content-type": "text/html" } }),
      );
    };
    assert.equal(
      (await (await request(`${appBase}__grok/manifest.webmanifest`)).json()).scope,
      appBase,
    );
    const installed = await (await request(`${appBase}?install=1&platform=ios`)).text();
    assert.ok(installed.includes(`href="${appBase}__grok/install/styles.css"`));
    const document = await (await request(`${appBase}p/123`)).text();
    assert.ok(document.includes(`href="${appBase}__grok/manifest.webmanifest"`));
    assert.ok(document.includes(`content="https://maziyarid.com${appBase}og.jpg"`));
    for (const path of [
      `${appBase}api/auth`,
      `${appBase}_serverFn/id`,
      ...(appBase === "/" ? [] : ["/", "/?install=1&platform=ios"]),
    ]) {
      assert.equal(await (await request(path)).text(), DOCUMENT, path);
    }
  });
}
