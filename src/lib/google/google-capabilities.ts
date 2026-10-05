export const GOOGLE_PROVIDERS = ["gsc", "ga4", "gtm", "google_ads"] as const;
export type GoogleProvider = (typeof GOOGLE_PROVIDERS)[number];

export const GOOGLE_CAPABILITIES = [
  "google.gsc.read",
  "google.gsc.sitemap.submit",
  "google.gsc.sitemap.delete",
  "google.gsc.site.add",
  "google.gsc.site.remove",
  "google.gtm.read",
  "google.gtm.workspace.create",
  "google.gtm.entity.write",
  "google.gtm.version.create",
  "google.gtm.publish",
  "google.gtm.user.manage",
  "google.ga4.read",
  "google.ga4.config.write",
  "google.ga4.user.manage",
  "google.ads.read",
  "google.ads.campaign.write",
  "google.ads.budget.write",
  "google.ads.publish",
] as const;
export type GoogleCapability = (typeof GOOGLE_CAPABILITIES)[number];

export type GoogleApprovalPolicy = "grant" | "ada";
export type GoogleMutationType =
  | "WRITE"
  | "DELETE"
  | "PUBLISH"
  | "POLICY_CHANGE"
  | "CANONICAL_OWNERSHIP"
  | "BUDGET_WRITE";

export type GoogleActionKey =
  | "gsc.sitemap.submit"
  | "gsc.sitemap.delete"
  | "gsc.site.add"
  | "gsc.site.remove"
  | "gtm.workspace.create"
  | "gtm.tag.create"
  | "gtm.tag.update"
  | "gtm.tag.delete"
  | "gtm.version.create"
  | "gtm.version.publish"
  | "gtm.user.create"
  | "gtm.user.update"
  | "gtm.user.delete"
  | "ga4.custom_dimension.create"
  | "ga4.key_event.create"
  | "ga4.access_binding.create"
  | "ga4.access_binding.update"
  | "ga4.access_binding.delete"
  | "ads.campaign.create_paused"
  | "ads.campaign.update"
  | "ads.campaign.enable"
  | "ads.budget.create"
  | "ads.budget.update";

export type GoogleActionPolicy = {
  provider: GoogleProvider;
  capability: GoogleCapability;
  requiredScopes: readonly string[];
  approval: GoogleApprovalPolicy;
  mutationType: GoogleMutationType;
  resourceType: "gsc_site" | "gtm_account" | "gtm_container" | "ga4_property" | "ads_customer";
  requiresDeveloperToken?: boolean;
};

const WEBMASTERS = "https://www.googleapis.com/auth/webmasters";
const GTM_EDIT = "https://www.googleapis.com/auth/tagmanager.edit.containers";
const GTM_VERSION = "https://www.googleapis.com/auth/tagmanager.edit.containerversions";
const GTM_PUBLISH = "https://www.googleapis.com/auth/tagmanager.publish";
const GTM_USERS = "https://www.googleapis.com/auth/tagmanager.manage.users";
const ANALYTICS_EDIT = "https://www.googleapis.com/auth/analytics.edit";
const ANALYTICS_USERS = "https://www.googleapis.com/auth/analytics.manage.users";
const ADS = "https://www.googleapis.com/auth/adwords";

