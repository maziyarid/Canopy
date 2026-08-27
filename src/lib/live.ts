import { mangoolsRequest } from "@/lib/server/mangools";
import { mapCompetitors, mapGaps, mapKeywords, mapLists, mapQuota } from "@/lib/map-api";
import { useCanopy } from "@/lib/store";

async function call(path: string, init: {
  method?: "GET" | "POST";
  query?: Record<string, string | number>;
  body?: unknown;
}) {
  const apiKey = useCanopy.getState().settings.apiKey;
  if (!apiKey) throw new Error("Add your Mangools API key in Setup.");
  const res = await mangoolsRequest({
    data: { apiKey, path, method: init.method ?? "GET", query: init.query, body: init.body as never },
  });
  if (!("ok" in res) || !res.ok) {
    throw new Error("error" in res ? String(res.error) : "Mangools request failed");
  }
  return res.data;
}

export async function liveQuota() {
  const data = await call("/kwfinder/limits", {});
  const quota = mapQuota(data);
  useCanopy.getState().setQuota(quota);
  useCanopy.getState().addLog({
    at: stamp(),
    level: "info",
    action: "limits",
    detail: `${quota.lookups.remaining}/${quota.lookups.limit} lookups remaining`,
    credits: 0,
  });
  return quota;
}

export async function liveRelated(seed: string) {
  const { settings } = useCanopy.getState();
  const data = await call("/kwfinder/related-keywords", {
    query: { kw: seed, location_id: settings.locationId, language_id: settings.languageId },
  });
  const rows = mapKeywords(data, seed, settings.locationId, settings.languageId, "Expander");
  useCanopy.getState().setRelated(rows);
  useCanopy.getState().addLog({
    at: stamp(),
    level: "info",
    action: "related-keywords",
    detail: `seed=${seed} · ${rows.length} ideas`,
    credits: 1,
  });
  return rows;
}

export async function liveBulk(keywords: string[]) {
  const { settings } = useCanopy.getState();
  const unique = [...new Set(keywords.map((k) => k.trim()).filter(Boolean))].slice(0, 700);
  if (!unique.length) throw new Error("No keywords to score.");
  const data = await call("/kwfinder/keyword-imports", {
    method: "POST",
    body: {
      keywords: unique,
      location_id: settings.locationId,
      language_id: settings.languageId,
    },
  });
  const rows = mapKeywords(data, unique[0] ?? "", settings.locationId, settings.languageId, "Assessor");
  useCanopy.getState().mergeKeywords(rows);
  useCanopy.getState().addLog({
    at: stamp(),
    level: "info",
    action: "keyword-imports",
    detail: `${rows.length} keywords scored`,
    credits: 1,
  });
  return rows;
}

export async function liveCompetitor(url: string) {
  const { settings } = useCanopy.getState();
  const data = await call("/kwfinder/competitor-keywords", {
    query: { url, location_id: settings.locationId },
  });
  const rows = mapCompetitors(data, url);
  useCanopy.getState().setCompetitors(rows);
  useCanopy.getState().addLog({
    at: stamp(),
    level: "info",
    action: "competitor-keywords",
    detail: `${url} · ${rows.length} keywords`,
    credits: 1,
  });
  return rows;
}

export async function liveGap(competitors: string[]) {
  const { settings } = useCanopy.getState();
  if (!settings.domain) throw new Error("Set a home domain in Setup.");
  const list = competitors.map((s) => s.trim()).filter(Boolean).slice(0, 5);
  if (!list.length) throw new Error("Need at least one competitor.");
  const data = await call("/kwfinder/gap-analysis", {
    method: "POST",
    body: {
      domain: settings.domain,
      competitors: list,
      location_id: settings.locationId,
    },
  });
  const rows = mapGaps(data);
  useCanopy.getState().setGaps(rows);
  useCanopy.getState().addLog({
    at: stamp(),
    level: "info",
    action: "gap-analysis",
    detail: `${settings.domain} vs ${list.join(", ")} · ${rows.length} gaps`,
    credits: 1,
  });
  return rows;
}

export async function liveLists() {
  const data = await call("/kwfinder/lists", {});
  const rows = mapLists(data);
  useCanopy.getState().setLists(rows);
  return rows;
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
