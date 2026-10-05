import { z } from "zod";
import type { Sql } from "../db.ts";
import type { AccessCtx } from "../server/access.ts";
import { parseVaultKeyring } from "../social/vault-keyring.server.ts";
import { resolveCredential } from "../social/vault-store.server.ts";
import { validateConnectionBindings, type GoogleResourceBinding } from "./google-governance-core.ts";
import { parseGoogleOAuthCredential, refreshGoogleAccessToken } from "./google-oauth.server.ts";
import type { GoogleProvider } from "./google-capabilities.ts";

type ProfileRow = {
  id: string;
  project_id: string;
  provider: GoogleProvider;
  credential_ref: string;
  auth_type: string;
  status: string;
};

export type DiscoveredGoogleResource = {
  type: GoogleResourceBinding["type"];
  ref: string;
  label: string;
  parentRef?: string;
};

function assertOwner(access: AccessCtx) {
  if (access.role !== "owner" || access.filter.trim()) throw new Error("Forbidden");
}

const HOSTS = new Set([
  "www.googleapis.com",
  "analyticsadmin.googleapis.com",
  "tagmanager.googleapis.com",
  "googleads.googleapis.com",
]);

function safeLabel(value: unknown) {
  const label = String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return label.slice(0, 200);
}

async function getJson(
  url: string,
  accessToken: string,
  input: { developerToken?: string; loginCustomerId?: string; fetchImpl?: typeof fetch } = {},
) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !HOSTS.has(parsed.hostname)) throw new Error("google_discovery_url_denied");
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: "Bearer " + accessToken,
  };
  if (parsed.hostname === "googleads.googleapis.com") {
    const developerToken = input.developerToken?.trim();
    if (!developerToken) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN is required");
    headers["developer-token"] = developerToken;
    if (input.loginCustomerId) headers["login-customer-id"] = input.loginCustomerId.replace(/\D/g, "");
  }
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(parsed, { method: "GET", headers, cache: "no-store" });
  } catch {
    throw new Error("google_discovery_unreachable");
  }
  if (!response.ok) throw new Error("google_discovery_http_" + response.status);
  const raw = await response.text();
  if (Buffer.byteLength(raw) > 512_000) throw new Error("google_discovery_response_too_large");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("google_discovery_invalid_json");
  }
}

async function profile(sql: Sql, projectId: string, profileId: string) {
  const rows = await sql.query<ProfileRow>(
    "select id,project_id,provider,credential_ref,auth_type,status " +
      "from google_connection_profiles where id=$1 and project_id=$2 limit 1",
    [profileId, projectId],
  );
  const row = rows[0];
  if (!row || row.status === "revoked" || row.status === "disabled") throw new Error("google_connection_not_found");
  if (row.auth_type !== "oauth2") throw new Error("google_write_auth_type_unsupported");
  return row;
}

