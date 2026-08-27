import { locationLabel, languageLabel } from "./locations";
import { opportunityScore } from "./score";
import type { CompetitorRow, GapRow, KeywordRow, ListRow, QuotaState } from "./types";

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function monthly(msv: unknown): number[] {
  if (!Array.isArray(msv)) return [];
  if (msv.length && typeof msv[0] === "number" && msv.length <= 24 && msv.every((x) => typeof x === "number")) {
    // Could be triples [year, month, vol, ...]
    if (msv.length % 3 === 0 && msv[0] > 2000 && msv[0] < 2100) {
      const vols: number[] = [];
      for (let i = 2; i < msv.length; i += 3) vols.push(num(msv[i]));
      return vols;
    }
    return msv.map(num);
  }
  return [];
}

export function mapKeywords(
  raw: unknown,
  seed: string,
  locationId: number,
  languageId: number,
  agent: string,
): KeywordRow[] {
  const list = extractKeywordList(raw);
  const now = stamp();
  return list.map((k, i) => {
    const keyword = String(k.kw ?? k.keyword ?? "");
    const volume = num(k.sv ?? k.search_volume);
    const kd = k.seo == null ? null : num(k.seo);
    const cpc = num(k.cpc);
    const ppc = num(k.ppc);
    return {
      id: String(k._id ?? `${keyword}-${i}`),
      seed,
      keyword,
      location: locationLabel(num(k.lid) || locationId),
      locationId: num(k.lid) || locationId,
      language: languageLabel(languageId),
      languageId,
      volume,
      msv: monthly(k.msv),
      kd,
      cpc,
      ppc,
      opportunity: opportunityScore(volume, kd, ppc),
      status: "new" as const,
      lastFetched: now,
      keywordId: String(k._id ?? ""),
      notes: "",
      agent,
    };
  });
}

export function mapCompetitors(raw: unknown, domain: string): CompetitorRow[] {
  const list = extractKeywordList(raw);
  return list.map((k, i) => ({
    id: String(k._id ?? i),
    domain,
    keyword: String(k.kw ?? k.keyword ?? ""),
    volume: num(k.sv),
    kd: k.seo == null ? null : num(k.seo),
    cpc: num(k.cpc),
    position: Array.isArray(k.h) && Array.isArray(k.h[0]) ? num(k.h[0][2]) : null,
    visitsEst: num(k.svn),
  }));
}

export function mapGaps(raw: unknown): GapRow[] {
  const data = raw as { results?: Array<{ domain?: string; items?: Record<string, unknown>[] }> };
  const rows: GapRow[] = [];
  for (const block of data.results ?? []) {
    for (const item of block.items ?? []) {
      rows.push({
        id: `${block.domain}-${item.keyword}`,
        keyword: String(item.keyword ?? item.kw ?? ""),
        volume: num(item.search_volume ?? item.sv),
        cpc: num(item.cpc),
        yourPosition: item.your_position == null ? null : num(item.your_position),
        competitor: String(block.domain ?? item.competitor ?? ""),
        competitorPosition: num(item.competitor_position),
      });
    }
  }
  return rows;
}

export function mapLists(raw: unknown): ListRow[] {
  const data = raw as { lists?: Record<string, unknown>[]; items?: Record<string, unknown>[] };
  const list = (Array.isArray(raw) ? raw : data.lists ?? data.items ?? []) as Record<string, unknown>[];
  const now = stamp().slice(0, 10);
  return list.map((l, i) => ({
    id: String(l._id ?? l.id ?? i),
    name: String(l.name ?? l.title ?? "Untitled"),
    count: num(l.count ?? (Array.isArray(l.keywords) ? l.keywords.length : 0)),
    updated: now,
  }));
}

export function mapQuota(raw: unknown): QuotaState {
  const data = raw as Record<string, unknown>;
  const resources = (data.resources ?? {}) as { limit?: number; remaining?: number; reset?: number };
  const serps = (data.serps ?? {}) as { limit?: number; remaining?: number };
  const tracked = (data.tracked_keywords ?? data["tracked-keywords"] ?? {}) as {
    limit?: number;
    remaining?: number;
  };
  return {
    lookups: {
      limit: num(resources.limit) || 500,
      remaining: num(resources.remaining) || 0,
    },
    serps: {
      limit: num(serps.limit) || 500,
      remaining: num(serps.remaining) || 0,
    },
    tracked: {
      limit: typeof tracked === "number" ? tracked : num(tracked.limit) || 200,
      remaining: typeof tracked === "number" ? tracked : num(tracked.remaining) || 0,
    },
    resetHours: Math.max(1, Math.round(num(resources.reset) / 3600) || 12),
    live: true,
  };
}

function extractKeywordList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  const data = raw as { keywords?: Record<string, unknown>[]; items?: Record<string, unknown>[] };
  return data.keywords ?? data.items ?? [];
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
