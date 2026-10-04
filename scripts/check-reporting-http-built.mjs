import assert from "node:assert/strict";
import { copyFile } from "node:fs/promises";

// Run after: env -u DATABASE_URL NITRO_PRESET=node-server npm run build
// This is a disposable local build check, never a production endpoint probe.
assert.equal(process.env.DATABASE_URL, undefined, "Unset DATABASE_URL for this isolated check");
for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  await copyFile(
    new URL(`../node_modules/@electric-sql/pglite/dist/${name}`, import.meta.url),
    new URL(`../.output/server/_libs/${name}`, import.meta.url),
  );
}
const { default: server } = await import("../.output/server/_ssr/ssr.mjs");
const url = "https://reporting-fixture.example/api/v1/reporting/snapshot";

for (const headers of [
  {},
  { Authorization: "Bearer fixture-not-authorized" },
  { "If-None-Match": "*" },
]) {
  const response = await server.fetch(new Request(url, { headers }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { error: "reporting_unconfigured" });
}

for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "PROPFIND", "PURGE"]) {
  const response = await server.fetch(new Request(url, { method }));
  assert.equal(response.status, 405, method);
  assert.equal(response.headers.get("Allow"), "GET", method);
  assert.equal(response.headers.get("Cache-Control"), "no-store", method);
  // Fetch adapters may strip HEAD's body at the network boundary.
  if (method !== "HEAD") assert.deepEqual(await response.json(), { error: "method_not_allowed" });
}
console.log("Built reporting route: 3 disabled GET checks and 8 method denials passed.");
