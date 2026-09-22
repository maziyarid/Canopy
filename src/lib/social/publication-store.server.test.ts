import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createPublicationStore } from "./publication-store.server.ts";
import type { Sql } from "../db.ts";

async function fixture() {
  const db = new PGlite();
  const dir = new URL("../../../migrations/", import.meta.url).pathname;
  for (const name of (await readdir(dir)).filter((x)=>/^\d+.*\.sql$/.test(x)).sort()) {
    await db.exec(await readFile(join(dir,name),"utf8"));
  }
  const sql = (async <T = Record<string, unknown>>(strings:TemplateStringsArray,...values:unknown[]): Promise<T[]> => {
    let text=strings[0]; for(let i=0;i<values.length;i++) text += `$${i+1}${strings[i+1]}`;
    const result=await db.query<T>(text,values);
    return result.rows;
  }) as Sql;
  sql.query=async <T = Record<string, unknown>>(text:string,params:unknown[]=[]): Promise<T[]> => {
    const result=await db.query<T>(text,params);
    return result.rows;
  };
  return {db,sql};
}

async function seed(sql:Sql) {
  await sql.query("insert into tenants(id,owner_id,name) values('t1','u1','T')");
  await sql.query("insert into projects(id,owner_id,tenant_id,name) values('p1','u1','t1','P')");
  await sql.query("insert into social_connections(id,project_id,platform,account_ref,credential_ref,capability_state,status) values('c1','p1','telegram','@channel','cred1','AVAILABLE','connected')");
  await sql.query("insert into social_content_items(id,project_id,body,media_manifest,status,approval_state) values('i1','p1','hello','[]','ready','approved')");
  await sql.query("insert into social_publication_jobs(id,project_id,social_connection_id,content_item_id,idempotency_key,status,max_attempts,not_before) values('j1','p1','c1','i1','idem1','pending',3,'2026-09-21T19:00:00Z')");
}

test("DB publication store atomically claims, persists success and deduplicates", async () => {
  const {db,sql}=await fixture();
  try {
    await seed(sql);
    const store=createPublicationStore(sql,60);
    const now=new Date("2026-09-21T20:00:00Z");
    const job=await store.claim("worker-1",now);
    assert.equal(job?.id,"j1");
    assert.equal(job?.attemptCount,1);
    assert.equal((await store.claim("worker-2",now)),null);
    const ctx=await store.context(job!);
    assert.equal(ctx.credentialRef,"cred1");
    await store.succeed(job!,{providerPostIds:["42"],providerUrl:"https://t.me/c/42"},now);
    const prior=await store.priorSuccess("idem1");
    assert.deepEqual(prior?.providerPostIds,["42"]);
    const rows=await sql.query<{status:string;locked_by:string}>("select status,locked_by from social_publication_jobs where id='j1'");
    assert.deepEqual(rows[0],{status:"succeeded",locked_by:""});
  } finally { await db.close(); }
});

test("DB publication store releases retries and dead-letters terminal failures", async () => {
  const {db,sql}=await fixture();
  try {
    await seed(sql);
    const store=createPublicationStore(sql,60);
    const now=new Date("2026-09-21T20:00:00Z");
    const job=await store.claim("w",now);
    await store.retry(job!,"temporary",new Date("2026-09-21T20:00:09Z"),now);
    let rows=await sql.query<{status:string;not_before:string}>("select status,not_before from social_publication_jobs where id='j1'");
    assert.equal(rows[0].status,"pending");
    await sql.query("update social_publication_jobs set not_before=$1 where id='j1'",[now.toISOString()]);
    const again=await store.claim("w2",now);
    assert.equal(again?.attemptCount,2);
    await store.dead(again!,"ProviderError","permanent",now);
    rows=await sql.query("select status,failure_class from social_publication_jobs where id='j1'");
    assert.equal((rows[0] as any).status,"dead");
    assert.equal((rows[0] as any).failure_class,"ProviderError");
  } finally { await db.close(); }
});


test("DB publication store refuses unapproved or rejected content", async () => {
  const {db,sql}=await fixture();
  try {
    await seed(sql);
    await sql.query("delete from social_publication_jobs where id='j1'");
    await sql.query(
      "insert into social_content_items(id,project_id,body,media_manifest,status,approval_state) values('i2','p1','pending','[]','draft','pending'),('i3','p1','rejected','[]','rejected','rejected')"
    );
    await sql.query(
      "insert into social_publication_jobs(id,project_id,social_connection_id,content_item_id,idempotency_key,status,max_attempts,not_before) values('j2','p1','c1','i2','idem2','pending',3,'2026-09-21T19:00:00Z'),('j3','p1','c1','i3','idem3','pending',3,'2026-09-21T19:00:00Z')"
    );
    const store=createPublicationStore(sql,60);
    const now=new Date("2026-09-21T20:00:00Z");
    assert.equal(await store.claim("worker",now),null);

    await sql.query("update social_content_items set status='ready',approval_state='approved' where id='i2'");
    const approved=await store.claim("worker",now);
    assert.equal(approved?.id,"j2");
  } finally { await db.close(); }
});

test("DB publication store parks expired ambiguous dispatch instead of republishing", async () => {
  const {db,sql}=await fixture();
  try {
    await seed(sql);
    const store=createPublicationStore(sql,60);
    const started=new Date("2026-09-21T20:00:00Z");
    const job=await store.claim("worker-1",started);
    assert.equal(job?.id,"j1");
    await store.beginDispatch(job!,started);

    const afterLease=new Date("2026-09-21T20:02:00Z");
    assert.equal(await store.claim("worker-2",afterLease),null);

    const rows=await sql.query<{status:string;failure_class:string;attempt_count:number}>(
      "select status,failure_class,attempt_count from social_publication_jobs where id='j1'"
    );
    assert.equal(rows[0].status,"parked");
    assert.equal(rows[0].failure_class,"AmbiguousProviderOutcome");
    assert.equal(Number(rows[0].attempt_count),1);

    const receipts=await sql.query<{status:string}>(
      "select status from social_publication_results where job_id='j1' and attempt_no=1"
    );
    assert.equal(receipts[0].status,"dispatching");
  } finally { await db.close(); }
});
