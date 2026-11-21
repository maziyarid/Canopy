import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const moduleUrl = new URL("./gateway.server.ts", import.meta.url).href;

test("analytics gateway import fails closed in a browser-like runtime", () => {
  const script =
    "globalThis.window = {}; import(" + JSON.stringify(moduleUrl) + ")" +
    ".then(() => { console.error('unexpected import success'); process.exit(1); })" +
    ".catch((error) => { const message = String(error?.message || error); console.log(message); process.exit(message.includes('server-only') ? 0 : 2); });";
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "--eval", script],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        ANALYTICS_GATEWAY_URL: "https://analytics.example.test",
        ANALYTICS_GATEWAY_TOKEN: "fixture-token",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /server-only/);
});

test("analytics gateway trims and rejects whitespace-only configuration", async () => {
  const savedUrl = process.env.ANALYTICS_GATEWAY_URL;
  const savedToken = process.env.ANALYTICS_GATEWAY_TOKEN;
  const savedFetch = globalThis.fetch;
  try {
    process.env.ANALYTICS_GATEWAY_URL = "   ";
    process.env.ANALYTICS_GATEWAY_TOKEN = "fixture-token";
    globalThis.fetch = (() => {
      throw new Error("fetch must not run");
    }) as typeof fetch;
    const gateway = await import("./gateway.server.ts");
    await assert.rejects(
      () => gateway.getAnalyticsSnapshot("project", "example.com"),
      /ANALYTICS_GATEWAY_URL is not configured/,
    );

    process.env.ANALYTICS_GATEWAY_URL = " https://analytics.example.test/// ";
    process.env.ANALYTICS_GATEWAY_TOKEN = "   ";
    await assert.rejects(
      () => gateway.getAnalyticsSnapshot("project", "example.com"),
      /ANALYTICS_GATEWAY_TOKEN is not configured/,
    );
  } finally {
    if (savedUrl === undefined) delete process.env.ANALYTICS_GATEWAY_URL;
    else process.env.ANALYTICS_GATEWAY_URL = savedUrl;
    if (savedToken === undefined) delete process.env.ANALYTICS_GATEWAY_TOKEN;
    else process.env.ANALYTICS_GATEWAY_TOKEN = savedToken;
    globalThis.fetch = savedFetch;
  }
});
