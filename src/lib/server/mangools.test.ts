import test from "node:test";
import assert from "node:assert/strict";
import { bindStoredMangoolsKey, PublicMangoolsRequestSchema } from "./mangools-bind.ts";

test("public Mangools request schema drops caller-supplied apiKey", () => {
  const parsed = PublicMangoolsRequestSchema.parse({
    apiKey: "pk_live_caller_supplied_secret",
    path: "/kwfinder/limits",
    method: "GET",
  });
  assert.equal("apiKey" in parsed, false);
  assert.equal(JSON.stringify(parsed).includes("pk_live_caller_supplied_secret"), false);
  assert.equal(parsed.path, "/kwfinder/limits");
});

test("Mangools proxy binds the stored key and ignores extra caller secrets", () => {
  const publicInput = PublicMangoolsRequestSchema.parse({
    apiKey: "pk_live_caller_supplied_secret",
    path: "/kwfinder/related-keywords",
    query: { kw: "seo" },
  });
  const bound = bindStoredMangoolsKey(publicInput, "stored-mangools-token-value");
  assert.equal(bound.apiKey, "stored-mangools-token-value");
  assert.equal(bound.path, "/kwfinder/related-keywords");
  assert.throws(
    () => bindStoredMangoolsKey(publicInput, "  "),
    /Add your Mangools API key/,
  );
});
