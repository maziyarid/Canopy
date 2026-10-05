import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import type { AccessCtx } from "../server/access.ts";
import { beginGoogleOAuthConnection, completeGoogleOAuthConnection, googleOAuthReturnUrl } from "./google-oauth-flow.server.ts";

async function fixture() {
  const db=new PGlite();
  await db.exec(
    "create table projects(id text primary key,owner_id text,tenant_id text,domain text,data_domain text);" +
    "create table credential_vault(id text primary key,tenant_id text not null,project_id text not null,provider text not null,label text not null default '',key_version integer not null,algorithm text not null,nonce_b64 text not null,ciphertext_b64 text not null,auth_tag_b64 text not null,created_by text not null,created_at timestamptz default now(),updated_at timestamptz default now());" +
    "create table operation_receipts(id text primary key,project_id text,actor_ref text,operation text,target_ref text,status text,approval_ref text,idempotency_key text,evidence text,created_at timestamptz default now());" +
    "create table google_oauth_states(state_hash text primary key,project_id text,actor_ref text,provider text,profile_mode text,requested_scopes text,expires_at timestamptz,consumed_at timestamptz,created_at timestamptz default now());" +
    "create table google_connection_profiles(id text primary key,project_id text,provider text,profile_mode text,account_ref text,credential_ref text,auth_type text,scopes text,resource_bindings text,status text,token_expires_at timestamptz,last_verified_at timestamptz,created_by text,created_at timestamptz default now(),updated_at timestamptz default now());"
  );
  await db.query("insert into projects(id,owner_id,tenant_id,domain,data_domain) values('p1','owner','t1','example.com','other')");
  const sql=(async<T=Record<string,unknown>>(strings:TemplateStringsArray,...values:unknown[])=>{
    let q=strings[0]; for(let i=0;i<values.length;i++)q+="$"+(i+1)+strings[i+1];
    return (await db.query<T>(q,values)).rows;
  }) as Sql;
  sql.query=async<T=Record<string,unknown>>(q:string,p:unknown[]=[])=>(await db.query<T>(q,p)).rows;
  const project={id:"p1",owner_id:"owner",name:"Example",domain:"example.com",data_domain:"other" as const,location_id:1,language_id:1,platform_id:1,competitors:"",tracking_id:"",notes:"",status:"active",created_at:""};
  const owner:AccessCtx={role:"owner",filter:"",project};
  return {db,sql,owner};
}

test("OAuth callback return URL uses the configured public HTTPS origin behind a proxy", () => {
  const result=googleOAuthReturnUrl(
    "http://127.0.0.1:9140/api/google/oauth/callback?state=x&code=y",
    "connected",
    "project a",
    { BETTER_AUTH_URL:"https://canopy.maziyarid.com" } as NodeJS.ProcessEnv,
  );
  assert.equal(result,"https://canopy.maziyarid.com/p/project%20a?googleOAuth=connected");

  assert.throws(
    ()=>googleOAuthReturnUrl(
      "http://127.0.0.1:9140/api/google/oauth/callback",
      "error",
      undefined,
      { BETTER_AUTH_URL:"http://public.example.test" } as NodeJS.ProcessEnv,
    ),
    /must use https/,
  );
});

test("OAuth start is owner-only, bounded to allowed scopes and uses offline consent", async () => {
  const f=await fixture();
  const result=await beginGoogleOAuthConnection(f.sql,f.owner,"owner",{
    provider:"gtm",profileMode:"write",scopes:["https://www.googleapis.com/auth/tagmanager.edit.containers"],
  },{
    GOOGLE_WRITE_OAUTH_CLIENT_ID:"client-id",
    GOOGLE_WRITE_OAUTH_REDIRECT_URI:"https://app.example.test/api/google/oauth/callback",
  } as NodeJS.ProcessEnv);
  const url=new URL(result.authorizationUrl);
  assert.equal(url.hostname,"accounts.google.com");
  assert.equal(url.searchParams.get("access_type"),"offline");
  assert.equal(url.searchParams.get("prompt"),"consent");
  assert.ok(url.searchParams.get("state"));
  const rows=(await f.db.query<{state_hash:string}>("select state_hash from google_oauth_states")).rows;
  assert.equal(rows.length,1);
  assert.notEqual(rows[0].state_hash,url.searchParams.get("state"));
});

test("OAuth callback consumes state once, verifies granted scopes and encrypts refresh token", async () => {
  const f=await fixture();
  const key=randomBytes(32).toString("base64");
  const env={
    GOOGLE_WRITE_OAUTH_CLIENT_ID:"client-id",
    GOOGLE_WRITE_OAUTH_CLIENT_SECRET:"client-secret",
    GOOGLE_WRITE_OAUTH_REDIRECT_URI:"https://app.example.test/api/google/oauth/callback",
    MAZ_ROBOT_VAULT_ACTIVE_VERSION:"1",
    MAZ_ROBOT_VAULT_KEYS:JSON.stringify({"1":key}),
  } as NodeJS.ProcessEnv;
  const start=await beginGoogleOAuthConnection(f.sql,f.owner,"owner",{
    provider:"gsc",profileMode:"write",scopes:["https://www.googleapis.com/auth/webmasters"],
  },env);
  const state=new URL(start.authorizationUrl).searchParams.get("state")!;
  const fetchImpl=async()=>new Response(JSON.stringify({
    access_token:"a".repeat(40),refresh_token:"r".repeat(40),expires_in:3600,
    scope:"https://www.googleapis.com/auth/webmasters",token_type:"Bearer",
  }),{status:200,headers:{"Content-Type":"application/json"}});
  const connected=await completeGoogleOAuthConnection(f.sql,state,"auth-code",env,fetchImpl as typeof fetch);
  assert.equal(connected.status,"pending");
  const vault=(await f.db.query<{ciphertext_b64:string}>("select ciphertext_b64 from credential_vault")).rows;
  assert.equal(vault.length,1);
  assert.equal(vault[0].ciphertext_b64.includes("rrrr"),false);
  const profile=(await f.db.query<{resource_bindings:string;status:string}>("select resource_bindings,status from google_connection_profiles")).rows[0];
  assert.equal(profile.resource_bindings,"[]");
  assert.equal(profile.status,"pending");
  await assert.rejects(
    ()=>completeGoogleOAuthConnection(f.sql,state,"auth-code-2",env,fetchImpl as typeof fetch),
    /state_invalid_or_expired/,
  );
});
