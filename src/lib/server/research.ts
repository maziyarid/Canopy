import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { opportunityScore } from "@/lib/score";
import { mapCompetitors, mapGaps, mapKeywords, stamp } from "@/lib/map-api";
import { studioAuth } from "./studio-auth";
import { canWrite, nid, ownerMangoolsKey, resolveAccess } from "./access";
import { mangoolsFetch } from "./mangools";
import { mapKeyword } from "./mappers";
import { queueMonday } from "./monday";
import { redactForClient, redactForLog } from "./redact";

async function log(
  sql: Awaited<ReturnType<typeof getSql>>,
  projectId: string,
  userId: string,
  action: string,
  detail: string,
  credits = 0,
  level: "info" | "warn" | "error" = "info",
) {
  const safeDetail = redactForLog(detail);
  await sql`
    insert into activity_log (id, project_id, user_id, level, action, detail, credits)
    values (${nid()}, ${projectId}, ${userId}, ${level}, ${action}, ${safeDetail}, ${credits})
  `;
}

export const addSeeds = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string(), seeds: z.array(z.string()).max(80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { project, role } = await resolveAccess(sql, context.userId, context.email, data.projectId);
    if (!canWrite(role)) throw new Error("Forbidden");
    const existing = await sql<{ keyword: string }>`select keyword from keywords where project_id = ${data.projectId}`;
    const have = new Set(existing.map((r) => r.keyword.toLowerCase()));
    let added = 0;
    for (const raw of data.seeds) {
      const keyword = raw.trim();
      if (!keyword || have.has(keyword.toLowerCase())) continue;
      await sql`
        insert into keywords (id, project_id, seed, keyword, location_id, language_id, status, notes, agent)
        values (
          ${nid()}, ${data.projectId}, ${keyword}, ${keyword},
          ${project.location_id}, ${project.language_id}, 'new', 'Added by Scout', 'Scout'
        )
      `;
      have.add(keyword.toLowerCase());
      added += 1;
    }
    await log(sql, data.projectId, context.userId, "write", `Added ${added} seeds`);
    return { added };
  });

export const updateKeywordStatus = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(
    z.object({
      projectId: z.string(),
      id: z.string(),
      status: z.enum(["new", "tracked", "briefed", "ignored"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { role, project } = await resolveAccess(sql, context.userId, context.email, data.projectId);
    if (!canWrite(role)) throw new Error("Forbidden");
    const rows = await sql<{ keyword: string }>`
      select keyword from keywords where id = ${data.id} and project_id = ${data.projectId}
    `;
    await sql`
      update keywords set status = ${data.status} where id = ${data.id} and project_id = ${data.projectId}
    `;
    if (data.status === "briefed" && rows[0]) {
      await queueMonday(sql, project.owner_id, data.projectId, "keyword_briefed", {
        event: "keyword_briefed",
        project: project.name,
        domain: project.domain,
        keyword: rows[0].keyword,
        status: data.status,
      });
    }
    return { ok: true as const };
  });

export const scoreKeywords = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string(), keywords: z.array(z.string()).max(700).optional() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { project, role } = await resolveAccess(sql, context.userId, context.email, data.projectId);
    if (!canWrite(role)) throw new Error("Forbidden");
    const key = await ownerMangoolsKey(sql, project.owner_id);
    if (!key) throw new Error("Add your Mangools API key in Connect.");
    const existing = await sql<{ keyword: string }>`select keyword from keywords where project_id = ${data.projectId}`;
    const list = (data.keywords?.length ? data.keywords : existing.map((r) => r.keyword))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 700);
    if (!list.length) throw new Error("No keywords to score.");
    const res = await mangoolsFetch({
      apiKey: key,
      method: "POST",
      path: "/kwfinder/keyword-imports",
      body: { keywords: list, location_id: project.location_id, language_id: project.language_id },
    });
    if (!res.ok) throw new Error(redactForClient(res.error ?? "provider error"));
    const mapped = mapKeywords(
      res.data,
      list[0] ?? "",
      Number(project.location_id),
      Number(project.language_id),
      "Assessor",
      data.projectId,
    );
    for (const row of mapped) {
      const hit = await sql<{ id: string }>`
        select id from keywords where project_id = ${data.projectId} and lower(keyword) = ${row.keyword.toLowerCase()}
      `;
      if (hit[0]) {
        await sql`
          update keywords set
            volume = ${row.volume}, kd = ${row.kd}, cpc = ${row.cpc}, ppc = ${row.ppc},
            opportunity = ${row.opportunity}, msv = ${JSON.stringify(row.msv)},
            keyword_id = ${row.keywordId}, last_fetched = ${row.lastFetched}, agent = 'Assessor'
          where id = ${hit[0].id}
        `;
      } else {
        await sql`
          insert into keywords (
            id, project_id, seed, keyword, location_id, language_id, volume, msv, kd, cpc, ppc,
            opportunity, status, keyword_id, notes, agent, last_fetched
          ) values (
            ${nid()}, ${data.projectId}, ${row.seed}, ${row.keyword}, ${row.locationId}, ${row.languageId},
            ${row.volume}, ${JSON.stringify(row.msv)}, ${row.kd}, ${row.cpc}, ${row.ppc}, ${row.opportunity},
            'new', ${row.keywordId}, '', 'Assessor', ${row.lastFetched}
          )
        `;
      }
    }
    await log(sql, data.projectId, context.userId, "keyword-imports", `${mapped.length} keywords scored`, 1);
    const out = await sql`select * from keywords where project_id = ${data.projectId} order by opportunity desc`;
    return out.map(mapKeyword);
  });

