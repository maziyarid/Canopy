import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import type { AccessCtx } from "../server/access.ts";
import { storeCredential } from "../social/vault-store.server.ts";
import {
  activateGoogleConnectionProfile,
  createGoogleConnectionProfile,
  grantGoogleCapability,
  revokeGoogleCapability,
} from "./google-connections.server.ts";
import { proposeGoogleAction } from "./google-proposals.server.ts";
import { executeGovernedGoogleAction } from "./google-executor.server.ts";

async function fixture() {
  const db = new PGlite();
  await db.exec(
    "create table projects(id text primary key,owner_id text not null,tenant_id text not null,domain text not null,data_domain text not null default 'other');" +
    "create table project_access(id text primary key,project_id text not null,user_id text,email text,role text,keyword_filter text default '');" +
    "create table credential_vault(id text primary key,tenant_id text not null,project_id text not null,provider text not null,label text not null default '',key_version integer not null,algorithm text not null,nonce_b64 text not null,ciphertext_b64 text not null,auth_tag_b64 text not null,created_by text not null,created_at timestamptz default now(),updated_at timestamptz default now());" +
    "create table operation_receipts(id text primary key,project_id text,actor_ref text,operation text,target_ref text,status text,approval_ref text default '',idempotency_key text default '',evidence text default '{}',created_at timestamptz default now());" +
    "create table google_connection_profiles(id text primary key,project_id text not null,provider text not null,profile_mode text not null,account_ref text not null default '',credential_ref text not null,auth_type text not null,scopes text not null,resource_bindings text not null,status text not null,token_expires_at timestamptz,last_verified_at timestamptz,created_by text not null,created_at timestamptz default now(),updated_at timestamptz default now());" +
    "create table google_capability_grants(id text primary key,project_id text not null,principal_user_id text not null,role_template text not null default '',provider text not null,capability text not null,resource_type text not null,resource_ref text not null,connection_profile_id text not null,status text not null,expires_at timestamptz,granted_by text not null,grant_receipt_id text not null default '',created_at timestamptz default now(),updated_at timestamptz default now());" +
    "create table google_action_proposals(id text primary key,project_id text not null,actor_ref text not null,connection_profile_id text not null,provider text not null,capability text not null,action text not null,resource_type text not null,resource_ref text not null,payload text not null,payload_hash text not null,deterministic_diff text not null,snapshot_hash text not null default '',approval_policy text not null,approval_ref text not null default '',approval_payload_hash text not null default '',idempotency_key text not null,status text not null,provider_request_id text not null default '',result_receipt text not null default '{}',last_error text not null default '',expires_at timestamptz,approved_at timestamptz,executed_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());"
  );
  await db.query("insert into projects(id,owner_id,tenant_id,domain,data_domain) values($1,$2,$3,$4,$5)", ["p1","owner","t1","example.com","other"]);
  await db.query("insert into project_access(id,project_id,user_id,email,role) values($1,$2,$3,$4,$5)", ["m1","p1","editor","e@example.test","editor"]);

  const sql = (async <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let query = strings[0];
    for (let i = 0; i < values.length; i++) query += "$" + (i + 1) + strings[i + 1];
    return (await db.query<T>(query, values)).rows;
  }) as Sql;
  sql.query = async <T = Record<string, unknown>>(query: string, params: unknown[] = []) => (await db.query<T>(query, params)).rows;

  const project = {
    id:"p1",owner_id:"owner",name:"Example",domain:"example.com",data_domain:"other" as const,
    location_id:1,language_id:1,platform_id:1,competitors:"",tracking_id:"",notes:"",status:"active",created_at:"",
  };
  const owner: AccessCtx={role:"owner",filter:"",project};
  const editor: AccessCtx={role:"editor",filter:"",project};
  const key=randomBytes(32).toString("base64");
  const keyring={activeVersion:1,keys:{1:key}};
  const stored=await storeCredential(sql,keyring,{projectId:"p1",provider:"google:gsc",label:"write",plaintext:JSON.stringify({refreshToken:"r".repeat(40)}),actorRef:"owner"});
  const profile=await createGoogleConnectionProfile(sql,owner,"owner",{
    provider:"gsc",profileMode:"write",credentialRef:stored.credentialRef,authType:"oauth2",
    scopes:["https://www.googleapis.com/auth/webmasters"],
    resourceBindings:[{type:"gsc_site",ref:"sc-domain:example.com"}],
  });
  await activateGoogleConnectionProfile(sql,owner,"owner",profile.id);
  const grant=await grantGoogleCapability(sql,owner,"owner",{
    principalUserId:"editor",roleTemplate:"marketing_editor",capability:"google.gsc.sitemap.submit",
    connectionProfileId:profile.id,resourceType:"gsc_site",resourceRef:"sc-domain:example.com",
  });
  return {db,sql,owner,editor,key,profileId:profile.id,grantId:grant.id};
}

