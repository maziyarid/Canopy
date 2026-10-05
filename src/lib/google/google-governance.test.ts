import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import type { AccessCtx } from "../server/access.ts";
import {
  activateGoogleConnectionProfile,
  createGoogleConnectionProfile,
  effectiveGoogleGrant,
  grantGoogleCapability,
  revokeGoogleCapability,
} from "./google-connections.server.ts";
import {
  beginGoogleActionExecution,
  completeGoogleAction,
  getGoogleActionProposal,
  proposeGoogleAction,
} from "./google-proposals.server.ts";

async function fixture() {
  const db = new PGlite();
  await db.exec(
    "create table projects(id text primary key,owner_id text not null,domain text not null,data_domain text not null default 'other');" +
    "create table project_access(id text primary key,project_id text not null,user_id text,email text,role text,keyword_filter text default '');" +
    "create table credential_vault(id text primary key,tenant_id text,project_id text not null,provider text not null,label text,key_version integer,algorithm text,nonce_b64 text,ciphertext_b64 text,auth_tag_b64 text,created_by text);" +
    "create table operation_receipts(id text primary key,project_id text,actor_ref text,operation text,target_ref text,status text,approval_ref text default '',idempotency_key text default '',evidence text default '{}',created_at timestamptz default now());" +
    "create table google_connection_profiles(id text primary key,project_id text not null,provider text not null,profile_mode text not null,account_ref text not null default '',credential_ref text not null,auth_type text not null,scopes text not null,resource_bindings text not null,status text not null,token_expires_at timestamptz,last_verified_at timestamptz,created_by text not null,created_at timestamptz default now(),updated_at timestamptz default now());" +
    "create table google_capability_grants(id text primary key,project_id text not null,principal_user_id text not null,role_template text not null default '',provider text not null,capability text not null,resource_type text not null,resource_ref text not null,connection_profile_id text not null,status text not null,expires_at timestamptz,granted_by text not null,grant_receipt_id text not null default '',created_at timestamptz default now(),updated_at timestamptz default now());" +
    "create table google_action_proposals(id text primary key,project_id text not null,actor_ref text not null,connection_profile_id text not null,provider text not null,capability text not null,action text not null,resource_type text not null,resource_ref text not null,payload text not null,payload_hash text not null,deterministic_diff text not null,snapshot_hash text not null default '',approval_policy text not null,approval_ref text not null default '',approval_payload_hash text not null default '',idempotency_key text not null,status text not null,provider_request_id text not null default '',result_receipt text not null default '{}',last_error text not null default '',expires_at timestamptz,approved_at timestamptz,executed_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());"
  );
  await db.query("insert into projects(id,owner_id,domain,data_domain) values($1,$2,$3,$4),($5,$6,$7,$8)", [
    "p1", "owner", "example.com", "other",
    "p2", "owner2", "other.example", "other",
  ]);
  await db.query("insert into project_access(id,project_id,user_id,email,role) values($1,$2,$3,$4,$5),($6,$7,$8,$9,$10)", [
    "m1", "p1", "editor-user", "editor@example.test", "editor",
    "m2", "p1", "client-user", "client@example.test", "client",
  ]);
  await db.query("insert into credential_vault(id,tenant_id,project_id,provider,label,key_version,algorithm,nonce_b64,ciphertext_b64,auth_tag_b64,created_by) values($1,$2,$3,$4,'',1,'aes-256-gcm','n','c','a','owner'),($5,$6,$7,$8,'',1,'aes-256-gcm','n','c','a','owner2')", [
    "cred1", "t1", "p1", "google",
    "cred2", "t2", "p2", "google",
  ]);
  const sql = (async <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let query = strings[0];
    for (let i = 0; i < values.length; i++) query += "$" + (i + 1) + strings[i + 1];
    return (await db.query<T>(query, values)).rows;
  }) as Sql;
  sql.query = async <T = Record<string, unknown>>(query: string, params: unknown[] = []) =>
    (await db.query<T>(query, params)).rows;

  const project = {
    id: "p1", owner_id: "owner", name: "Example", domain: "example.com",
    data_domain: "other" as const, location_id: 1, language_id: 1, platform_id: 1,
    competitors: "", tracking_id: "", notes: "", status: "active", created_at: "",
  };
  const owner: AccessCtx = { role: "owner", filter: "", project };
  const editor: AccessCtx = { role: "editor", filter: "", project };
  const client: AccessCtx = { role: "client", filter: "", project };
  return { db, sql, owner, editor, client };
}