export const GOOGLE_ACTION_POLICIES: Readonly<Record<GoogleActionKey, GoogleActionPolicy>> = {
  "gsc.sitemap.submit": {
    provider: "gsc", capability: "google.gsc.sitemap.submit", requiredScopes: [WEBMASTERS],
    approval: "grant", mutationType: "WRITE", resourceType: "gsc_site",
  },
  "gsc.sitemap.delete": {
    provider: "gsc", capability: "google.gsc.sitemap.delete", requiredScopes: [WEBMASTERS],
    approval: "ada", mutationType: "DELETE", resourceType: "gsc_site",
  },
  "gsc.site.add": {
    provider: "gsc", capability: "google.gsc.site.add", requiredScopes: [WEBMASTERS],
    approval: "ada", mutationType: "CANONICAL_OWNERSHIP", resourceType: "gsc_site",
  },
  "gsc.site.remove": {
    provider: "gsc", capability: "google.gsc.site.remove", requiredScopes: [WEBMASTERS],
    approval: "ada", mutationType: "DELETE", resourceType: "gsc_site",
  },
  "gtm.workspace.create": {
    provider: "gtm", capability: "google.gtm.workspace.create", requiredScopes: [GTM_EDIT],
    approval: "grant", mutationType: "WRITE", resourceType: "gtm_container",
  },
  "gtm.tag.create": {
    provider: "gtm", capability: "google.gtm.entity.write", requiredScopes: [GTM_EDIT],
    approval: "grant", mutationType: "WRITE", resourceType: "gtm_container",
  },
  "gtm.tag.update": {
    provider: "gtm", capability: "google.gtm.entity.write", requiredScopes: [GTM_EDIT],
    approval: "grant", mutationType: "WRITE", resourceType: "gtm_container",
  },
  "gtm.tag.delete": {
    provider: "gtm", capability: "google.gtm.entity.write", requiredScopes: [GTM_EDIT],
    approval: "ada", mutationType: "DELETE", resourceType: "gtm_container",
  },
  "gtm.version.create": {
    provider: "gtm", capability: "google.gtm.version.create", requiredScopes: [GTM_VERSION],
    approval: "grant", mutationType: "WRITE", resourceType: "gtm_container",
  },
  "gtm.version.publish": {
    provider: "gtm", capability: "google.gtm.publish", requiredScopes: [GTM_PUBLISH],
    approval: "ada", mutationType: "PUBLISH", resourceType: "gtm_container",
  },
  "gtm.user.create": {
    provider: "gtm", capability: "google.gtm.user.manage", requiredScopes: [GTM_USERS],
    approval: "ada", mutationType: "POLICY_CHANGE", resourceType: "gtm_account",
  },
  "gtm.user.update": {
    provider: "gtm", capability: "google.gtm.user.manage", requiredScopes: [GTM_USERS],
    approval: "ada", mutationType: "POLICY_CHANGE", resourceType: "gtm_account",
  },
  "gtm.user.delete": {
    provider: "gtm", capability: "google.gtm.user.manage", requiredScopes: [GTM_USERS],
    approval: "ada", mutationType: "DELETE", resourceType: "gtm_container",
  },
  "ga4.custom_dimension.create": {
    provider: "ga4", capability: "google.ga4.config.write", requiredScopes: [ANALYTICS_EDIT],
    approval: "grant", mutationType: "WRITE", resourceType: "ga4_property",
  },
  "ga4.key_event.create": {
    provider: "ga4", capability: "google.ga4.config.write", requiredScopes: [ANALYTICS_EDIT],
    approval: "grant", mutationType: "WRITE", resourceType: "ga4_property",
  },
  "ga4.access_binding.create": {
    provider: "ga4", capability: "google.ga4.user.manage", requiredScopes: [ANALYTICS_USERS],
    approval: "ada", mutationType: "POLICY_CHANGE", resourceType: "ga4_property",
  },
  "ga4.access_binding.update": {
    provider: "ga4", capability: "google.ga4.user.manage", requiredScopes: [ANALYTICS_USERS],
    approval: "ada", mutationType: "POLICY_CHANGE", resourceType: "ga4_property",
  },
  "ga4.access_binding.delete": {
    provider: "ga4", capability: "google.ga4.user.manage", requiredScopes: [ANALYTICS_USERS],
    approval: "ada", mutationType: "DELETE", resourceType: "ga4_property",
  },
  "ads.campaign.create_paused": {
    provider: "google_ads", capability: "google.ads.campaign.write", requiredScopes: [ADS],
    approval: "ada", mutationType: "WRITE", resourceType: "ads_customer", requiresDeveloperToken: true,
  },
  "ads.campaign.update": {
    provider: "google_ads", capability: "google.ads.campaign.write", requiredScopes: [ADS],
    approval: "ada", mutationType: "WRITE", resourceType: "ads_customer", requiresDeveloperToken: true,
  },
  "ads.campaign.enable": {
    provider: "google_ads", capability: "google.ads.publish", requiredScopes: [ADS],
    approval: "ada", mutationType: "PUBLISH", resourceType: "ads_customer", requiresDeveloperToken: true,
  },
  "ads.budget.create": {
    provider: "google_ads", capability: "google.ads.budget.write", requiredScopes: [ADS],
    approval: "ada", mutationType: "BUDGET_WRITE", resourceType: "ads_customer", requiresDeveloperToken: true,
  },
  "ads.budget.update": {
    provider: "google_ads", capability: "google.ads.budget.write", requiredScopes: [ADS],
    approval: "ada", mutationType: "BUDGET_WRITE", resourceType: "ads_customer", requiresDeveloperToken: true,
  },
};

export const GOOGLE_ROLE_TEMPLATES = {
  client_viewer: ["google.gsc.read", "google.ga4.read", "google.gtm.read", "google.ads.read"],
  marketing_analyst: ["google.gsc.read", "google.ga4.read", "google.gtm.read", "google.ads.read"],
  marketing_editor: [
    "google.gsc.read", "google.gsc.sitemap.submit", "google.ga4.read", "google.ga4.config.write",
    "google.gtm.read", "google.gtm.workspace.create", "google.gtm.entity.write", "google.gtm.version.create",
    "google.ads.read",
  ],
  marketing_publisher: [
    "google.gsc.read", "google.gsc.sitemap.submit", "google.ga4.read", "google.ga4.config.write",
    "google.gtm.read", "google.gtm.workspace.create", "google.gtm.entity.write", "google.gtm.version.create",
    "google.gtm.publish", "google.ads.read",
  ],
  property_admin: [
    "google.gsc.read", "google.gsc.sitemap.submit", "google.gsc.sitemap.delete", "google.gsc.site.add",
    "google.gsc.site.remove", "google.ga4.read", "google.ga4.config.write", "google.ga4.user.manage",
    "google.gtm.read", "google.gtm.workspace.create", "google.gtm.entity.write", "google.gtm.version.create",
    "google.gtm.publish", "google.gtm.user.manage",
  ],
  ads_manager: ["google.ads.read", "google.ads.campaign.write", "google.ads.budget.write", "google.ads.publish"],
} as const satisfies Record<string, readonly GoogleCapability[]>;

export type GoogleRoleTemplate = keyof typeof GOOGLE_ROLE_TEMPLATES;

export function googleActionPolicy(action: string): GoogleActionPolicy | null {
  return Object.prototype.hasOwnProperty.call(GOOGLE_ACTION_POLICIES, action)
    ? GOOGLE_ACTION_POLICIES[action as GoogleActionKey]
    : null;
}

export function scopesSatisfy(granted: readonly string[], required: readonly string[]) {
  const actual = new Set(granted.map((scope) => scope.trim()).filter(Boolean));
  return required.every((scope) => actual.has(scope));
}
