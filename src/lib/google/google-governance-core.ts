import { createHash } from "node:crypto";
import {
  GOOGLE_CAPABILITIES,
  GOOGLE_ROLE_TEMPLATES,
  googleActionPolicy,
  scopesSatisfy,
  type GoogleCapability,
  type GoogleProvider,
  type GoogleRoleTemplate,
  type GoogleActionKey,
} from "./google-capabilities.ts";
import {
  canonicalGooglePayload,
  validateGoogleResourceRef,
  type GoogleActionContract,
  type GoogleResourceType,
} from "./google-actions.ts";

export type GoogleResourceBinding = { type: GoogleResourceType; ref: string };

export type GoogleConnectionProfile = {
  id: string;
  projectId: string;
  provider: GoogleProvider;
  profileMode: "write" | "admin";
  accountRef: string;
  credentialRef: string;
  authType: "oauth2" | "service_account";
  scopes: string[];
  resourceBindings: GoogleResourceBinding[];
  status: "pending" | "active" | "disabled" | "revoked" | "error";
};

export const GOOGLE_PROVIDER_RESOURCE_TYPES: Record<GoogleProvider, readonly GoogleResourceType[]> = {
  gsc: ["gsc_site"],
  ga4: ["ga4_property"],
  gtm: ["gtm_account", "gtm_container"],
  google_ads: ["ads_customer"],
};

export const GOOGLE_ALLOWED_SCOPES: Record<GoogleProvider, ReadonlySet<string>> = {
  gsc: new Set([
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/webmasters",
  ]),
  ga4: new Set([
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/analytics.edit",
    "https://www.googleapis.com/auth/analytics.manage.users",
  ]),
  gtm: new Set([
    "https://www.googleapis.com/auth/tagmanager.readonly",
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
    "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
    "https://www.googleapis.com/auth/tagmanager.publish",
    "https://www.googleapis.com/auth/tagmanager.manage.users",
    "https://www.googleapis.com/auth/tagmanager.manage.accounts",
  ]),
  google_ads: new Set(["https://www.googleapis.com/auth/adwords"]),
};

const SECRETISH = /(?:bearer\s+|-----BEGIN\s|\bya29\.|\bAIza|client[_-]?secret|refresh[_-]?token|private[_-]?key)/i;

export function uniqueSafeStrings(values: readonly string[], max = 32) {
  if (values.length > max) throw new Error("too_many_values");
  const out = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
  if (out.some((value) => value.length > 300 || SECRETISH.test(value))) throw new Error("unsafe_value");
  return out;
}

export function validateConnectionBindings(provider: GoogleProvider, bindings: readonly GoogleResourceBinding[]) {
  if (!bindings.length || bindings.length > 100) throw new Error("resource_bindings_required");
  const allowed = new Set(GOOGLE_PROVIDER_RESOURCE_TYPES[provider]);
  const canonical: GoogleResourceBinding[] = [];
  for (const binding of bindings) {
    if (!allowed.has(binding.type)) throw new Error("invalid_resource_type_for_provider");
    canonical.push({ type: binding.type, ref: validateGoogleResourceRef(binding.type, binding.ref) });
  }
  return canonical.filter((binding, index, rows) =>
    rows.findIndex((item) => item.type === binding.type && item.ref === binding.ref) === index);
}

export function validateConnectionScopes(provider: GoogleProvider, rawScopes: readonly string[]) {
  const scopes = uniqueSafeStrings(rawScopes);
  if (!scopes.length || scopes.some((scope) => !GOOGLE_ALLOWED_SCOPES[provider].has(scope))) {
    throw new Error("unsupported_google_scope");
  }
  return scopes;
}

export function validateRoleCapability(roleTemplate: GoogleRoleTemplate | "", capability: GoogleCapability) {
  if (!GOOGLE_CAPABILITIES.includes(capability)) throw new Error("unknown_google_capability");
  if (!roleTemplate) return;
  const allowed = new Set<GoogleCapability>(GOOGLE_ROLE_TEMPLATES[roleTemplate]);
  if (!allowed.has(capability)) throw new Error("capability_not_in_role_template");
}

export function actionProvider(capability: GoogleCapability): GoogleProvider {
  const segment = capability.split(".")[1];
  return segment === "ads" ? "google_ads" : segment as GoogleProvider;
}

export function profileSatisfiesAction(profile: GoogleConnectionProfile, action: GoogleActionKey, resourceRef: string) {
  const policy = googleActionPolicy(action);
  if (!policy) throw new Error("unknown_google_action");
  if (profile.status !== "active") throw new Error("active_google_connection_required");
  if (profile.provider !== policy.provider) throw new Error("capability_provider_mismatch");
  if (!scopesSatisfy(profile.scopes, policy.requiredScopes)) throw new Error("google_scope_denied");
  if (!profile.resourceBindings.some((binding) => binding.type === policy.resourceType && binding.ref === resourceRef)) {
    throw new Error("google_resource_binding_denied");
  }
  return policy;
}

export type GoogleGovernedProposal = {
  id: string;
  projectId: string;
  actorRef: string;
  connectionProfileId: string;
  provider: GoogleProvider;
  capability: GoogleCapability;
  action: GoogleActionKey;
  resourceType: GoogleResourceType;
  resourceRef: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  deterministicDiff: GoogleActionContract["deterministicDiff"];
  snapshotHash: string;
  approvalPolicy: "grant" | "ada";
  approvalRef: string;
  approvalRequestRef: string;
  idempotencyKey: string;
  status: "pending" | "pending_approval" | "ready" | "executing" | "succeeded" | "failed" | "rejected" | "cancelled" | "expired";
  expiresAt: string | null;
};

export function deterministicDiffHash(diff: unknown) {
  return createHash("sha256").update(canonicalGooglePayload(diff)).digest("hex");
}

export function googleApprovalEnvelope(proposal: GoogleGovernedProposal, siteKey: string, mutationType: string) {
  return {
    schema_version: 1,
    idempotency_key: "google-approval:" + proposal.id,
    source: "ms_robot.google",
    target: "ada",
    event_type: "ms_robot.action.proposal",
    correlation_id: proposal.id,
    project_key: proposal.projectId,
    site_key: siteKey,
    sensitivity: "internal",
    payload: {
      action_ref: proposal.id,
      provider: proposal.provider,
      capability: proposal.capability,
      action: proposal.action,
      resource_type: proposal.resourceType,
      resource_ref: proposal.resourceRef,
      payload_sha256: proposal.payloadHash,
      diff_sha256: deterministicDiffHash(proposal.deterministicDiff),
      mutation_type: mutationType,
      expires_at: proposal.expiresAt,
    },
  };
}

const PRIVATE_RESULT_KEYS = /^(?:email|emailAddress|user|refreshToken|refresh_token|accessToken|access_token|idToken|id_token|clientSecret|client_secret|authorization|cookie)$/i;

function minimiseReceipt(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => minimiseReceipt(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      if (PRIVATE_RESULT_KEYS.test(key)) {
        out[key] = "<redacted>";
        continue;
      }
      out[key] = minimiseReceipt(item, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") {
    if (SECRETISH.test(value)) return "<redacted>";
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "<redacted-email>";
    return value.slice(0, 2000);
  }
  return value;
}

export function safeGoogleReceipt(value: unknown) {
  const json = canonicalGooglePayload(minimiseReceipt(value));
  if (json.length > 16000 || SECRETISH.test(json)) throw new Error("unsafe_google_result_receipt");
  return json;
}

export function safeGoogleError(error: string) {
  return error.replace(SECRETISH, "<redacted>").replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "<redacted-email>").slice(0, 1000);
}