async function activeGscProfile(
  f: Awaited<ReturnType<typeof fixture>>,
  profileMode: "write" | "admin" = "write",
) {
  const created = await createGoogleConnectionProfile(f.sql, f.owner, "owner", {
    provider: "gsc",
    profileMode,
    credentialRef: "cred1",
    authType: "oauth2",
    scopes: ["https://www.googleapis.com/auth/webmasters"],
    resourceBindings: [{ type: "gsc_site", ref: "sc-domain:example.com" }],
  });
  await activateGoogleConnectionProfile(f.sql, f.owner, "owner", created.id);
  return created.id;
}

test("connection profile is project-scoped and accepts only provider allowlisted scopes", async () => {
  const f = await fixture();
  await assert.rejects(
    () => createGoogleConnectionProfile(f.sql, f.owner, "owner", {
      provider: "gsc", profileMode: "write", credentialRef: "cred2",
      scopes: ["https://www.googleapis.com/auth/webmasters"],
      resourceBindings: [{ type: "gsc_site", ref: "sc-domain:example.com" }],
    }),
    /credential_not_in_project_provider_scope/,
  );
  await assert.rejects(
    () => createGoogleConnectionProfile(f.sql, f.owner, "owner", {
      provider: "gsc", profileMode: "write", credentialRef: "cred1",
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      resourceBindings: [{ type: "gsc_site", ref: "sc-domain:example.com" }],
    }),
    /unsupported_google_scope/,
  );
});

test("project ownership does not imply Google write capability", async () => {
  const f = await fixture();
  await activeGscProfile(f);
  await assert.rejects(
    () => effectiveGoogleGrant(f.sql, f.owner, "owner", "gsc.sitemap.submit", "sc-domain:example.com"),
    /google_capability_denied/,
  );
});

test("role template grants only its declared capabilities and exact resource", async () => {
  const f = await fixture();
  const profileId = await activeGscProfile(f);
  await grantGoogleCapability(f.sql, f.owner, "owner", {
    principalUserId: "editor-user",
    roleTemplate: "marketing_editor",
    capability: "google.gsc.sitemap.submit",
    connectionProfileId: profileId,
    resourceType: "gsc_site",
    resourceRef: "sc-domain:example.com",
  });
  const effective = await effectiveGoogleGrant(
    f.sql, f.editor, "editor-user", "gsc.sitemap.submit", "sc-domain:example.com",
  );
  assert.equal(effective.profile.id, profileId);
  await assert.rejects(
    () => effectiveGoogleGrant(f.sql, f.editor, "editor-user", "gsc.site.remove", "sc-domain:example.com"),
    /google_capability_denied/,
  );
  await assert.rejects(
    () => grantGoogleCapability(f.sql, f.owner, "owner", {
      principalUserId: "editor-user",
      roleTemplate: "marketing_editor",
      capability: "google.gsc.site.remove",
      connectionProfileId: profileId,
      resourceType: "gsc_site",
      resourceRef: "sc-domain:example.com",
    }),
    /capability_not_in_role_template/,
  );
});

