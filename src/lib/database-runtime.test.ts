import test from "node:test";
import assert from "node:assert/strict";
import { databaseRuntime } from "./database-runtime.ts";

test("production refuses to serve against a volatile database", () => {
  assert.throws(() => databaseRuntime({ NODE_ENV: "production", DATABASE_URL: "  " }), /durable application database/);
  assert.equal(databaseRuntime({ NODE_ENV: "development" }).durable, false);
});
test("local durable storage requires an absolute path and persistent session secret", () => {
  assert.throws(() => databaseRuntime({ PGLITE_DATA_DIR: "relative" }), /absolute path/);
  assert.throws(() => databaseRuntime({ PGLITE_DATA_DIR: "/var/lib/test-pglite" }), /persistent BETTER_AUTH_SECRET/);
  assert.equal(databaseRuntime({ NODE_ENV: "production", PGLITE_DATA_DIR: "/var/lib/test-pglite", BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters" }).durable, true);
});
test("external SQL remains supported and does not activate local storage", () => {
  const runtime = databaseRuntime({ NODE_ENV: "production", DATABASE_URL: "postgresql://test.invalid/test" });
  assert.equal(runtime.databaseUrl, "postgresql://test.invalid/test");
  assert.equal(runtime.pgliteDataDir, undefined);
});
