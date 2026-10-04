import test from "node:test";
import assert from "node:assert/strict";
import { loadSearchTable } from "./search-table.ts";
import type { SnapshotSql } from "./reporting-snapshot-service.ts";
const sql = (async () => []) as unknown as SnapshotSql;
const owner = { role: "owner" as const, filter: "", project: { id: "p1", domain: "example.com" } };
const period = { start: "2026-09-25", end: "2026-10-01", label: "last_7d" };
const opts = { sql, resolveAccess: async () => owner, userId: "u", email: "", projectId: "p1", period };
const rows = [
  { provider: "gsc", site: "example.com", dataset: "query_page_daily", data_date: "2026-09-30", dimensions: { query: "term", page: "https://example.com/a" }, metrics: { clicks: 3, impressions: 30, position: 4 } },
  { provider: "gsc", site: "example.com", dataset: "query_page_daily", data_date: "2026-10-01", dimensions: { query: "term", page: "https://example.com/a" }, metrics: { clicks: 1, impressions: 10, position: 8 } },
];

test("search table weights ratios, sorts deterministically and refuses rolling-window legacy rows", async () => {
  const table = await loadSearchTable({ ...opts, readRows: async (_project, site, dataset, start, end) => { assert.equal(site, "example.com"); assert.equal(dataset, "query_page_daily"); assert.equal(start, period.start); assert.equal(end, period.end); return { rows: [...rows, { ...rows[0], dataset: "query_page", metrics: { clicks: 999, impressions: 999, position: 1 } }] }; } });
  assert.equal(table.rows[0].clicks, 4); assert.equal(table.rows[0].impressions, 40);
  assert.equal(table.rows[0].ctr, 0.1); assert.equal(table.rows[0].averagePosition, 5);
  assert.equal(table.status, "partial");
});

test("client without Search grant and keyword-limited member cannot fetch query rows", async () => {
  for (const access of [{ ...owner, role: "client" as const, reportSections: ["overview"] }, { ...owner, filter: "limited" }]) {
    let calls = 0;
    await assert.rejects(loadSearchTable({ ...opts, resolveAccess: async () => access, readRows: async () => { calls++; return { rows }; } }), /Forbidden/);
    assert.equal(calls, 0);
  }
});

test("search table hides contact identifiers and foreign-site rows from a granted client", async () => {
  const table = await loadSearchTable({ ...opts, resolveAccess: async () => ({ ...owner, role: "client", reportSections: ["search"] }), readRows: async () => ({ rows: [
    { ...rows[0], dimensions: { query: "contact private@example.com", page: "https://example.com/a?email=private@example.com#session" } },
    { ...rows[0], site: "other.example", metrics: { clicks: 999, impressions: 999, position: 1 } },
  ] }) });
  assert.equal(table.rows.length, 1); assert.doesNotMatch(JSON.stringify(table), /private@example.com|999|#session/);
});

test("bounded result truncation is visible and table pages have stable ordering", async () => {
  const input = Array.from({ length: 120 }, (_, i) => ({ ...rows[0], dimensions: { query: `term ${String(i).padStart(3, "0")}`, page: "https://example.com/a" } }));
  const first = await loadSearchTable({ ...opts, limit: 20, offset: 0, readRows: async () => ({ rows: input, truncated: true }) });
  const second = await loadSearchTable({ ...opts, limit: 20, offset: 20, readRows: async () => ({ rows: input, truncated: true }) });
  assert.equal(first.rows.length, 20); assert.equal(first.total, 120); assert.equal(first.truncated, true);
  assert.equal(first.rows[0].query, "term 000"); assert.equal(second.rows[0].query, "term 020");
});

test("malformed search values degrade without publishing false totals or provider errors", async () => {
  const table = await loadSearchTable({ ...opts, readRows: async () => ({ rows: [{ ...rows[0], metrics: { clicks: 2 } }] }) });
  assert.equal(table.status, "unavailable"); assert.deepEqual(table.rows, []);
});

test("encoded contact information in page paths cannot bypass client redaction", async () => {
  const table = await loadSearchTable({ ...opts, resolveAccess: async () => ({ ...owner, role: "client", reportSections: ["search"] }), readRows: async () => ({ rows: [{ ...rows[0], dimensions: { query: "contact", page: "https://example.com/contact/private%40example.com/%2B98%20912%20123%204567" } }] }) });
  assert.doesNotMatch(JSON.stringify(table), /private|%40|912|4567/);
  assert.match(table.rows[0].page, /REDACTED/);
});