export const expandRelated = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string(), seed: z.string().min(1).max(200) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { project, role } = await resolveAccess(sql, context.userId, context.email, data.projectId);
    if (!canWrite(role)) throw new Error("Forbidden");
    const key = await ownerMangoolsKey(sql, project.owner_id);
    if (!key) throw new Error("Add your Mangools API key in Connect.");
    const res = await mangoolsFetch({
      apiKey: key,
      path: "/kwfinder/related-keywords",
      query: { kw: data.seed, location_id: Number(project.location_id), language_id: Number(project.language_id) },
    });
    if (!res.ok) throw new Error(redactForClient(res.error ?? "provider error"));
    const mapped = mapKeywords(
      res.data,
      data.seed,
      Number(project.location_id),
      Number(project.language_id),
      "Expander",
      data.projectId,
    );
    for (const row of mapped) {
      const hit = await sql<{ id: string }>`
        select id from keywords where project_id = ${data.projectId} and lower(keyword) = ${row.keyword.toLowerCase()}
      `;
      if (hit[0]) continue;
      await sql`
        insert into keywords (
          id, project_id, seed, keyword, location_id, language_id, volume, msv, kd, cpc, ppc,
          opportunity, status, keyword_id, notes, agent, last_fetched
        ) values (
          ${nid()}, ${data.projectId}, ${row.seed}, ${row.keyword}, ${row.locationId}, ${row.languageId},
          ${row.volume}, ${JSON.stringify(row.msv)}, ${row.kd}, ${row.cpc}, ${row.ppc}, ${row.opportunity},
          'new', ${row.keywordId}, '', 'Expander', ${row.lastFetched}
        )
      `;
    }
    await log(sql, data.projectId, context.userId, "related-keywords", `seed=${data.seed} · ${mapped.length} ideas`, 1);
    return mapped;
  });

export const pullCompetitor = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string(), url: z.string().min(3).max(200) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { project, role } = await resolveAccess(sql, context.userId, context.email, data.projectId);
    if (!canWrite(role)) throw new Error("Forbidden");
    const key = await ownerMangoolsKey(sql, project.owner_id);
    if (!key) throw new Error("Add your Mangools API key in Connect.");
    const res = await mangoolsFetch({
      apiKey: key,
      path: "/kwfinder/competitor-keywords",
      query: { url: data.url, location_id: Number(project.location_id) },
    });
    if (!res.ok) throw new Error(redactForClient(res.error ?? "provider error"));
    await sql`delete from competitors where project_id = ${data.projectId} and domain = ${data.url}`;
    const mapped = mapCompetitors(res.data, data.url, data.projectId);
    for (const row of mapped.slice(0, 200)) {
      await sql`
        insert into competitors (id, project_id, domain, keyword, volume, kd, cpc, position)
        values (${nid()}, ${data.projectId}, ${row.domain}, ${row.keyword}, ${row.volume}, ${row.kd}, ${row.cpc}, ${row.position})
      `;
    }
    await log(sql, data.projectId, context.userId, "competitor-keywords", `${data.url} · ${mapped.length}`, 1);
    return mapped.slice(0, 200);
  });

export const runGap = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string(), competitors: z.array(z.string()).max(5).optional() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { project, role } = await resolveAccess(sql, context.userId, context.email, data.projectId);
    if (!canWrite(role)) throw new Error("Forbidden");
    if (!project.domain) throw new Error("Set a home domain on the project.");
    const list = (data.competitors?.length ? data.competitors : project.competitors.split(","))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (!list.length) throw new Error("Need at least one competitor.");
    const key = await ownerMangoolsKey(sql, project.owner_id);
    if (!key) throw new Error("Add your Mangools API key in Connect.");
    const res = await mangoolsFetch({
      apiKey: key,
      method: "POST",
      path: "/kwfinder/gap-analysis",
      body: { domain: project.domain, competitors: list, location_id: Number(project.location_id) },
    });
    if (!res.ok) throw new Error(redactForClient(res.error ?? "provider error"));
    await sql`delete from gaps where project_id = ${data.projectId}`;
    const mapped = mapGaps(res.data, data.projectId);
    for (const row of mapped.slice(0, 300)) {
      await sql`
        insert into gaps (id, project_id, keyword, volume, cpc, your_position, competitor, competitor_position)
        values (${nid()}, ${data.projectId}, ${row.keyword}, ${row.volume}, ${row.cpc}, ${row.yourPosition}, ${row.competitor}, ${row.competitorPosition})
      `;
    }
    await log(sql, data.projectId, context.userId, "gap-analysis", `${project.domain} vs ${list.join(", ")}`, 1);
    return mapped.slice(0, 300);
  });

export { opportunityScore, stamp };