test("executor decrypts project credential only server-side and completes a granted mutation", async () => {
  const f=await fixture();
  const proposed=await proposeGoogleAction(f.sql,f.editor,"editor",{
    action:"gsc.sitemap.submit",resourceRef:"sc-domain:example.com",
    payload:{sitemapUrl:"https://example.com/sitemap.xml"},idempotencyKey:"exec-1",
  });
  const calls:string[]=[];
  const fetchImpl=async (url:string|URL|Request,init?:RequestInit)=>{
    calls.push(String(url));
    if(String(url)==="https://oauth2.googleapis.com/token"){
      return new Response(JSON.stringify({access_token:"a".repeat(40),expires_in:3600}),{status:200,headers:{"Content-Type":"application/json"}});
    }
    assert.equal((init?.headers as Record<string,string>).Authorization,"Bearer "+"a".repeat(40));
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{"Content-Type":"application/json","request-id":"gsc-req"}});
  };
  const result=await executeGovernedGoogleAction(f.sql,f.editor,"editor",proposed.proposal.id,{},{
    env:{
      MAZ_ROBOT_VAULT_ACTIVE_VERSION:"1",MAZ_ROBOT_VAULT_KEYS:JSON.stringify({"1":f.key}),
      GOOGLE_WRITE_OAUTH_CLIENT_ID:"client",GOOGLE_WRITE_OAUTH_CLIENT_SECRET:"secret",
    } as NodeJS.ProcessEnv,
    fetchImpl:fetchImpl as typeof fetch,
  });
  assert.equal(result.status,"succeeded");
  assert.equal(result.providerRequestId,"gsc-req");
  assert.equal(calls.length,2);
  const stored=(await f.db.query<{status:string;result_receipt:string}>("select status,result_receipt from google_action_proposals where id=$1",[proposed.proposal.id])).rows[0];
  assert.equal(stored.status,"succeeded");
  assert.equal(stored.result_receipt.includes("rrrr"),false);
  assert.equal(stored.result_receipt.includes("aaaa"),false);
});

test("executor rechecks grant before decrypting credential", async () => {
  const f=await fixture();
  const proposed=await proposeGoogleAction(f.sql,f.editor,"editor",{
    action:"gsc.sitemap.submit",resourceRef:"sc-domain:example.com",
    payload:{sitemapUrl:"https://example.com/sitemap.xml"},idempotencyKey:"exec-revoke",
  });
  await revokeGoogleCapability(f.sql,f.owner,"owner",f.grantId);
  let called=false;
  await assert.rejects(
    ()=>executeGovernedGoogleAction(f.sql,f.editor,"editor",proposed.proposal.id,{},{
      env:{} as NodeJS.ProcessEnv,
      fetchImpl:(async()=>{called=true; return new Response("{}")}) as typeof fetch,
    }),
    /google_capability_denied/,
  );
  assert.equal(called,false);
});

test("missing vault/OAuth configuration fails closed and records failed execution", async () => {
  const f=await fixture();
  const proposed=await proposeGoogleAction(f.sql,f.editor,"editor",{
    action:"gsc.sitemap.submit",resourceRef:"sc-domain:example.com",
    payload:{sitemapUrl:"https://example.com/sitemap.xml"},idempotencyKey:"exec-missing-env",
  });
  await assert.rejects(
    ()=>executeGovernedGoogleAction(f.sql,f.editor,"editor",proposed.proposal.id,{},{
      env:{} as NodeJS.ProcessEnv,
      fetchImpl:(async()=>new Response("{}")) as typeof fetch,
    }),
    /vault key version/,
  );
  const stored=(await f.db.query<{status:string;last_error:string}>("select status,last_error from google_action_proposals where id=$1",[proposed.proposal.id])).rows[0];
  assert.equal(stored.status,"failed");
  assert.match(stored.last_error,/vault key version/);
});
