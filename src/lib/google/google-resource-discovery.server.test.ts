import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import type { AccessCtx } from "../server/access.ts";
import { storeCredential } from "../social/vault-store.server.ts";
import { discoverGoogleResources, bindGoogleConnectionResources } from "./google-resource-discovery.server.ts";

async function fixture(provider:"gsc"|"ga4"|"gtm"|"google_ads") {
  const db=new PGlite();
  await db.exec(
    "create table projects(id text primary key,owner_id text,tenant_id text,domain text,data_domain text);" +
    "create table credential_vault(id text primary key,tenant_id text not null,project_id text not null,provider text not null,label text not null default '',key_version integer not null,algorithm text not null,nonce_b64 text not null,ciphertext_b64 text not null,auth_tag_b64 text not null,created_by text not null,created_at timestamptz default now(),updated_at timestamptz default now());" +
    "create table operation_receipts(id text primary key,project_id text,actor_ref text,operation text,target_ref text,status text,approval_ref text,idempotency_key text,evidence text,created_at timestamptz default now());" +
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
  const key=randomBytes(32).toString("base64");
  const stored=await storeCredential(sql,{activeVersion:1,keys:{1:key}},{projectId:"p1",provider:"google:"+provider,label:"oauth",plaintext:JSON.stringify({refreshToken:"r".repeat(40)}),actorRef:"owner"});
  await db.query("insert into google_connection_profiles(id,project_id,provider,profile_mode,account_ref,credential_ref,auth_type,scopes,resource_bindings,status,created_by) values('profile','p1',$1,'write','',$2,'oauth2','[]','[]','pending','owner')",[provider,stored.credentialRef]);
  const env={
    MAZ_ROBOT_VAULT_ACTIVE_VERSION:"1",MAZ_ROBOT_VAULT_KEYS:JSON.stringify({"1":key}),
    GOOGLE_WRITE_OAUTH_CLIENT_ID:"client",GOOGLE_WRITE_OAUTH_CLIENT_SECRET:"secret",
    GOOGLE_ADS_DEVELOPER_TOKEN:"developer",
  } as NodeJS.ProcessEnv;
  return {db,sql,owner,env};
}

test("GSC discovery returns only server-observed sites and binding rejects forged site", async () => {
  const f=await fixture("gsc");
  const fetchImpl=async (url:string|URL|Request)=>{
    if(String(url)==="https://oauth2.googleapis.com/token") return new Response(JSON.stringify({access_token:"a".repeat(40),expires_in:3600}),{status:200,headers:{"Content-Type":"application/json"}});
    return new Response(JSON.stringify({siteEntry:[{siteUrl:"sc-domain:example.com",permissionLevel:"siteFullUser"}]}),{status:200,headers:{"Content-Type":"application/json"}});
  };
  const resources=await discoverGoogleResources(f.sql,f.owner,"owner","profile",{env:f.env,fetchImpl:fetchImpl as typeof fetch});
  assert.deepEqual(resources.map(x=>x.ref),["sc-domain:example.com"]);
  await assert.rejects(
    ()=>bindGoogleConnectionResources(f.sql,f.owner,"owner","profile",[{type:"gsc_site",ref:"sc-domain:evil.example"}],{env:f.env,fetchImpl:fetchImpl as typeof fetch}),
    /not_discovered/,
  );
  const bound=await bindGoogleConnectionResources(f.sql,f.owner,"owner","profile",[{type:"gsc_site",ref:"sc-domain:example.com"}],{env:f.env,fetchImpl:fetchImpl as typeof fetch});
  assert.equal(bound.resourceBindings[0].ref,"sc-domain:example.com");
});

test("GTM discovery exposes account and container as distinct resource scopes", async () => {
  const f=await fixture("gtm");
  const fetchImpl=async (url:string|URL|Request)=>{
    const raw=String(url);
    if(raw==="https://oauth2.googleapis.com/token") return new Response(JSON.stringify({access_token:"a".repeat(40),expires_in:3600}),{status:200,headers:{"Content-Type":"application/json"}});
    if(raw.endsWith("/tagmanager/v2/accounts")) return new Response(JSON.stringify({account:[{accountId:"1",name:"Account",path:"accounts/1"}]}),{status:200,headers:{"Content-Type":"application/json"}});
    return new Response(JSON.stringify({container:[{path:"accounts/1/containers/2",name:"Web"}]}),{status:200,headers:{"Content-Type":"application/json"}});
  };
  const resources=await discoverGoogleResources(f.sql,f.owner,"owner","profile",{env:f.env,fetchImpl:fetchImpl as typeof fetch});
  assert.deepEqual(resources.map(x=>[x.type,x.ref]),[["gtm_account","accounts/1"],["gtm_container","accounts/1/containers/2"]]);
});
