import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { buildProjectKeywordQuery, toPublicClickUpSettings } from "./query-builders.ts";
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

test("public ClickUp settings never include the stored API key", () => {
  const published = toPublicClickUpSettings({
    api_key: "pk_live_secret_value",
    team_id: "team-1",
    folder_id: "folder-1",
    list_id: "list-1",
  });
  assert.equal(published.hasApiKey, true);
  assert.equal(published.listId, "list-1");
  assert.equal("api_key" in published, false);
  assert.equal("apiKey" in published, false);
  assert.equal(JSON.stringify(published).includes("pk_live_secret_value"), false);
  assert.deepEqual(toPublicClickUpSettings(null), {
    hasApiKey: false,
    teamId: "",
    folderId: "",
    listId: "",
  });
});

test("ClickUp keyword filter stays parameterized and does not interpolate SQL", () => {
  const injection = "'; drop table keywords; --";
  const query = buildProjectKeywordQuery("project-1", injection);
  assert.equal(query.text.includes("$1"), true);
  assert.equal(query.text.includes("$2"), true);
  assert.equal(query.text.includes(injection), false);
  assert.equal(query.text.toLowerCase().includes("drop table"), false);
  assert.deepEqual(query.params, ["project-1", injection]);
  const unfiltered = buildProjectKeywordQuery("project-1", "  ");
  assert.equal(unfiltered.params.length, 1);
  assert.equal(unfiltered.text.includes("$2"), false);
});

test("ClickUp keyword filter query executes with hostile input as a value", async () => {
  const { db, sql } = await fixture();
  try {
    await sql.query("insert into tenants(id,owner_id,name) values('t1','u1','T')");
    await sql.query("insert into projects(id,owner_id,tenant_id,name) values('p1','u1','t1','P')");
    await sql.query(
      "insert into keywords(id,project_id,keyword,status,volume) values('k1','p1','seo audit','new',10),('k2','p1','hostile','briefed',3)",
    );
    const query = buildProjectKeywordQuery("p1", "' OR 1=1 --");
    const rows = await sql.query<{ keyword: string }>(query.text, query.params);
    assert.equal(rows.length, 0);
    const matched = await sql.query<{ keyword: string }>(
      ...(() => {
        const q = buildProjectKeywordQuery("p1", "seo");
        return [q.text, q.params] as const;
      })(),
    );
    assert.deepEqual(matched.map((row) => row.keyword), ["seo audit"]);
  } finally {
    await db.close();
  }
});
