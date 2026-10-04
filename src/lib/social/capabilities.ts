import type { PlatformCapability, SocialPlatform } from "./contracts";

export const PLATFORM_CAPABILITIES: Record<SocialPlatform, PlatformCapability> = {
  telegram: { platform: "telegram", defaultState: "AVAILABLE", contentTypes: ["text","image","video","document","media_group"], authMethod: "bot_token", commercialGate: "workspace_channel_authorisation", evidenceRef: "AAX-72" },
  pinterest: { platform: "pinterest", defaultState: "TRIAL_OR_SANDBOX", contentTypes: ["pin_image","pin_video"], authMethod: "oauth2", commercialGate: "standard_access", evidenceRef: "AAX-73" },
  instagram: { platform: "instagram", defaultState: "APP_REVIEW_REQUIRED", contentTypes: ["image","video","carousel","reel"], authMethod: "meta_oauth", commercialGate: "advanced_access_and_review", evidenceRef: "AAX-74" },
  facebook_pages: { platform: "facebook_pages", defaultState: "APP_REVIEW_REQUIRED", contentTypes: ["text","image","video","link"], authMethod: "meta_oauth", commercialGate: "page_permissions_and_review", evidenceRef: "AAX-74" },
  threads: { platform: "threads", defaultState: "APP_REVIEW_REQUIRED", contentTypes: ["text","image","video","carousel"], authMethod: "threads_oauth", commercialGate: "review_as_required", evidenceRef: "AAX-74" },
  linkedin: { platform: "linkedin", defaultState: "LEGAL_ENTITY_REQUIRED", contentTypes: ["text","image","video","article"], authMethod: "oauth2", commercialGate: "community_management_approval", evidenceRef: "AAX-75" },
  x: { platform: "x", defaultState: "PAYMENT_REQUIRED", contentTypes: ["text","image","video","link"], authMethod: "oauth_user_context", commercialGate: "prepaid_api_credits", evidenceRef: "AAX-76" },
  reddit: { platform: "reddit", defaultState: "COMMERCIAL_CONTRACT_REQUIRED", contentTypes: ["text","link","image"], authMethod: "oauth2", commercialGate: "commercial_permission", evidenceRef: "AAX-77" },
  youtube: { platform: "youtube", defaultState: "AUDIT_REQUIRED", contentTypes: ["video","short"], authMethod: "google_oauth", commercialGate: "project_audit_for_public_uploads", evidenceRef: "AAX-78" },
  tiktok: { platform: "tiktok", defaultState: "AUDIT_REQUIRED", contentTypes: ["video","photo"], authMethod: "oauth2", commercialGate: "content_posting_audit", evidenceRef: "AAX-78" },
};

export function capabilityFor(platform: SocialPlatform) {
  return PLATFORM_CAPABILITIES[platform];
}

export function canAttemptProductionPublish(platform: SocialPlatform, verifiedState?: string) {
  return verifiedState === "AVAILABLE" || (!verifiedState && PLATFORM_CAPABILITIES[platform].defaultState === "AVAILABLE");
}