test("reversible granted action becomes ready and idempotent", async () => {
  const f = await fixture();
  const profileId = await activeGscProfile(f);
  await grantGoogleCapability(f.sql, f.owner, "owner", {
    principalUserId: "editor-user",
    roleTemplate: "marketing_editor",
    capability: "google.gsc.sitemap.submit",
    connectionProfileId: profileId,
    resourceType: "gsc_site",
    resourceRef: "sc-domain:example.com",
  });
  const first = await proposeGoogleAction(f.sql, f.editor, "editor-user", {
    action: "gsc.sitemap.submit",
    resourceRef: "sc-domain:example.com",
    payload: { sitemapUrl: "https://example.com/sitemap.xml" },
    idempotencyKey: "submit-sitemap-1",
  });
  assert.equal(first.proposal.status, "ready");
  assert.equal(first.approvalEnvelope, null);
  const replay = await proposeGoogleAction(f.sql, f.editor, "editor-user", {
    action: "gsc.sitemap.submit",
    resourceRef: "sc-domain:example.com",
    payload: { sitemapUrl: "https://example.com/sitemap.xml" },
    idempotencyKey: "submit-sitemap-1",
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.proposal.id, first.proposal.id);
  await assert.rejects(
    () => proposeGoogleAction(f.sql, f.editor, "editor-user", {
      action: "gsc.sitemap.submit",
      resourceRef: "sc-domain:example.com",
      payload: { sitemapUrl: "https://example.com/other.xml" },
      idempotencyKey: "submit-sitemap-1",
    }),
    /idempotency_key_payload_conflict/,
  );
});

test("high-impact action stays pending until one-time ADA proof is consumed", async () => {
  const f = await fixture();
  const profileId = await activeGscProfile(f, "admin");
  await grantGoogleCapability(f.sql, f.owner, "owner", {
    principalUserId: "client-user",
    roleTemplate: "property_admin",
    capability: "google.gsc.site.remove",
    connectionProfileId: profileId,
    resourceType: "gsc_site",
    resourceRef: "sc-domain:example.com",
  });
  const proposed = await proposeGoogleAction(f.sql, f.client, "client-user", {
    action: "gsc.site.remove",
    resourceRef: "sc-domain:example.com",
    payload: {},
    idempotencyKey: "remove-site-1",
  });
  assert.equal(proposed.proposal.status, "pending_approval");
  assert.equal(proposed.approvalEnvelope?.event_type, "ms_robot.action.proposal");
  assert.equal(proposed.approvalEnvelope?.payload.payload_sha256, proposed.proposal.payloadHash);

  await f.sql.query(
    "update google_action_proposals set approval_request_ref='ticket-1' where id=$1",
    [proposed.proposal.id],
  );

  await assert.rejects(
    () => beginGoogleActionExecution(f.sql, f.client, "client-user", proposed.proposal.id, {}),
    /ada_approval_required/,
  );

  const executing = await beginGoogleActionExecution(
    f.sql,
    f.client,
    "client-user",
    proposed.proposal.id,
    {
      approvalProof: {
        ticketId: "ticket-1",
        oneTimeToken: "one-time-sensitive-token",
        payloadHash: proposed.proposal.payloadHash,
      },
      consumeAdaApproval: async (proposal, proof) => {
        assert.equal(proposal.id, proposed.proposal.id);
        assert.equal(proof.oneTimeToken, "one-time-sensitive-token");
        return { approvalRef: "ada:ticket-1" };
      },
    },
  );
  assert.equal(executing.status, "executing");
  assert.equal(executing.approvalRef, "ada:ticket-1");

  const stored = (await f.db.query<{ approval_ref: string; payload: string }>(
    "select approval_ref,payload from google_action_proposals where id=$1",
    [proposed.proposal.id],
  )).rows[0];
  assert.equal(stored.approval_ref, "ada:ticket-1");
  assert.equal(stored.payload.includes("one-time-sensitive-token"), false);
  const receipts = (await f.db.query<{ evidence: string }>(
    "select evidence from operation_receipts where project_id='p1'",
  )).rows;
  assert.equal(receipts.some((row) => row.evidence.includes("one-time-sensitive-token")), false);

  await completeGoogleAction(f.sql, executing, "client-user", {
    providerRequestId: "provider-request-1",
    result: { ok: true, resource: "sc-domain:example.com" },
  });
  const complete = await getGoogleActionProposal(f.sql, "p1", executing.id);
  assert.equal(complete?.status, "succeeded");
});

test("revoking a grant prevents future proposals", async () => {
  const f = await fixture();
  const profileId = await activeGscProfile(f);
  const grant = await grantGoogleCapability(f.sql, f.owner, "owner", {
    principalUserId: "editor-user",
    capability: "google.gsc.sitemap.submit",
    connectionProfileId: profileId,
    resourceType: "gsc_site",
    resourceRef: "sc-domain:example.com",
  });
  await revokeGoogleCapability(f.sql, f.owner, "owner", grant.id);
  await assert.rejects(
    () => proposeGoogleAction(f.sql, f.editor, "editor-user", {
      action: "gsc.sitemap.submit",
      resourceRef: "sc-domain:example.com",
      payload: { sitemapUrl: "https://example.com/sitemap.xml" },
      idempotencyKey: "after-revoke",
    }),
    /google_capability_denied/,
  );
});
