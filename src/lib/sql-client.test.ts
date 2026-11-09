import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { createPostgresSql } from "./sql-client.ts";

function fixture(failCommit = false) {
  const calls: string[] = [];
  const client = {
    async query(text: string) {
      calls.push(`client:${text}`);
      if (text === "COMMIT" && failCommit) throw new Error("commit_failed");
      return { rows: [{ connection: "pinned" }] };
    },
    release() {
      calls.push("release");
    },
  };
  const pool = {
    async query(text: string) {
      calls.push(`pool:${text}`);
      return { rows: [{ connection: "pool" }] };
    },
    async connect() {
      calls.push("connect");
      return client;
    },
  };
  return { calls, sql: createPostgresSql(pool as unknown as Pick<Pool, "query" | "connect">) };
}

test("PostgreSQL settings transactions use one pinned client for every statement", async () => {
  const { calls, sql } = fixture();
  const result = await sql.transaction!(async (tx) => {
    const first = await tx<{ connection: string }>`select ${1}`;
    const second = await tx.query<{ connection: string }>("select $1", [2]);
    assert.equal(tx.transaction, undefined);
    return [first[0].connection, second[0].connection];
  });
  assert.deepEqual(result, ["pinned", "pinned"]);
  assert.deepEqual(calls, [
    "connect",
    "client:BEGIN",
    "client:select $1",
    "client:select $1",
    "client:COMMIT",
    "release",
  ]);
});

test("failed settings work rolls back and releases the connection", async () => {
  const { calls, sql } = fixture();
  await assert.rejects(
    sql.transaction!(async (tx) => {
      await tx.query("update settings");
      throw new Error("write_failed");
    }),
    /write_failed/,
  );
  assert.deepEqual(calls, [
    "connect",
    "client:BEGIN",
    "client:update settings",
    "client:ROLLBACK",
    "release",
  ]);
});

test("uncertain commit rolls back and releases rather than returning success", async () => {
  const { calls, sql } = fixture(true);
  await assert.rejects(
    sql.transaction!(async () => "saved"),
    /commit_failed/,
  );
  assert.deepEqual(calls, [
    "connect",
    "client:BEGIN",
    "client:COMMIT",
    "client:ROLLBACK",
    "release",
  ]);
});
