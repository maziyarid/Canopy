import type { Sql } from "../db.ts";
import type { AccessCtx } from "../server/access.ts";
import {
  googleActionPolicy,
  type GoogleCapability,
  type GoogleProvider,
  type GoogleRoleTemplate,
} from "./google-capabilities.ts";
import {
  actionProvider,
  profileSatisfiesAction,
  validateConnectionBindings,
  validateConnectionScopes,
  validateRoleCapability,
  type GoogleConnectionProfile,
  type GoogleResourceBinding,
} from "./google-governance-core.ts";
import { validateGoogleResourceRef, type GoogleActionKey, type GoogleResourceType } from "./google-actions.ts";

type ProfileRow = {
  id: string;
  project_id: string;
  provider: GoogleProvider;
  profile_mode: "write" | "admin";
  account_ref: string;
  credential_ref: string;
  auth_type: "oauth2" | "service_account";
  scopes: string;
  resource_bindings: string;
  status: GoogleConnectionProfile["status"];
};

type EffectiveGrantRow = {
  grant_id: string;
  principal_user_id: string;
  role_template: string;
  grant_provider: GoogleProvider;
  capability: GoogleCapability;
  resource_type: GoogleResourceType;
  resource_ref: string;
  expires_at: string | null;
  profile_id: string;
  profile_project_id: string;
  profile_provider: GoogleProvider;
  profile_mode: "write" | "admin";
  account_ref: string;
  credential_ref: string;
  auth_type: "oauth2" | "service_account";
  scopes: string;
  resource_bindings: string;
  profile_status: GoogleConnectionProfile["status"];
};

function parseArray(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function parseBindings(raw: string): GoogleResourceBinding[] {
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const out: GoogleResourceBinding[] = [];
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const type = String(row.type || "") as GoogleResourceType;
      const ref = String(row.ref || "");
      try {
        out.push({ type, ref: validateGoogleResourceRef(type, ref) });
      } catch {
        continue;
      }
    }
    return out;
  } catch {
    return [];
  }
}

function profileFromRow(row: ProfileRow): GoogleConnectionProfile {
  return {
    id: row.id,
    projectId: row.project_id,
    provider: row.provider,
    profileMode: row.profile_mode,
    accountRef: row.account_ref,
    credentialRef: row.credential_ref,
    authType: row.auth_type,
    scopes: parseArray(row.scopes),
    resourceBindings: parseBindings(row.resource_bindings),
    status: row.status,
  };
}

async function receipt(
  sql: Sql,
  input: {
    projectId: string;
    actorRef: string;
    operation: string;
    targetRef: string;
    status: string;
    idempotencyKey?: string;
    evidence?: Record<string, unknown>;
  },
) {
  await sql.query(
    "insert into operation_receipts " +
      "(id,project_id,actor_ref,operation,target_ref,status,approval_ref,idempotency_key,evidence) " +
      "values($1,$2,$3,$4,$5,$6,'',$7,$8)",
    [
      crypto.randomUUID(),
      input.projectId,
      input.actorRef,
      input.operation,
      input.targetRef,
      input.status,
      input.idempotencyKey || "",
      JSON.stringify(input.evidence || {}),
    ],
  );
}

function assertOwner(access: AccessCtx) {
  if (access.role !== "owner" || access.filter.trim()) throw new Error("Forbidden");
}

function assertActionMember(access: AccessCtx) {
  if (!["owner", "editor", "client"].includes(access.role) || access.filter.trim()) {
    throw new Error("Forbidden");
  }
}

async function principalInProject(sql: Sql, access: AccessCtx, principalUserId: string) {
  if (access.project.owner_id === principalUserId) return true;
  const rows = await sql.query<{ id: string }>(
    "select id from project_access where project_id=$1 and user_id=$2 limit 1",
    [access.project.id, principalUserId],
  );
  return Boolean(rows[0]);
}

export async function createGoogleConnectionProfile(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
  input: {
    provider: GoogleProvider;
    profileMode: "write" | "admin";
    accountRef?: string;
    credentialRef: string;
    authType?: "oauth2" | "service_account";
    scopes: string[];
    resourceBindings: GoogleResourceBinding[];
  },
) {
  assertOwner(access);
  const scopes = validateConnectionScopes(input.provider, input.scopes);
  const bindings = validateConnectionBindings(input.provider, input.resourceBindings);
  const credentials = await sql.query<{ id: string; provider: string }>(
    "select id,provider from credential_vault where id=$1 and project_id=$2 limit 1",
    [input.credentialRef, access.project.id],
  );
  const credentialProvider = credentials[0]?.provider;
  if (!credentials[0] || ![input.provider, "google:" + input.provider, "google"].includes(credentialProvider)) {
    throw new Error("credential_not_in_project_provider_scope");
  }

  const duplicate = await sql.query<{ id: string }>(
    "select id from google_connection_profiles " +
      "where project_id=$1 and provider=$2 and profile_mode=$3 and account_ref=$4 limit 1",
    [access.project.id, input.provider, input.profileMode, input.accountRef?.trim() || ""],
  );
  if (duplicate[0]) throw new Error("google_connection_profile_exists");

  const id = crypto.randomUUID();
  await sql.query(
    "insert into google_connection_profiles " +
      "(id,project_id,provider,profile_mode,account_ref,credential_ref,auth_type,scopes,resource_bindings,status,created_by) " +
      "values($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10)",
    [
      id,
      access.project.id,
      input.provider,
      input.profileMode,
      input.accountRef?.trim() || "",
      input.credentialRef,
      input.authType || "oauth2",
      JSON.stringify(scopes),
      JSON.stringify(bindings),
      actorRef,
    ],
  );
  await receipt(sql, {
    projectId: access.project.id,
    actorRef,
    operation: "google.connection.create",
    targetRef: id,
    status: "pending",
    evidence: {
      provider: input.provider,
      profileMode: input.profileMode,
      accountRef: input.accountRef?.trim() || "",
      scopes,
      resourceBindings: bindings,
    },
  });
  return { id, status: "pending" as const };
}

