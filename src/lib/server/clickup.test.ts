import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  buildClickUpClaimQuery,
  buildProjectKeywordQuery,
  executeClickUpKeywordSync,
  mergeClickUpSettings,
  partitionClickUpSyncKeywords,
  summarizeClickUpSync,
  toPublicClickUpSettings,
  type ClickUpKeywordRow,
} from "./query-builders.ts";
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

function keywordRow(partial: Partial<ClickUpKeywordRow> & Pick<ClickUpKeywordRow, "id" | "keyword">): ClickUpKeywordRow {
  return {
    status: "new",
    volume: 10,
    clickup_task_id: "",
    ...partial,
  };
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
  assert.match(query.text, /clickup_task_id/);
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

test("mergeClickUpSettings keeps the stored key when apiKey is omitted", () => {
  const merged = mergeClickUpSettings(
    { api_key: "pk_stored", team_id: "t", folder_id: "f", list_id: "old-list" },
    { listId: "new-list" },
  );
  assert.equal(merged.api_key, "pk_stored");
  assert.equal(merged.list_id, "new-list");
  assert.equal(merged.team_id, "t");
  assert.throws(
    () => mergeClickUpSettings(undefined, { listId: "new-list" }),
    /ClickUp is not configured/,
  );
  const replaced = mergeClickUpSettings(
    { api_key: "pk_stored", team_id: "t", folder_id: "f", list_id: "old-list" },
    { apiKey: "pk_new", listId: "new-list" },
  );
  assert.equal(replaced.api_key, "pk_new");
  assert.equal(
    JSON.stringify(toPublicClickUpSettings(replaced)).includes("pk_new"),
    false,
  );
});

test("partitionClickUpSyncKeywords skips durable and fresh pending claims", () => {
  const now = 1_800_000_000_000;
  const fresh = `pending:${now}:abc`;
  const stale = `pending:${now - 10 * 60 * 1000}:old`;
  const recovered = `pending:${now}:rec`;
  const { toCreate, skippedLinked } = partitionClickUpSyncKeywords(
    [
      keywordRow({ id: "k1", keyword: "alpha", status: "new" }),
      keywordRow({ id: "k2", keyword: "beta", status: "briefed", clickup_task_id: "cu-1" }),
      keywordRow({ id: "k3", keyword: "gamma", status: "tracked" }),
      keywordRow({ id: "k4", keyword: "delta", status: "new", clickup_task_id: fresh }),
      keywordRow({ id: "k5", keyword: "stale", status: "new", clickup_task_id: stale }),
      keywordRow({ id: "k6", keyword: "legacy", status: "new", clickup_task_id: "pending:abc" }),
      keywordRow({
        id: "k7",
        keyword: "recover",
        status: "new",
        clickup_task_id: recovered,
        clickup_task_url: "https://app.clickup.com/t/cu-rec",
      }),
    ],
    now,
  );
  assert.deepEqual(toCreate.map((row) => row.keyword), ["alpha", "stale", "legacy", "recover"]);
  assert.deepEqual(skippedLinked.map((row) => row.keyword), ["beta", "delta"]);
});

test("summarizeClickUpSync is truthful for mixed and all-failure results", () => {
  const mixed = summarizeClickUpSync({
    created: [{ keyword: "ok", clickUpId: "cu-1", url: "https://app.clickup.com/t/cu-1" }],
    failed: [{ keyword: "bad", error: "ClickUp API error: 500" }],
    skipped: 2,
  });
  assert.equal(mixed.ok, false);
  assert.equal(mixed.created, 1);
  assert.equal(mixed.failed, 1);
  assert.equal(mixed.skipped, 2);
  assert.equal(mixed.totalTasks, 4);
  assert.match(mixed.error, /1 ClickUp task/);

  const allFailed = summarizeClickUpSync({
    created: [],
    failed: [
      { keyword: "a", error: "ClickUp API error: 401" },
      { keyword: "b", error: "ClickUp API error: 500" },
    ],
    skipped: 0,
  });
  assert.equal(allFailed.ok, false);
  assert.equal(allFailed.created, 0);
  assert.equal(allFailed.failed, 2);
  assert.equal(allFailed.error.includes("401"), false); // summary stays generic

  const clean = summarizeClickUpSync({ created: [{ keyword: "ok", clickUpId: "1", url: "" }], failed: [], skipped: 1 });
  assert.equal(clean.ok, true);
  assert.equal(clean.error, "");
});

test("repeated ClickUp sync skips linked keywords and claims atomically", async () => {
  const { db, sql } = await fixture();
  try {
    await sql.query("insert into tenants(id,owner_id,name) values('t1','u1','T')");
    await sql.query("insert into projects(id,owner_id,tenant_id,name) values('p1','u1','t1','P')");
    await sql.query(
      "insert into keywords(id,project_id,keyword,status,volume,clickup_task_id) values('k1','p1','alpha','new',10,''),('k2','p1','beta','briefed',4,'cu-existing'),('k3','p1','gamma','tracked',1,'')",
    );
    const query = buildProjectKeywordQuery("p1");
    const rows = await sql.query<ClickUpKeywordRow>(query.text, query.params);
    const first = await executeClickUpKeywordSync(sql, {
      keywords: rows,
      createTask: async (kw) => ({ id: `cu-${kw.keyword}`, url: `https://app.clickup.com/t/${kw.keyword}` }),
    });
    assert.equal(first.ok, true);
    assert.equal(first.created, 1);
    assert.equal(first.skipped, 1);
    assert.deepEqual(first.createdTasks.map((row) => row.keyword), ["alpha"]);

    const after = await sql.query<{ keyword: string; clickup_task_id: string }>(
      "select keyword, clickup_task_id from keywords order by keyword",
    );
    assert.equal(after.find((row) => row.keyword === "alpha")?.clickup_task_id, "cu-alpha");
    assert.equal(after.find((row) => row.keyword === "beta")?.clickup_task_id, "cu-existing");

    const secondRows = await sql.query<ClickUpKeywordRow>(query.text, query.params);
    const second = await executeClickUpKeywordSync(sql, {
      keywords: secondRows,
      createTask: async () => {
        throw new Error("should not create again");
      },
    });
    assert.equal(second.ok, true);
    assert.equal(second.created, 0);
    assert.equal(second.skipped, 2);

    const firstClaim = buildClickUpClaimQuery({ id: "k1", claimId: "pending:one" });
    const firstClaimRows = await sql.query(firstClaim.text, firstClaim.params);
    assert.equal(firstClaimRows.length, 0, "already-linked row cannot be claimed again");
  } finally {
    await db.close();
  }
});

test("ClickUp create failures release the claim and report mixed/all-failure status", async () => {
  const { db, sql } = await fixture();
  try {
    await sql.query("insert into tenants(id,owner_id,name) values('t1','u1','T')");
    await sql.query("insert into projects(id,owner_id,tenant_id,name) values('p1','u1','t1','P')");
    await sql.query(
      "insert into keywords(id,project_id,keyword,status,volume) values('k1','p1','ok-kw','new',10),('k2','p1','fail-kw','briefed',4)",
    );
    const mixed = await executeClickUpKeywordSync(sql, {
      keywords: [
        keywordRow({ id: "k1", keyword: "ok-kw" }),
        keywordRow({ id: "k2", keyword: "fail-kw", status: "briefed" }),
      ],
      createTask: async (kw) => {
        if (kw.keyword === "fail-kw") throw new Error("ClickUp API error: 500");
        return { id: "cu-ok", url: "https://app.clickup.com/t/cu-ok" };
      },
    });
    assert.equal(mixed.ok, false);
    assert.equal(mixed.created, 1);
    assert.equal(mixed.failed, 1);
    assert.equal(mixed.failures[0]?.keyword, "fail-kw");
    assert.equal(mixed.failures[0]?.error, "ClickUp API error: 500");

    const ids = await sql.query<{ keyword: string; clickup_task_id: string }>(
      "select keyword, clickup_task_id from keywords order by keyword",
    );
    assert.equal(ids.find((row) => row.keyword === "fail-kw")?.clickup_task_id, "");
    assert.equal(ids.find((row) => row.keyword === "ok-kw")?.clickup_task_id, "cu-ok");

    const allFailed = await executeClickUpKeywordSync(sql, {
      keywords: [keywordRow({ id: "k2", keyword: "fail-kw", status: "briefed" })],
      createTask: async () => {
        throw new Error("ClickUp API error: 401");
      },
    });
    assert.equal(allFailed.ok, false);
    assert.equal(allFailed.created, 0);
    assert.equal(allFailed.failed, 1);
    assert.equal(allFailed.skipped, 0);
  } finally {
    await db.close();
  }
});

test("concurrent ClickUp claims only dispatch one remote create", async () => {
  const { db, sql } = await fixture();
  try {
    await sql.query("insert into tenants(id,owner_id,name) values('t1','u1','T')");
    await sql.query("insert into projects(id,owner_id,tenant_id,name) values('p1','u1','t1','P')");
    await sql.query(
      "insert into keywords(id,project_id,keyword,status,volume) values('k1','p1','alpha','new',10)",
    );
    const first = buildClickUpClaimQuery({ id: "k1", claimId: "pending:one" });
    const second = buildClickUpClaimQuery({ id: "k1", claimId: "pending:two" });
    const claimed = await sql.query<{ id: string }>(first.text, first.params);
    const raced = await sql.query<{ id: string }>(second.text, second.params);
    assert.equal(claimed.length, 1);
    assert.equal(raced.length, 0);
    const stored = await sql.query<{ clickup_task_id: string }>("select clickup_task_id from keywords where id='k1'");
    assert.equal(stored[0].clickup_task_id, "pending:one");

    const reclaim = buildClickUpClaimQuery({ id: "k1", claimId: "pending:stale-reclaim", previous: "pending:one" });
    const reclaimed = await sql.query<{ id: string }>(reclaim.text, reclaim.params);
    assert.equal(reclaimed.length, 1, "stale pending claims can be reclaimed");
  } finally {
    await db.close();
  }
});

test("ClickUp sync recovers a created remote id without a second create", async () => {
  const { db, sql } = await fixture();
  try {
    await sql.query("insert into tenants(id,owner_id,name) values('t1','u1','T')");
    await sql.query("insert into projects(id,owner_id,tenant_id,name) values('p1','u1','t1','P')");
    await sql.query(
      "insert into keywords(id,project_id,keyword,status,volume,clickup_task_id,clickup_task_url) values('k1','p1','alpha','new',10,'pending:1700000000000:abc','https://app.clickup.com/t/cu-recovered')",
    );
    let creates = 0;
    const recovered = await executeClickUpKeywordSync(sql, {
      keywords: [
        keywordRow({
          id: "k1",
          keyword: "alpha",
          clickup_task_id: "pending:1700000000000:abc",
          clickup_task_url: "https://app.clickup.com/t/cu-recovered",
        }),
      ],
      createTask: async () => {
        creates += 1;
        throw new Error("should not create again");
      },
    });
    assert.equal(creates, 0);
    assert.equal(recovered.ok, true);
    assert.equal(recovered.created, 1);
    assert.equal(recovered.createdTasks[0]?.clickUpId, "cu-recovered");
    const row = await sql.query<{ clickup_task_id: string; clickup_task_url: string }>(
      "select clickup_task_id, clickup_task_url from keywords where id='k1'",
    );
    assert.equal(row[0].clickup_task_id, "cu-recovered");
    assert.equal(row[0].clickup_task_url, "https://app.clickup.com/t/cu-recovered");
  } finally {
    await db.close();
  }
});

test("ClickUp create success is not released when the final link write fails", async () => {
  const { db, sql } = await fixture();
  try {
    await sql.query("insert into tenants(id,owner_id,name) values('t1','u1','T')");
    await sql.query("insert into projects(id,owner_id,tenant_id,name) values('p1','u1','t1','P')");
    await sql.query(
      "insert into keywords(id,project_id,keyword,status,volume) values('k1','p1','alpha','new',10)",
    );
    const inner = sql.query.bind(sql);
    let linkAttempts = 0;
    sql.query = async <T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> => {
      if (text.includes("SET clickup_task_id = $1, clickup_task_url = $2")) {
        linkAttempts += 1;
        if (linkAttempts === 1) throw new Error("link failed");
      }
      return inner<T>(text, params);
    };
    let creates = 0;
    const first = await executeClickUpKeywordSync(sql, {
      keywords: [keywordRow({ id: "k1", keyword: "alpha" })],
      createTask: async () => {
        creates += 1;
        return { id: "cu-alpha", url: "https://app.clickup.com/t/cu-alpha" };
      },
    });
    assert.equal(first.ok, false);
    assert.equal(first.failed, 1);
    assert.equal(creates, 1);
    const pending = await sql.query<{ clickup_task_id: string; clickup_task_url: string }>(
      "select clickup_task_id, clickup_task_url from keywords where id='k1'",
    );
    assert.equal(pending[0].clickup_task_id.startsWith("pending:"), true);
    assert.equal(pending[0].clickup_task_url, "https://app.clickup.com/t/cu-alpha");

    const retry = await executeClickUpKeywordSync(sql, {
      keywords: [
        keywordRow({
          id: "k1",
          keyword: "alpha",
          clickup_task_id: pending[0].clickup_task_id,
          clickup_task_url: pending[0].clickup_task_url,
        }),
      ],
      createTask: async () => {
        creates += 1;
        throw new Error("should not create a duplicate");
      },
    });
    assert.equal(creates, 1);
    assert.equal(retry.ok, true);
    assert.equal(retry.created, 1);
    const linked = await sql.query<{ clickup_task_id: string }>("select clickup_task_id from keywords where id='k1'");
    assert.equal(linked[0].clickup_task_id, "cu-alpha");
  } finally {
    await db.close();
  }
});

test("stale pending ClickUp claims without a recovered id are reclaimed and created once", async () => {
  const { db, sql } = await fixture();
  try {
    await sql.query("insert into tenants(id,owner_id,name) values('t1','u1','T')");
    await sql.query("insert into projects(id,owner_id,tenant_id,name) values('p1','u1','t1','P')");
    await sql.query(
      "insert into keywords(id,project_id,keyword,status,volume,clickup_task_id) values('k1','p1','alpha','new',10,'pending:abc')",
    );
    let creates = 0;
    const result = await executeClickUpKeywordSync(sql, {
      keywords: [keywordRow({ id: "k1", keyword: "alpha", clickup_task_id: "pending:abc" })],
      createTask: async () => {
        creates += 1;
        return { id: "cu-stale", url: "https://app.clickup.com/t/cu-stale" };
      },
    });
    assert.equal(creates, 1);
    assert.equal(result.ok, true);
    assert.equal(result.created, 1);
    const row = await sql.query<{ clickup_task_id: string }>("select clickup_task_id from keywords where id='k1'");
    assert.equal(row[0].clickup_task_id, "cu-stale");
  } finally {
    await db.close();
  }
});
