export type ViewId = "workspace" | "agents" | "script" | "atlas" | "setup";

export type SheetTab =
  | "keywords"
  | "related"
  | "tracking"
  | "competitors"
  | "gaps"
  | "lists"
  | "log";

export type KeywordRow = {
  id: string;
  seed: string;
  keyword: string;
  location: string;
  locationId: number;
  language: string;
  languageId: number;
  volume: number;
  msv: number[];
  kd: number | null;
  cpc: number;
  ppc: number;
  opportunity: number;
  status: "new" | "tracked" | "briefed" | "ignored";
  lastFetched: string;
  keywordId: string;
  notes: string;
  agent: string;
};

export type TrackingRow = {
  id: string;
  trackingId: string;
  domain: string;
  keyword: string;
  location: string;
  device: "desktop" | "mobile";
  rank: number | null;
  prev: number | null;
  best: number | null;
  visits: number;
  volume: number;
  url: string;
  lastCheck: string;
};

export type CompetitorRow = {
  id: string;
  domain: string;
  keyword: string;
  volume: number;
  kd: number | null;
  cpc: number;
  position: number | null;
  visitsEst: number;
};

export type GapRow = {
  id: string;
  keyword: string;
  volume: number;
  cpc: number;
  yourPosition: number | null;
  competitor: string;
  competitorPosition: number;
};

export type ListRow = {
  id: string;
  name: string;
  count: number;
  updated: string;
};

export type LogRow = {
  id: string;
  at: string;
  level: "info" | "warn" | "error";
  action: string;
  detail: string;
  credits: number;
};

export type QuotaState = {
  lookups: { limit: number; remaining: number };
  serps: { limit: number; remaining: number };
  tracked: { limit: number; remaining: number };
  resetHours: number;
  live: boolean;
};

export type AgentMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  at: string;
  playbook?: AgentPlaybook | null;
};

export type AgentPlaybook = {
  title: string;
  summary: string;
  seeds: string[];
  tasks: { agent: string; action: string; input: string }[];
  notes: string;
};

export type LocationOption = {
  id: number;
  label: string;
  country: string;
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

export type Settings = {
  apiKey: string;
  domain: string;
  locationId: number;
  languageId: number;
  trackingId: string;
  llmKey: string;
  llmBase: string;
  webhookSecret: string;
  dailyTrigger: boolean;
};
