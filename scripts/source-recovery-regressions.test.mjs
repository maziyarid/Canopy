import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Vercel config does not override Nitro Build Output routing", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.equal(config.version, 2);
  assert.equal("builds" in config, false);
  assert.equal("routes" in config, false);
  assert.equal("rewrites" in config, false);
});

test("project list and bundle preserve keyword-scoped client isolation", () => {
  const source = read("src/lib/server/projects.ts");
  assert.match(source, /scopedKeywords = filterKeywords\(keywordRows, filter\)/);
  assert.match(source, /scopedRanks = filterKeywords\(rankRows, filter\)/);
  assert.match(source, /const logRows = filter\.trim\(\)\s*\? \[\]/);
});

test("rank refresh fails closed when Mangools tracking is not configured", () => {
  const source = read("src/lib/server/serp.ts");
  assert.match(source, /if \(!key\) throw new Error/);
  assert.match(source, /if \(!project\.tracking_id\)/);
  assert.doesNotMatch(source, /Math\.random\(\)/);
});
