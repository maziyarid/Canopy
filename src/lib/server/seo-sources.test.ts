import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { buildSeoDataQuery, buildSeoTimelineQuery } from "./query-builders.ts";
import type { Sql } from "../db.ts";

async function fixture() {
  const db = new PGlite();
  const dir = new URL("../../../migrations/", import.meta.url).pathname;
  for (const name of (await readdir(dir)).filter((x) => /^\d+.*\.sql$/.test(x)).sort()) {
    await db.exec(await readFile(join(dir, name), "utf8"));
  }
  const sql = (async <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> => {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
    const result = await db.query<T>(text, values);
    return result.rows;
  }) as Sql;
  sql.query = async <T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> => {
    const result = await db.query<T>(text, params);
    return result.rows;
  };
  return { db, sql };
}

test("SEO data queries parameterize every caller-controlled clause", () => {
  const injection = "p1; delete from seo_data_cache; --";
  const query = buildSeoDataQuery({
    projectId: injection,
    keyword: "kw' or 1=1",
    dataSource: "manual",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
  });
  assert.equal(query.text.includes("$1"), true);
  assert.equal(query.text.includes("$5"), true);
  assert.equal(query.text.includes(injection), false);
  assert.equal(query.text.includes("or 1=1"), false);
  assert.deepEqual(query.params, [injection, "kw' or 1=1", "manual", "2026-01-01", "2026-01-31"]);
});

test("SEO timeline queries keep metric names as bound parameters", () => {
  const query = buildSeoTimelineQuery({
    projectId: "p1",
    startDate: "2026-01-01",
    metricName: "clicks'; drop table seo_data_cache; --",
  });
  assert.equal(query.text.includes("$3"), true);
  assert.equal(query.text.toLowerCase().includes("drop table"), false);
  assert.equal(query.params[2], "clicks'; drop table seo_data_cache; --");
});

test("SEO data query executes without interpolating filter values into SQL", async () => {
  const { db, sql } = await fixture();
  try {
    await sql.query("insert into tenants(id,owner_id,name) values('t1','u1','T')");
    await sql.query("insert into projects(id,owner_id,tenant_id,name) values('p1','u1','t1','P')");
    await sql.query(
      "insert into seo_data_cache(id,project_id,data_source,keyword,url,metric_name,metric_value,data_date) values('s1','p1','manual','alpha','https://example.com','clicks',4,'2026-01-02')",
    );
    const query = buildSeoDataQuery({ projectId: "p1", keyword: "alpha' OR '1'='1" });
    const rows = await sql.query(query.text, query.params);
    assert.equal(rows.length, 0);
    const matched = buildSeoDataQuery({ projectId: "p1", keyword: "alpha" });
    const found = await sql.query<{ keyword: string }>(matched.text, matched.params);
    assert.equal(found.length, 1);
    assert.equal(found[0].keyword, "alpha");
  } finally {
    await db.close();
  }
});