export async function discoverGoogleResources(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
  profileId: string,
  dependencies: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {},
) {
  assertOwner(access);
  const p = await profile(sql, access.project.id, profileId);
  const env = dependencies.env ?? process.env;
  const keyring = parseVaultKeyring(env);
  const plaintext = await resolveCredential(sql, keyring, {
    credentialRef: p.credential_ref,
    projectId: access.project.id,
    actorRef: "google-discovery:" + actorRef,
  });
  const credential = parseGoogleOAuthCredential(plaintext);
  const token = await refreshGoogleAccessToken(credential, env, dependencies.fetchImpl ?? fetch);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const resources: DiscoveredGoogleResource[] = [];

  if (p.provider === "gsc") {
    const payload = z.object({ siteEntry: z.array(z.object({
      siteUrl: z.string(), permissionLevel: z.string().optional(),
    }).passthrough()).optional() }).passthrough().parse(
      await getJson("https://www.googleapis.com/webmasters/v3/sites", token.accessToken, { fetchImpl }),
    );
    for (const site of (payload.siteEntry ?? []).slice(0, 500)) {
      if (!site.siteUrl) continue;
      resources.push({ type: "gsc_site", ref: site.siteUrl, label: site.siteUrl });
    }
  } else if (p.provider === "ga4") {
    const payload = z.object({ accountSummaries: z.array(z.object({
      account: z.string().optional(), displayName: z.string().optional(),
      propertySummaries: z.array(z.object({
        property: z.string().optional(), displayName: z.string().optional(),
      }).passthrough()).optional(),
    }).passthrough()).optional() }).passthrough().parse(
      await getJson("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", token.accessToken, { fetchImpl }),
    );
    for (const account of (payload.accountSummaries ?? []).slice(0, 200)) {
      for (const property of (account.propertySummaries ?? []).slice(0, 500)) {
        if (!property.property) continue;
        resources.push({
          type: "ga4_property",
          ref: property.property,
          label: safeLabel(property.displayName) || property.property,
          ...(account.account ? { parentRef: account.account } : {}),
        });
      }
    }
  } else if (p.provider === "gtm") {
    const accountsPayload = z.object({ account: z.array(z.object({
      accountId: z.string().optional(), name: z.string().optional(), path: z.string().optional(),
    }).passthrough()).optional() }).passthrough().parse(
      await getJson("https://tagmanager.googleapis.com/tagmanager/v2/accounts", token.accessToken, { fetchImpl }),
    );
    for (const account of (accountsPayload.account ?? []).slice(0, 100)) {
      const accountPath = account.path || (account.accountId ? "accounts/" + account.accountId : "");
      if (!accountPath) continue;
      resources.push({
        type: "gtm_account",
        ref: accountPath,
        label: safeLabel(account.name) || accountPath,
      });
      const containersPayload = z.object({ container: z.array(z.object({
        path: z.string().optional(), name: z.string().optional(),
      }).passthrough()).optional() }).passthrough().parse(
        await getJson("https://tagmanager.googleapis.com/tagmanager/v2/" + accountPath + "/containers", token.accessToken, { fetchImpl }),
      );
      for (const container of (containersPayload.container ?? []).slice(0, 500)) {
        if (!container.path) continue;
        resources.push({
          type: "gtm_container",
          ref: container.path,
          label: safeLabel(container.name) || container.path,
          parentRef: accountPath,
        });
      }
    }
  } else {
    const payload = z.object({ resourceNames: z.array(z.string()).optional() }).passthrough().parse(
      await getJson("https://googleads.googleapis.com/v25/customers:listAccessibleCustomers", token.accessToken, {
        fetchImpl,
        developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
        loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
      }),
    );
    for (const ref of (payload.resourceNames ?? []).slice(0, 500)) {
      if (!/^customers\/\d+$/.test(ref)) continue;
      resources.push({ type: "ads_customer", ref, label: ref });
    }
  }

  return resources.filter((resource, index, all) =>
    all.findIndex((candidate) => candidate.type === resource.type && candidate.ref === resource.ref) === index);
}

export async function bindGoogleConnectionResources(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
  profileId: string,
  requestedBindings: GoogleResourceBinding[],
  dependencies: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {},
) {
  assertOwner(access);
  const p = await profile(sql, access.project.id, profileId);
  const requested = validateConnectionBindings(p.provider, requestedBindings);
  const discovered = await discoverGoogleResources(sql, access, actorRef, profileId, dependencies);
  const allowed = new Set(discovered.map((item) => item.type + "\n" + item.ref));
  if (requested.some((binding) => !allowed.has(binding.type + "\n" + binding.ref))) {
    throw new Error("google_resource_not_discovered");
  }
  const accountRefs = [...new Set(discovered
    .filter((item) => requested.some((binding) => binding.type === item.type && binding.ref === item.ref))
    .map((item) => item.parentRef || (item.type === "gtm_account" ? item.ref : ""))
    .filter(Boolean))];
  const accountRef = accountRefs.length === 1 ? accountRefs[0] : "";

  const rows = await sql.query<{ id: string }>(
    "update google_connection_profiles set resource_bindings=$3,account_ref=$4,updated_at=now() " +
      "where id=$1 and project_id=$2 and status in ('pending','error') returning id",
    [profileId, access.project.id, JSON.stringify(requested), accountRef],
  );
  if (!rows[0]) throw new Error("google_connection_state_conflict");
  await sql.query(
    "insert into operation_receipts " +
      "(id,project_id,actor_ref,operation,target_ref,status,approval_ref,idempotency_key,evidence) " +
      "values($1,$2,$3,'google.connection.bind_resources',$4,'pending','','',$5)",
    [
      crypto.randomUUID(), access.project.id, actorRef, profileId,
      JSON.stringify({ provider: p.provider, resourceBindings: requested, accountRef }),
    ],
  );
  return { profileId, resourceBindings: requested, accountRef };
}
