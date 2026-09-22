export const CAPABILITY_STATES = [
  "AVAILABLE",
  "TRIAL_OR_SANDBOX",
  "APP_REVIEW_REQUIRED",
  "BUSINESS_VERIFICATION_REQUIRED",
  "LEGAL_ENTITY_REQUIRED",
  "PAYMENT_REQUIRED",
  "COMMERCIAL_CONTRACT_REQUIRED",
  "AUDIT_REQUIRED",
  "UNAVAILABLE",
] as const;

export type CapabilityState = (typeof CAPABILITY_STATES)[number];

export type SocialPlatform = "telegram" | "pinterest" | "instagram" | "facebook_pages" | "threads" | "linkedin" | "x" | "reddit" | "youtube" | "tiktok";

export type PlatformCapability = {
  platform: SocialPlatform;
  defaultState: CapabilityState;
  contentTypes: readonly string[];
  authMethod: string;
  commercialGate: string;
  evidenceRef: string;
};

export type PublicationJobState =
  | "pending" | "approved" | "running" | "published" | "retryable" | "blocked" | "failed" | "cancelled";

export type PublicationReceipt = {
  jobId: string;
  attempt: number;
  providerPostId?: string;
  providerUrl?: string;
  status: PublicationJobState;
  publishedAt?: string;
  readBackAt?: string;
};
