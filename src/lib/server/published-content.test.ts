import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { buildPublishedContentListQuery, buildPublishedContentUpdateQuery } from "./query-builders.ts";
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

test("published content list/update queries bind user input instead of interpolating SQL", () => {
  const injection = "x' OR 1=1 --";
  const list = buildPublishedContentListQuery({
    projectId: "p1",
    keyword: injection,
    contentType: "blog",
    status: "published",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    limit: 20,
    offset: 0,
  });
  assert.equal(list.text.includes(injection), false);
  assert.equal(list.params.includes(injection), true);
  assert.match(list.text, /LIMIT \$7 OFFSET \$8/);

  const update = buildPublishedContentUpdateQuery({
    id: "c1",
    projectId: "p1",
    title: "ok'; drop table published_content; --",
    notes: "safe",
  });
  assert.ok(update);
  assert.equal(update.text.includes("drop table"), false);
  assert.equal(update.params[0], "ok'; drop table published_content; --");
  assert.match(update.text, /WHERE id = \$3 AND project_id = \$4/);
});

test("keywords schema has no last_published column and create path does not reference it", async () => {
  const source = await readFile(new URL("./published-content.ts", import.meta.url), "utf8");
  assert.equal(source.includes("last_published"), false);
  const { db, sql } = await fixture();
  try {
    const cols = await sql.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name='keywords'",
    );
    assert.equal(cols.some((col) => col.column_name === "last_published"), false);
    await sql.query("insert into tenants(id,owner_id,name) values('t1','u1','T')");
    await sql.query("insert into projects(id,owner_id,tenant_id,name) values('p1','u1','t1','P')");
    await sql.query(
      "insert into published_content(id,project_id,url,title,keyword,content_type,publish_date,status) values('c1','p1','https://example.com/a','A','alpha','blog','2026-01-02','published')",
    );
    const list = buildPublishedContentListQuery({
      projectId: "p1",
      keyword: "alp",
      limit: 10,
      offset: 0,
    });
    const rows = await sql.query<{ title: string }>(list.text, list.params);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, "A");
    const update = buildPublishedContentUpdateQuery({
      id: "c1",
      projectId: "p1",
      title: "Renamed",
    });
    assert.ok(update);
    await sql.query(update.text, update.params);
    const renamed = await sql.query<{ title: string }>("select title from published_content where id='c1'");
    assert.equal(renamed[0].title, "Renamed");
  } finally {
    await db.close();
  }
});

test("published content endDate includes midday timestamptz on that calendar day", async () => {
  const { db, sql } = await fixture();
  try {
    await sql.query("insert into tenants(id,owner_id,name) values('t1','u1','T')");
    await sql.query("insert into projects(id,owner_id,tenant_id,name) values('p1','u1','t1','P')");
    await sql.query(
      "insert into published_content(id,project_id,url,title,keyword,content_type,publish_date,status) values('c-mid','p1','https://example.com/mid','Mid','alpha','blog','2026-01-02 12:00:00+00','published'),('c-next','p1','https://example.com/next','Next','alpha','blog','2026-01-03 00:00:00+00','published')",
    );
    const list = buildPublishedContentListQuery({
      projectId: "p1",
      startDate: "2026-01-02",
      endDate: "2026-01-02",
      limit: 10,
      offset: 0,
    });
    assert.match(list.text, /publish_date < \(\$\d+::date \+ interval '1 day'\)/);
    const rows = await sql.query<{ title: string }>(list.text, list.params);
    assert.deepEqual(rows.map((row) => row.title), ["Mid"]);
  } finally {
    await db.close();
  }
});
