import type {
  AccessRow,
  BriefRow,
  CompetitorRow,
  GapRow,
  KeywordRow,
  KeywordStatus,
  LogRow,
  RankRow,
  Role,
  SerpOrganic,
} from "@/lib/types";

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function nNull(v: unknown) {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export function mapKeyword(r: Record<string, unknown>): KeywordRow {
  let msv: number[] = [];
  try {
    const parsed = JSON.parse(String(r.msv || "[]")) as unknown;
    if (Array.isArray(parsed)) msv = parsed.map((x) => n(x));
  } catch {
    msv = [];
  }
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    seed: String(r.seed ?? ""),
    keyword: String(r.keyword ?? ""),
    locationId: n(r.location_id),
    languageId: n(r.language_id),
    volume: n(r.volume),
    msv,
    kd: nNull(r.kd),
    cpc: n(r.cpc),
    ppc: n(r.ppc),
    opportunity: n(r.opportunity),
    status: (String(r.status || "new") as KeywordStatus) || "new",
    keywordId: String(r.keyword_id ?? ""),
    notes: String(r.notes ?? ""),
    agent: String(r.agent ?? ""),
    lastFetched: String(r.last_fetched ?? ""),
  };
}

export function mapRank(r: Record<string, unknown>): RankRow {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    keyword: String(r.keyword ?? ""),
    device: r.device === "mobile" ? "mobile" : "desktop",
    rank: nNull(r.rank),
    prev: nNull(r.prev),
    best: nNull(r.best),
    visits: n(r.visits),
    volume: n(r.volume),
    url: String(r.url ?? ""),
    checkedAt: String(r.checked_at ?? ""),
  };
}

export function mapSerp(r: Record<string, unknown>): SerpOrganic {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    keyword: String(r.keyword ?? ""),
    position: n(r.position),
    url: String(r.url ?? ""),
    title: String(r.title ?? ""),
    domain: String(r.domain ?? ""),
    kd: nNull(r.kd),
    features: String(r.features ?? ""),
    fetchedAt: String(r.fetched_at ?? ""),
  };
}

export function mapCompetitor(r: Record<string, unknown>): CompetitorRow {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    domain: String(r.domain ?? ""),
    keyword: String(r.keyword ?? ""),
    volume: n(r.volume),
    kd: nNull(r.kd),
    cpc: n(r.cpc),
    position: nNull(r.position),
  };
}

export function mapGap(r: Record<string, unknown>): GapRow {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    keyword: String(r.keyword ?? ""),
    volume: n(r.volume),
    cpc: n(r.cpc),
    yourPosition: nNull(r.your_position),
    competitor: String(r.competitor ?? ""),
    competitorPosition: n(r.competitor_position),
  };
}

export function mapAccess(r: Record<string, unknown>): AccessRow {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    email: String(r.email ?? ""),
    userId: r.user_id ? String(r.user_id) : null,
    role: (String(r.role) as Role) || "client",
    keywordFilter: String(r.keyword_filter ?? ""),
    createdAt: String(r.created_at ?? ""),
  };
}

export function mapBrief(r: Record<string, unknown>): BriefRow {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    keyword: String(r.keyword ?? ""),
    content: String(r.content ?? ""),
    createdAt: String(r.created_at ?? ""),
  };
}

export function mapLog(r: Record<string, unknown>): LogRow {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    level: (String(r.level) as LogRow["level"]) || "info",
    action: String(r.action ?? ""),
    detail: String(r.detail ?? ""),
    credits: n(r.credits),
    createdAt: String(r.created_at ?? ""),
  };
}
