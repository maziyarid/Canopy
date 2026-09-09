export type Lang = "en" | "fa";

export type Role = "owner" | "editor" | "client";

export type KeywordStatus = "new" | "tracked" | "briefed" | "ignored";

export type ProjectTab =
  | "overview"
  | "keywords"
  | "tracker"
  | "research"
  | "agents"
  | "access"
  | "progress"
  | "connect";

export type Project = {
  id: string;
  ownerId: string;
  name: string;
  domain: string;
  locationId: number;
  languageId: number;
  platformId: number;
  competitors: string;
  trackingId: string;
  notes: string;
  status: string;
  createdAt: string;
  role: Role;
  keywordFilter: string;
  keywordCount: number;
  memberCount: number;
  avgRank: number | null;
  top10: number;
};

export type KeywordRow = {
  id: string;
  projectId: string;
  seed: string;
  keyword: string;
  locationId: number;
  languageId: number;
  volume: number;
  msv: number[];
  kd: number | null;
  cpc: number;
  ppc: number;
  opportunity: number;
  status: KeywordStatus;
  keywordId: string;
  notes: string;
  agent: string;
  lastFetched: string;
};

export type RankRow = {
  id: string;
  projectId: string;
  keyword: string;
  device: "desktop" | "mobile";
  rank: number | null;
  prev: number | null;
  best: number | null;
  visits: number;
  volume: number;
  url: string;
  checkedAt: string;
};

export type SerpOrganic = {
  id: string;
  projectId: string;
  keyword: string;
  position: number;
  url: string;
  title: string;
  domain: string;
  kd: number | null;
  features: string;
  fetchedAt: string;
};

export type CompetitorRow = {
  id: string;
  projectId: string;
  domain: string;
  keyword: string;
  volume: number;
  kd: number | null;
  cpc: number;
  position: number | null;
};

export type GapRow = {
  id: string;
  projectId: string;
  keyword: string;
  volume: number;
  cpc: number;
  yourPosition: number | null;
  competitor: string;
  competitorPosition: number;
};

export type AccessRow = {
  id: string;
  projectId: string;
  email: string;
  userId: string | null;
  role: Role;
  keywordFilter: string;
  createdAt: string;
};

export type BriefRow = {
  id: string;
  projectId: string;
  keyword: string;
  content: string;
  createdAt: string;
};

export type LogRow = {
  id: string;
  projectId: string;
  level: "info" | "warn" | "error";
  action: string;
  detail: string;
  credits: number;
  createdAt: string;
};

export type AgentPlaybook = {
  title: string;
  summary: string;
  seeds: string[];
  tasks: { agent: string; action: string; input: string }[];
  notes: string;
};

export type QuotaState = {
  lookups: { limit: number; remaining: number };
  serps: { limit: number; remaining: number };
  tracked: { limit: number; remaining: number };
  resetHours: number;
  live: boolean;
};

export type AtlasEndpoint = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  name: string;
  group: "KWFinder" | "SERPChecker" | "SERPWatcher" | "Locations" | "Quota";
  credits: string;
  params: { name: string; required: boolean; hint: string }[];
  body?: string;
  notes: string;
  sheet: string;
};

export type StudioSettings = {
  hasKey: boolean;
  mondayWebhook: string;
  defaultLocationId: number;
  defaultLanguageId: number;
};

export type ProjectBundle = {
  project: Project;
  keywords: KeywordRow[];
  ranks: RankRow[];
  history: RankRow[];
  related: KeywordRow[];
  competitors: CompetitorRow[];
  gaps: GapRow[];
  serp: SerpOrganic[];
  access: AccessRow[];
  briefs: BriefRow[];
  log: LogRow[];
  quota: QuotaState | null;
};
