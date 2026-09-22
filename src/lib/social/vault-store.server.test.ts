import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Sql } from "../db.ts";
import { resolveCredential, rotateCredential, storeCredential } from "./vault-store.server.ts";

async function fixture() {
  const db = new PGlite();
  const dir = new URL("../../../migrations/", import.meta.url).pathname;
  for (const name of (await readdir(dir)).filter((x)=>/^\d+.*\.sql$/.test(x)).sort()) {
    await db.exec(await readFile(join(dir,name),"utf8"));
  }
  const sql = (async <T = Record<string, unknown>>(strings:TemplateStringsArray,...values:unknown[]): Promise<T[]> => {
    let text=strings[0]; for(let i=0;i<values.length;i++) text += `$${i+1}${strings[i+1]}`;
    const result=await db.query<T>(text,values); return result.rows;
  }) as Sql;
  sql.query=async <T = Record<string, unknown>>(text:string,params:unknown[]=[]): Promise<T[]> => {
    const result=await db.query<T>(text,params); return result.rows;
  };
  await sql.query("insert into tenants(id,owner_id,name) values('t1','u1','T1'),('t2','u2','T2')");
  await sql.query("insert into projects(id,owner_id,tenant_id,name) values('p1','u1','t1','P1'),('p2','u2','t2','P2')");
  return {db,sql};
}

test("vault store persists ciphertext, scopes reads and emits secret-free receipts", async () => {
  const {db,sql}=await fixture();
  try {
    const keyring={activeVersion:1,keys:{1:randomBytes(32).toString("base64")}};
    const stored=await storeCredential(sql,keyring,{projectId:"p1",provider:"telegram",label:"channel bot",plaintext:"BOT_SECRET_123",actorRef:"user:u1"});
    const raw=await sql.query<{ciphertext_b64:string}>("select ciphertext_b64 from credential_vault where id=$1",[stored.credentialRef]);
    assert.ok(raw[0].ciphertext_b64);
    assert.equal(raw[0].ciphertext_b64.includes("BOT_SECRET_123"),false);
    assert.equal(await resolveCredential(sql,keyring,{credentialRef:stored.credentialRef,projectId:"p1",actorRef:"worker:w1"}),"BOT_SECRET_123");
    await assert.rejects(()=>resolveCredential(sql,keyring,{credentialRef:stored.credentialRef,projectId:"p2",actorRef:"worker:w2"}),/project scope/);
    const receipts=await sql.query<{operation:string;evidence:string}>("select operation,evidence from operation_receipts where project_id='p1' order by created_at");
    assert.deepEqual(receipts.map((x)=>x.operation),["credential.store","credential.read"]);
    assert.equal(JSON.stringify(receipts).includes("BOT_SECRET_123"),false);
  } finally { await db.close(); }
});

test("vault rotation re-encrypts under the active key version", async () => {
  const {db,sql}=await fixture();
  try {
    const key1=randomBytes(32).toString("base64"), key2=randomBytes(32).toString("base64");
    const initial={activeVersion:1,keys:{1:key1,2:key2}};
    const stored=await storeCredential(sql,initial,{projectId:"p1",provider:"telegram",plaintext:"rotate-me",actorRef:"user:u1"});
    const before=await sql.query<{ciphertext_b64:string}>("select ciphertext_b64 from credential_vault where id=$1",[stored.credentialRef]);
    await rotateCredential(sql,{activeVersion:2,keys:{1:key1,2:key2}},{credentialRef:stored.credentialRef,projectId:"p1",actorRef:"system:rotation"});
    const after=await sql.query<{ciphertext_b64:string;key_version:number}>("select ciphertext_b64,key_version from credential_vault where id=$1",[stored.credentialRef]);
    assert.equal(Number(after[0].key_version),2);
    assert.notEqual(after[0].ciphertext_b64,before[0].ciphertext_b64);
    assert.equal(await resolveCredential(sql,{activeVersion:2,keys:{2:key2}},{credentialRef:stored.credentialRef,projectId:"p1",actorRef:"worker:w"}),"rotate-me");
  } finally { await db.close(); }
});
