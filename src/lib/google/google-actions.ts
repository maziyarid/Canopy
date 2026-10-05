import { createHash } from "node:crypto";
import { z } from "zod";
import { googleActionPolicy, type GoogleActionKey } from "./google-capabilities.ts";

const text = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().regex(/^\d+$/);
const gscSite = z.string().max(500).refine((value) =>
  value.startsWith("sc-domain:") || /^https?:\/\//i.test(value), "invalid GSC site");
const gtmAccount = z.string().regex(/^accounts\/\d+$/);
const gtmContainer = z.string().regex(/^accounts\/\d+\/containers\/\d+$/);
const gtmWorkspace = z.string().regex(/^accounts\/\d+\/containers\/\d+\/workspaces\/\d+$/);
const gtmTag = z.string().regex(/^accounts\/\d+\/containers\/\d+\/workspaces\/\d+\/tags\/\d+$/);
const gtmVersion = z.string().regex(/^accounts\/\d+\/containers\/\d+\/versions\/\d+$/);
const gtmUserPermission = z.string().regex(/^accounts\/\d+\/user_permissions\/\d+$/);
const ga4Property = z.string().regex(/^properties\/\d+$/);
const ga4Binding = z.string().regex(/^properties\/\d+\/accessBindings\/[^/]+$/);
const adsCustomer = z.string().regex(/^customers\/\d+$/);
const adsCampaign = z.string().regex(/^customers\/\d+\/campaigns\/\d+$/);
const adsBudget = z.string().regex(/^customers\/\d+\/campaignBudgets\/\d+$/);

const tagParameter = z.object({
  type: text(80),
  key: z.string().trim().max(120).optional(),
  value: z.string().max(4000).optional(),
}).strict();

const gtmTagBody = z.object({
  name: text(200),
  type: text(120),
  parameter: z.array(tagParameter).max(100).default([]),
  firingTriggerId: z.array(text(80)).max(50).default([]),
  blockingTriggerId: z.array(text(80)).max(50).default([]),
  notes: z.string().max(2000).optional(),
}).strict();

const gaRoles = z.array(z.enum([
  "predefinedRoles/viewer",
  "predefinedRoles/analyst",
  "predefinedRoles/editor",
  "predefinedRoles/admin",
  "predefinedRoles/no-cost-data",
  "predefinedRoles/no-revenue-data",
])).min(1).max(6);

const schemas: Record<GoogleActionKey, z.ZodTypeAny> = {
  "gsc.sitemap.submit": z.object({ sitemapUrl: z.string().url().max(2000) }).strict(),
  "gsc.sitemap.delete": z.object({ sitemapUrl: z.string().url().max(2000) }).strict(),
  "gsc.site.add": z.object({}).strict(),
  "gsc.site.remove": z.object({}).strict(),

  "gtm.workspace.create": z.object({ name: text(200), description: z.string().max(2000).optional() }).strict(),
  "gtm.tag.create": z.object({ workspacePath: gtmWorkspace, tag: gtmTagBody }).strict(),
  "gtm.tag.update": z.object({ tagPath: gtmTag, fingerprint: text(200).optional(), tag: gtmTagBody }).strict(),
  "gtm.tag.delete": z.object({ tagPath: gtmTag, fingerprint: text(200).optional() }).strict(),
  "gtm.version.create": z.object({ workspacePath: gtmWorkspace, name: text(200), notes: z.string().max(2000).optional() }).strict(),
  "gtm.version.publish": z.object({ versionPath: gtmVersion, fingerprint: text(200).optional() }).strict(),
  "gtm.user.create": z.object({
    emailAddress: z.string().email().max(200),
    accountPermission: z.enum(["noAccess", "user", "admin"]),
    containerAccess: z.array(z.object({
      containerId: id,
      permission: z.enum(["noAccess", "read", "edit", "approve", "publish"]),
    }).strict()).max(100).default([]),
  }).strict(),
  "gtm.user.update": z.object({
    permissionPath: gtmUserPermission,
    emailAddress: z.string().email().max(200),
    accountPermission: z.enum(["noAccess", "user", "admin"]),
    containerAccess: z.array(z.object({
      containerId: id,
      permission: z.enum(["noAccess", "read", "edit", "approve", "publish"]),
    }).strict()).max(100).default([]),
  }).strict(),
  "gtm.user.delete": z.object({ permissionPath: gtmUserPermission }).strict(),

  "ga4.custom_dimension.create": z.object({
    parameterName: text(80).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    displayName: text(82),
    description: z.string().max(150).optional(),
    scope: z.enum(["EVENT", "USER"]),
    disallowAdsPersonalization: z.boolean().optional(),
  }).strict(),
  "ga4.key_event.create": z.object({ eventName: text(40) }).strict(),
  "ga4.access_binding.create": z.object({ emailAddress: z.string().email().max(200), roles: gaRoles }).strict(),
  "ga4.access_binding.update": z.object({ bindingName: ga4Binding, roles: gaRoles }).strict(),
  "ga4.access_binding.delete": z.object({ bindingName: ga4Binding }).strict(),

  "ads.campaign.create_paused": z.object({
    name: text(255),
    budgetResourceName: adsBudget,
    advertisingChannelType: z.enum(["SEARCH", "DISPLAY", "PERFORMANCE_MAX"]),
    containsEuPoliticalAdvertising: z.enum([
      "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
      "CONTAINS_EU_POLITICAL_ADVERTISING",
    ]),
  }).strict(),
  "ads.campaign.update": z.object({
    campaignResourceName: adsCampaign,
    name: text(255).optional(),
  }).strict().refine((value) => Boolean(value.name), "no campaign fields supplied"),
  "ads.campaign.enable": z.object({ campaignResourceName: adsCampaign }).strict(),
  "ads.budget.create": z.object({
    name: text(255),
    amountMicros: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  }).strict(),
  "ads.budget.update": z.object({
    budgetResourceName: adsBudget,
    amountMicros: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  }).strict(),
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export function canonicalGooglePayload(payload: unknown) {
  return JSON.stringify(canonical(payload));
}

export function googlePayloadHash(payload: unknown) {
  return createHash("sha256").update(canonicalGooglePayload(payload)).digest("hex");
}

function parentOf(path: string, segment: string) {
  const marker = `/${segment}/`;
  const index = path.indexOf(marker);
  return index < 0 ? "" : path.slice(0, index);
}

export const GOOGLE_RESOURCE_TYPES = ["gsc_site", "gtm_account", "gtm_container", "ga4_property", "ads_customer"] as const;
export type GoogleResourceType = "gsc_site" | "gtm_account" | "gtm_container" | "ga4_property" | "ads_customer";

export function validateGoogleResourceRef(resourceType: GoogleResourceType, resourceRef: string) {
  if (resourceType === "gsc_site") return gscSite.parse(resourceRef);
  if (resourceType === "gtm_account") return gtmAccount.parse(resourceRef);
  if (resourceType === "gtm_container") return gtmContainer.parse(resourceRef);
  if (resourceType === "ga4_property") return ga4Property.parse(resourceRef);
  return adsCustomer.parse(resourceRef);
}

export type GoogleActionContract = {
  action: GoogleActionKey;
  resourceRef: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  deterministicDiff: {
    operation: "create" | "update" | "delete" | "publish";
    resourceRef: string;
    fields: Record<string, unknown>;
  };
};

export function validateGoogleAction(action: GoogleActionKey, resourceRef: string, rawPayload: unknown): GoogleActionContract {
  const policy = googleActionPolicy(action);
  if (!policy) throw new Error("unknown_google_action");

  validateGoogleResourceRef(policy.resourceType, resourceRef);

  const payload = schemas[action].parse(rawPayload) as Record<string, unknown>;

  if (action.startsWith("gtm.")) {
    const ref = String(
      payload.workspacePath ?? payload.tagPath ?? payload.versionPath ?? payload.permissionPath ?? "",
    );
    if (ref) {
      const expected = policy.resourceType === "gtm_account"
        ? resourceRef
        : resourceRef;
      const actual = policy.resourceType === "gtm_account"
        ? ref.split("/user_permissions/")[0]
        : parentOf(ref, "workspaces") || parentOf(ref, "versions");
      if (actual !== expected) throw new Error("google_resource_scope_mismatch");
    }
  }
  if (action.startsWith("ga4.access_binding.")) {
    const binding = String(payload.bindingName ?? "");
    if (binding && binding.split("/accessBindings/")[0] !== resourceRef) {
      throw new Error("google_resource_scope_mismatch");
    }
  }
  if (action.startsWith("ads.")) {
    const embedded = String(payload.campaignResourceName ?? payload.budgetResourceName ?? "");
    if (embedded && embedded.split(/\/(?:campaigns|campaignBudgets)\//)[0] !== resourceRef) {
      throw new Error("google_resource_scope_mismatch");
    }
  }

  const operation =
    action.endsWith(".delete") || action.endsWith(".remove") ? "delete" :
    action.endsWith(".publish") || action.endsWith(".enable") ? "publish" :
    action.includes(".update") ? "update" : "create";

  return {
    action,
    resourceRef,
    payload,
    payloadHash: googlePayloadHash(payload),
    deterministicDiff: { operation, resourceRef, fields: payload },
  };
}

export type PreparedGoogleRequest = {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  extraHeaders?: Record<string, string>;
};

const enc = encodeURIComponent;

export function prepareGoogleRequest(contract: GoogleActionContract, adsApiVersion = "v25"): PreparedGoogleRequest {
  const { action, resourceRef, payload } = contract;
  switch (action) {
    case "gsc.sitemap.submit":
      return { method: "PUT", url: `https://www.googleapis.com/webmasters/v3/sites/${enc(resourceRef)}/sitemaps/${enc(String(payload.sitemapUrl))}` };
    case "gsc.sitemap.delete":
      return { method: "DELETE", url: `https://www.googleapis.com/webmasters/v3/sites/${enc(resourceRef)}/sitemaps/${enc(String(payload.sitemapUrl))}` };
    case "gsc.site.add":
      return { method: "PUT", url: `https://www.googleapis.com/webmasters/v3/sites/${enc(resourceRef)}` };
    case "gsc.site.remove":
      return { method: "DELETE", url: `https://www.googleapis.com/webmasters/v3/sites/${enc(resourceRef)}` };

    case "gtm.workspace.create":
      return { method: "POST", url: `https://tagmanager.googleapis.com/tagmanager/v2/${resourceRef}/workspaces`, body: payload };
    case "gtm.tag.create": {
      const { workspacePath, tag } = payload;
      return { method: "POST", url: `https://tagmanager.googleapis.com/tagmanager/v2/${workspacePath}/tags`, body: tag };
    }
    case "gtm.tag.update": {
      const { tagPath, fingerprint, tag } = payload;
      return {
        method: "PUT",
        url: `https://tagmanager.googleapis.com/tagmanager/v2/${tagPath}${fingerprint ? `?fingerprint=${enc(String(fingerprint))}` : ""}`,
        body: tag,
      };
    }
    case "gtm.tag.delete": {
      const { tagPath, fingerprint } = payload;
      return { method: "DELETE", url: `https://tagmanager.googleapis.com/tagmanager/v2/${tagPath}${fingerprint ? `?fingerprint=${enc(String(fingerprint))}` : ""}` };
    }
    case "gtm.version.create": {
      const { workspacePath, name, notes } = payload;
      return { method: "POST", url: `https://tagmanager.googleapis.com/tagmanager/v2/${workspacePath}:create_version`, body: { name, ...(notes ? { notes } : {}) } };
    }
    case "gtm.version.publish": {
      const { versionPath, fingerprint } = payload;
      return { method: "POST", url: `https://tagmanager.googleapis.com/tagmanager/v2/${versionPath}:publish${fingerprint ? `?fingerprint=${enc(String(fingerprint))}` : ""}` };
    }
    case "gtm.user.create":
      return {
        method: "POST",
        url: `https://tagmanager.googleapis.com/tagmanager/v2/${resourceRef}/user_permissions`,
        body: {
          emailAddress: payload.emailAddress,
          accountAccess: { permission: payload.accountPermission },
          containerAccess: payload.containerAccess,
        },
      };
    case "gtm.user.update":
      return {
        method: "PUT",
        url: `https://tagmanager.googleapis.com/tagmanager/v2/${payload.permissionPath}`,
        body: {
          emailAddress: payload.emailAddress,
          accountAccess: { permission: payload.accountPermission },
          containerAccess: payload.containerAccess,
        },
      };
    case "gtm.user.delete":
      return { method: "DELETE", url: `https://tagmanager.googleapis.com/tagmanager/v2/${payload.permissionPath}` };

    case "ga4.custom_dimension.create": {
      const { parameterName, displayName, description, scope, disallowAdsPersonalization } = payload;
      return {
        method: "POST",
        url: `https://analyticsadmin.googleapis.com/v1beta/${resourceRef}/customDimensions`,
        body: { parameterName, displayName, ...(description ? { description } : {}), scope, ...(disallowAdsPersonalization === undefined ? {} : { disallowAdsPersonalization }) },
      };
    }
    case "ga4.key_event.create":
      return { method: "POST", url: `https://analyticsadmin.googleapis.com/v1beta/${resourceRef}/keyEvents`, body: { eventName: payload.eventName } };
    case "ga4.access_binding.create":
      return { method: "POST", url: `https://analyticsadmin.googleapis.com/v1alpha/${resourceRef}/accessBindings`, body: { user: payload.emailAddress, roles: payload.roles } };
    case "ga4.access_binding.update":
      return { method: "PATCH", url: `https://analyticsadmin.googleapis.com/v1alpha/${payload.bindingName}`, body: { roles: payload.roles } };
    case "ga4.access_binding.delete":
      return { method: "DELETE", url: `https://analyticsadmin.googleapis.com/v1alpha/${payload.bindingName}` };

    case "ads.campaign.create_paused":
      return {
        method: "POST",
        url: `https://googleads.googleapis.com/${adsApiVersion}/${resourceRef}/campaigns:mutate`,
        body: { operations: [{ create: {
          name: payload.name,
          campaignBudget: payload.budgetResourceName,
          advertisingChannelType: payload.advertisingChannelType,
          status: "PAUSED",
          manualCpc: {},
          containsEuPoliticalAdvertising: payload.containsEuPoliticalAdvertising,
        } }], partialFailure: false, validateOnly: false },
      };
    case "ads.campaign.update":
      return {
        method: "POST",
        url: `https://googleads.googleapis.com/${adsApiVersion}/${resourceRef}/campaigns:mutate`,
        body: { operations: [{ update: { resourceName: payload.campaignResourceName, name: payload.name }, updateMask: "name" }], partialFailure: false, validateOnly: false },
      };
    case "ads.campaign.enable":
      return {
        method: "POST",
        url: `https://googleads.googleapis.com/${adsApiVersion}/${resourceRef}/campaigns:mutate`,
        body: { operations: [{ update: { resourceName: payload.campaignResourceName, status: "ENABLED" }, updateMask: "status" }], partialFailure: false, validateOnly: false },
      };
    case "ads.budget.create":
      return {
        method: "POST",
        url: `https://googleads.googleapis.com/${adsApiVersion}/${resourceRef}/campaignBudgets:mutate`,
        body: { operations: [{ create: { name: payload.name, amountMicros: String(payload.amountMicros), deliveryMethod: "STANDARD" } }], partialFailure: false, validateOnly: false },
      };
    case "ads.budget.update":
      return {
        method: "POST",
        url: `https://googleads.googleapis.com/${adsApiVersion}/${resourceRef}/campaignBudgets:mutate`,
        body: { operations: [{ update: { resourceName: payload.budgetResourceName, amountMicros: String(payload.amountMicros) }, updateMask: "amount_micros" }], partialFailure: false, validateOnly: false },
      };
  }
}
