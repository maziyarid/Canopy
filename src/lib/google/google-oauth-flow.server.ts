import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { Sql } from "../db.ts";
import type { AccessCtx } from "../server/access.ts";
import { parseVaultKeyring } from "../social/vault-keyring.server.ts";
import { replaceCredential, storeCredential } from "../social/vault-store.server.ts";
import { validateConnectionScopes, type GoogleResourceBinding } from "./google-governance-core.ts";
import type { GoogleProvider } from "./google-capabilities.ts";

function required(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(name + " is required");
  return value;
}

function assertOwner(access: AccessCtx) {
  if (access.role !== "owner" || access.filter.trim()) throw new Error("Forbidden");
}

function hashState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

const TokenResponse = z.object({
  access_token: z.string().min(20).max(8192),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(20).max(4096),
  scope: z.string().min(1).max(8192),
  token_type: z.string().optional(),
}).passthrough();

export async function beginGoogleOAuthConnection(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
  input: {
    provider: GoogleProvider;
    profileMode: "write" | "publish" | "admin";
    scopes: string[];
  },
  env: NodeJS.ProcessEnv = process.env,
) {
  assertOwner(access);
  const scopes = validateConnectionScopes(input.provider, input.scopes);
  const clientId = required(env, "GOOGLE_WRITE_OAUTH_CLIENT_ID");
  const redirectUri = required(env, "GOOGLE_WRITE_OAUTH_REDIRECT_URI");
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== "https:" && redirect.hostname !== "localhost" && redirect.hostname !== "127.0.0.1") {
    throw new Error("GOOGLE_WRITE_OAUTH_REDIRECT_URI must use https");
  }

  const state = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await sql.query(
    "insert into google_oauth_states " +
      "(state_hash,project_id,actor_ref,provider,profile_mode,requested_scopes,expires_at) " +
      "values($1,$2,$3,$4,$5,$6,$7)",
    [
      hashState(state),
      access.project.id,
      actorRef,
      input.provider,
      input.profileMode,
      JSON.stringify(scopes),
      expiresAt,
    ],
  );

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return { authorizationUrl: url.toString(), expiresAt };
}

type OAuthStateRow = {
  project_id: string;
  actor_ref: string;
  provider: GoogleProvider;
  profile_mode: "write" | "publish" | "admin";
  requested_scopes: string;
};

async function exchangeCode(
  code: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
) {
  const clientId = required(env, "GOOGLE_WRITE_OAUTH_CLIENT_ID");
  const clientSecret = required(env, "GOOGLE_WRITE_OAUTH_CLIENT_SECRET");
  const redirectUri = required(env, "GOOGLE_WRITE_OAUTH_REDIRECT_URI");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  let response: Response;
  try {
    response = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch {
    throw new Error("google_oauth_exchange_unreachable");
  }
  if (!response.ok) throw new Error("google_oauth_exchange_failed_" + response.status);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error("google_oauth_exchange_invalid_json");
  }
  const parsed = TokenResponse.safeParse(json);
  if (!parsed.success) throw new Error("google_oauth_refresh_token_required");
  return parsed.data;
}

export async function completeGoogleOAuthConnection(
  sql: Sql,
  state: string,
  code: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  if (!state || state.length > 200 || !code || code.length > 8192) throw new Error("invalid_google_oauth_callback");

  const claimed = await sql.query<OAuthStateRow>(
    "update google_oauth_states set consumed_at=now() " +
      "where state_hash=$1 and consumed_at is null and expires_at>now() " +
      "returning project_id,actor_ref,provider,profile_mode,requested_scopes",
    [hashState(state)],
  );
  const record = claimed[0];
  if (!record) throw new Error("google_oauth_state_invalid_or_expired");

  let requested: string[];
  try {
    const raw = JSON.parse(record.requested_scopes);
    requested = Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    throw new Error("google_oauth_state_invalid");
  }
  const expected = validateConnectionScopes(record.provider, requested);
  const token = await exchangeCode(code, env, fetchImpl);
  const granted = validateConnectionScopes(record.provider, token.scope.split(/\s+/).filter(Boolean));
  if (!expected.every((scope) => granted.includes(scope))) throw new Error("google_oauth_scope_mismatch");

  const keyring = parseVaultKeyring(env);
  const existing = await sql.query<{ id: string; credential_ref: string }>(
    "select id,credential_ref from google_connection_profiles " +
      "where project_id=$1 and provider=$2 and profile_mode=$3 order by created_at limit 1",
    [record.project_id, record.provider, record.profile_mode],
  );

  let id: string;
  if (existing[0]) {
    id = existing[0].id;
    await replaceCredential(sql, keyring, {
      credentialRef: existing[0].credential_ref,
      projectId: record.project_id,
      provider: "google:" + record.provider,
      plaintext: JSON.stringify({ refreshToken: token.refresh_token }),
      actorRef: record.actor_ref,
    });
    await sql.query(
      "update google_connection_profiles set account_ref='',auth_type='oauth2',scopes=$4," +
        "resource_bindings='[]',status='pending',token_expires_at=$5,last_verified_at=null,updated_at=now() " +
        "where id=$1 and project_id=$2 and provider=$3",
      [
        id,
        record.project_id,
        record.provider,
        JSON.stringify(granted),
        token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
      ],
    );
    await sql.query(
      "update google_capability_grants set status='revoked',updated_at=now() " +
        "where project_id=$1 and connection_profile_id=$2 and status='active'",
      [record.project_id, id],
    );
  } else {
    const stored = await storeCredential(sql, keyring, {
      projectId: record.project_id,
      provider: "google:" + record.provider,
      label: record.profile_mode + " OAuth refresh token",
      plaintext: JSON.stringify({ refreshToken: token.refresh_token }),
      actorRef: record.actor_ref,
    });
    id = crypto.randomUUID();
    await sql.query(
      "insert into google_connection_profiles " +
        "(id,project_id,provider,profile_mode,account_ref,credential_ref,auth_type,scopes,resource_bindings,status,token_expires_at,created_by) " +
        "values($1,$2,$3,$4,'',$5,'oauth2',$6,'[]','pending',$7,$8)",
      [
        id,
        record.project_id,
        record.provider,
        record.profile_mode,
        stored.credentialRef,
        JSON.stringify(granted),
        token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
        record.actor_ref,
      ],
    );
  }
  await sql.query(
    "insert into operation_receipts " +
      "(id,project_id,actor_ref,operation,target_ref,status,approval_ref,idempotency_key,evidence) " +
      "values($1,$2,$3,'google.oauth.connected',$4,'pending','','',$5)",
    [
      crypto.randomUUID(),
      record.project_id,
      record.actor_ref,
      id,
      JSON.stringify({ provider: record.provider, profileMode: record.profile_mode, scopes: granted }),
    ],
  );

  return {
    projectId: record.project_id,
    provider: record.provider,
    profileId: id,
    status: "pending" as const,
  };
}

export function oauthProfileBindings(bindings: GoogleResourceBinding[]) {
  return JSON.stringify(bindings);
}