export async function activateGoogleConnectionProfile(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
  profileId: string,
) {
  assertOwner(access);
  const rows = await sql.query<ProfileRow>(
    "select * from google_connection_profiles where id=$1 and project_id=$2 limit 1",
    [profileId, access.project.id],
  );
  if (!rows[0] || rows[0].status === "revoked") throw new Error("google_connection_not_found");
  const profile = profileFromRow(rows[0]);
  if (!profile.scopes.length || !profile.resourceBindings.length) throw new Error("google_connection_unverified");

  if (rows[0].status !== "active") {
    const changed = await sql.query<{ id: string }>(
      "update google_connection_profiles set status='active',last_verified_at=now(),updated_at=now() " +
        "where id=$1 and project_id=$2 and status in ('pending','disabled','error') returning id",
      [profileId, access.project.id],
    );
    if (!changed[0]) throw new Error("google_connection_state_conflict");
  }
  await receipt(sql, {
    projectId: access.project.id,
    actorRef,
    operation: "google.connection.activate",
    targetRef: profileId,
    status: "active",
    evidence: {
      provider: profile.provider,
      scopes: profile.scopes,
      resourceBindings: profile.resourceBindings,
    },
  });
  return { id: profileId, status: "active" as const };
}

export async function disableGoogleConnectionProfile(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
  profileId: string,
) {
  assertOwner(access);
  const changed = await sql.query<{ id: string }>(
    "update google_connection_profiles set status='disabled',updated_at=now() " +
      "where id=$1 and project_id=$2 and status='active' returning id",
    [profileId, access.project.id],
  );
  if (!changed[0]) throw new Error("active_google_connection_not_found");
  await sql.query(
    "update google_capability_grants set status='revoked',updated_at=now() " +
      "where project_id=$1 and connection_profile_id=$2 and status='active'",
    [access.project.id, profileId],
  );
  await receipt(sql, {
    projectId: access.project.id,
    actorRef,
    operation: "google.connection.disable",
    targetRef: profileId,
    status: "disabled",
  });
  return { id: profileId, status: "disabled" as const };
}

export async function grantGoogleCapability(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
  input: {
    principalUserId: string;
    roleTemplate?: GoogleRoleTemplate | "";
    capability: GoogleCapability;
    connectionProfileId: string;
    resourceType: GoogleResourceType;
    resourceRef: string;
    expiresAt?: string | null;
  },
) {
  assertOwner(access);
  validateRoleCapability(input.roleTemplate || "", input.capability);
  if (!(await principalInProject(sql, access, input.principalUserId))) throw new Error("principal_not_in_project");

  const profileRows = await sql.query<ProfileRow>(
    "select * from google_connection_profiles where id=$1 and project_id=$2 and status='active' limit 1",
    [input.connectionProfileId, access.project.id],
  );
  if (!profileRows[0]) throw new Error("active_google_connection_required");
  const profile = profileFromRow(profileRows[0]);
  if (profile.provider !== actionProvider(input.capability)) throw new Error("capability_provider_mismatch");

  const resourceRef = validateGoogleResourceRef(input.resourceType, input.resourceRef);
  if (!profile.resourceBindings.some((binding) => binding.type === input.resourceType && binding.ref === resourceRef)) {
    throw new Error("resource_not_bound_to_connection");
  }

  let expiresAt: string | null = null;
  if (input.expiresAt) {
    const timestamp = Date.parse(input.expiresAt);
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) throw new Error("invalid_grant_expiry");
    expiresAt = new Date(timestamp).toISOString();
  }

  const existing = await sql.query<{ id: string }>(
    "select id from google_capability_grants " +
      "where project_id=$1 and principal_user_id=$2 and capability=$3 and connection_profile_id=$4 " +
      "and resource_type=$5 and resource_ref=$6 and status='active' " +
      "and (expires_at is null or expires_at>now()) limit 1",
    [
      access.project.id,
      input.principalUserId,
      input.capability,
      input.connectionProfileId,
      input.resourceType,
      resourceRef,
    ],
  );
  if (existing[0]) return { id: existing[0].id, replayed: true as const };

  const id = crypto.randomUUID();
  const receiptId = crypto.randomUUID();
  await sql.query(
    "insert into google_capability_grants " +
      "(id,project_id,principal_user_id,role_template,provider,capability,resource_type,resource_ref," +
      "connection_profile_id,status,expires_at,granted_by,grant_receipt_id) " +
      "values($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11,$12)",
    [
      id,
      access.project.id,
      input.principalUserId,
      input.roleTemplate || "",
      profile.provider,
      input.capability,
      input.resourceType,
      resourceRef,
      input.connectionProfileId,
      expiresAt,
      actorRef,
      receiptId,
    ],
  );
  await sql.query(
    "insert into operation_receipts " +
      "(id,project_id,actor_ref,operation,target_ref,status,approval_ref,idempotency_key,evidence) " +
      "values($1,$2,$3,'google.capability.grant',$4,'active','',$5,$6)",
    [
      receiptId,
      access.project.id,
      actorRef,
      id,
      "grant:" + id,
      JSON.stringify({
        principalUserId: input.principalUserId,
        capability: input.capability,
        provider: profile.provider,
        resourceType: input.resourceType,
        resourceRef,
        expiresAt,
      }),
    ],
  );
  return { id, replayed: false as const };
}

