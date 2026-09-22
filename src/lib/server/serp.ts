import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { hostOf, stamp } from "@/lib/map-api";
import { studioAuth } from "./studio-auth";
import { canWrite, nid, ownerMangoolsKey, resolveAccess } from "./access";
import { mangoolsFetch } from "./mangools";
import { mapRank, mapSerp } from "./mappers";
import { queueMonday } from "./monday";

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const trackSelected = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string(), keywords: z.array(z.string()).max(80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { project, role } = await resolveAccess(sql, context.userId, context.email, data.projectId);
    if (!canWrite(role)) throw new Error("Forbidden");
    const device = Number(project.platform_id) === 2 ? "mobile" : "desktop";
    const now = stamp();
    for (const keyword of data.keywords.map((k) => k.trim()).filter(Boolean)) {
      const prev = await sql<{ rank: number | null; volume: number }>`
        select rank, volume from rank_history
        where project_id = ${data.projectId} and keyword = ${keyword}
        order by checked_at desc limit 1
      `;
      const kw = await sql<{ volume: number }>`
        select volume from keywords where project_id = ${data.projectId} and lower(keyword) = ${keyword.toLowerCase()} limit 1
      `;
      await sql`
        insert into rank_history (id, project_id, keyword, device, rank, prev, best, visits, volume, url, checked_at)
        values (
          ${nid()}, ${data.projectId}, ${keyword}, ${device},
          ${prev[0]?.rank ?? null}, ${prev[0]?.rank ?? null}, ${prev[0]?.rank ?? null},
          0, ${kw[0]?.volume ?? prev[0]?.volume ?? 0}, '', ${now}
        )
      `;
      await sql`
        update keywords set status = 'tracked' where project_id = ${data.projectId} and lower(keyword) = ${keyword.toLowerCase()}
      `;
    }
    return { ok: true as const };
  });

export const refreshRanks = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { project, role } = await resolveAccess(sql, context.userId, context.email, data.projectId);
    if (!canWrite(role)) throw new Error("Forbidden");
    const key = await ownerMangoolsKey(sql, project.owner_id);
    const device = Number(project.platform_id) === 2 ? "mobile" : "desktop";
    const now = stamp();

    if (!key) throw new Error("Add your Mangools API key in Connect.");
    if (!project.tracking_id) {
      throw new Error("Add a Mangools tracking ID to this project before refreshing ranks.");
    }

    {
      const detail = await mangoolsFetch({
        apiKey: key,
        path: `/serpwatcher/trackings/${encodeURIComponent(project.tracking_id)}/detail`,
      });
      const stats = await mangoolsFetch({
        apiKey: key,
        method: "POST",
        path: `/serpwatcher/trackings/${encodeURIComponent(project.tracking_id)}/stats`,
        body: {},
      });
      if (!detail.ok) throw new Error(detail.error);
      if (!stats.ok) throw new Error(stats.error);
      const d = detail.data as Record<string, unknown>;
      const s = stats.data as Record<string, unknown>;
      const statList = (Array.isArray(s.keywords) ? s.keywords : Array.isArray(s.items) ? s.items : []) as Record<
        string,
        unknown
      >[];
      const byKw = new Map(statList.map((k) => [String(k.kw ?? k.keyword ?? "").toLowerCase(), k]));
      const detailList = (Array.isArray(d.keywords)
        ? d.keywords
        : Array.isArray(d.tracked_keywords)
          ? d.tracked_keywords
          : statList) as Record<string, unknown>[];
      for (const item of detailList) {
        const kw = String(item.kw ?? item.keyword ?? "");
        if (!kw) continue;
        const st = byKw.get(kw.toLowerCase()) ?? item;
        const rank = num(st.rank ?? st.position ?? st.current_rank);
        const prev = num(st.prev ?? st.previous_rank ?? st.rank_previous);
        const best = num(st.best ?? st.best_rank);
        const visits = Number(st.visits ?? st.estimated_visits ?? 0) || 0;
        const volume = Number(st.sv ?? st.search_volume ?? 0) || 0;
        const url = String(st.url ?? st.ranking_url ?? "");
        await sql`
          insert into rank_history (id, project_id, keyword, device, rank, prev, best, visits, volume, url, checked_at)
          values (${nid()}, ${data.projectId}, ${kw}, ${device}, ${rank}, ${prev}, ${best}, ${visits}, ${volume}, ${url}, ${now})
        `;
        if (rank != null && prev != null && rank - prev >= 3) {
          await queueMonday(sql, project.owner_id, data.projectId, "rank_drop", {
            event: "rank_drop",
            project: project.name,
            domain: project.domain,
            keyword: kw,
            rank,
            prev,
          });
        }
      }
    }

    const rows = await sql`
      select * from rank_history where project_id = ${data.projectId} order by checked_at desc
    `;
    return rows.map(mapRank);
  });

export const fetchSerp = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string(), keyword: z.string().min(1).max(200) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { project, role } = await resolveAccess(sql, context.userId, context.email, data.projectId);
    if (!canWrite(role)) throw new Error("Forbidden");
    const key = await ownerMangoolsKey(sql, project.owner_id);
    if (!key) throw new Error("Add your Mangools API key in Connect.");
    const res = await mangoolsFetch({
      apiKey: key,
      path: "/serpchecker/serps",
      query: {
        kw: data.keyword,
        location_id: Number(project.location_id),
        language_id: Number(project.language_id),
      },
    });
    if (!res.ok) throw new Error(res.error);
    const payload = res.data as Record<string, unknown>;
    const items = (payload.organic ?? payload.results ?? payload.serps ?? payload.items ?? []) as Record<
      string,
      unknown
    >[];
    const kdRaw = payload.seo ?? payload.kd ?? (payload.keyword as { seo?: unknown } | undefined)?.seo;
    const kd = kdRaw == null ? null : Number(kdRaw);
    const features = Array.isArray(payload.features)
      ? (payload.features as unknown[]).join(", ")
      : "";
    await sql`delete from serp_rows where project_id = ${data.projectId} and keyword = ${data.keyword}`;
    const now = stamp();
    const list = Array.isArray(items) ? items : [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i] ?? {};
      const url = String(item.url ?? item.link ?? "");
      await sql`
        insert into serp_rows (id, project_id, keyword, position, url, title, domain, kd, features, fetched_at)
        values (
          ${nid()}, ${data.projectId}, ${data.keyword},
          ${Number(item.position ?? item.pos ?? i + 1)}, ${url}, ${String(item.title ?? "")},
          ${String(item.domain ?? hostOf(url))}, ${kd}, ${features}, ${now}
        )
      `;
    }
    if (kd != null) {
      await sql`
        update keywords set kd = ${kd} where project_id = ${data.projectId} and lower(keyword) = ${data.keyword.toLowerCase()}
      `;
    }
    const rows = await sql`
      select * from serp_rows where project_id = ${data.projectId} and keyword = ${data.keyword} order by position
    `;
    return rows.map(mapSerp);
  });