export async function revokeGoogleCapability(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
  grantId: string,
) {
  assertOwner(access);
  const rows = await sql.query<{ id: string }>(
    "update google_capability_grants set status='revoked',updated_at=now() " +
      "where id=$1 and project_id=$2 and status='active' returning id",
    [grantId, access.project.id],
  );
  if (!rows[0]) throw new Error("active_google_grant_not_found");
  await receipt(sql, {
    projectId: access.project.id,
    actorRef,
    operation: "google.capability.revoke",
    targetRef: grantId,
    status: "revoked",
    idempotencyKey: "revoke:" + grantId,
  });
  return { id: grantId, status: "revoked" as const };
}

export async function effectiveGoogleGrant(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
  action: GoogleActionKey,
  resourceRef: string,
) {
  assertActionMember(access);
  const policy = googleActionPolicy(action);
  if (!policy) throw new Error("unknown_google_action");
  validateGoogleResourceRef(policy.resourceType, resourceRef);

  const rows = await sql.query<EffectiveGrantRow>(
    "select g.id as grant_id,g.principal_user_id,g.role_template,g.provider as grant_provider," +
      "g.capability,g.resource_type,g.resource_ref,g.expires_at," +
      "c.id as profile_id,c.project_id as profile_project_id,c.provider as profile_provider," +
      "c.profile_mode,c.account_ref,c.credential_ref,c.auth_type,c.scopes,c.resource_bindings," +
      "c.status as profile_status " +
      "from google_capability_grants g join google_connection_profiles c " +
      "on c.id=g.connection_profile_id and c.project_id=g.project_id " +
      "where g.project_id=$1 and g.principal_user_id=$2 and g.provider=$3 and g.capability=$4 " +
      "and g.resource_type=$5 and g.resource_ref=$6 and g.status='active' " +
      "and (g.expires_at is null or g.expires_at>now()) and c.status='active' " +
      "order by g.created_at desc limit 1",
    [access.project.id, actorRef, policy.provider, policy.capability, policy.resourceType, resourceRef],
  );
  const row = rows[0];
  if (!row) throw new Error("google_capability_denied");

  const profile: GoogleConnectionProfile = {
    id: row.profile_id,
    projectId: row.profile_project_id,
    provider: row.profile_provider,
    profileMode: row.profile_mode,
    accountRef: row.account_ref,
    credentialRef: row.credential_ref,
    authType: row.auth_type,
    scopes: parseArray(row.scopes),
    resourceBindings: parseBindings(row.resource_bindings),
    status: row.profile_status,
  };
  profileSatisfiesAction(profile, action, resourceRef);
  return { grantId: row.grant_id, profile, policy };
}

export async function listGoogleAccess(sql: Sql, access: AccessCtx) {
  assertOwner(access);
  const [profileRows, grants] = await Promise.all([
    sql.query<ProfileRow>(
      "select * from google_connection_profiles where project_id=$1 order by created_at desc",
      [access.project.id],
    ),
    sql.query<Record<string, unknown>>(
      "select id,project_id,principal_user_id,role_template,provider,capability,resource_type,resource_ref," +
        "connection_profile_id,status,expires_at,granted_by,created_at,updated_at " +
        "from google_capability_grants where project_id=$1 order by created_at desc",
      [access.project.id],
    ),
  ]);
  return {
    profiles: profileRows.map(profileFromRow).map((profile) => {
      const { credentialRef: _credentialRef, ...safe } = profile;
      return safe;
    }),
    grants,
  };
}
