import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { studioAuth } from "./studio-auth";
import {
  canWrite,
  filterKeywords,
  linkInvites,
  nid,
  resolveAccess,
  toProject,
  type DbProject,
} from "./access";
import { getSql } from "@/lib/db";
import {
  mapAccess,
  mapBrief,
  mapCompetitor,
  mapGap,
  mapKeyword,
  mapLog,
  mapRank,
  mapSerp,
} from "./mappers";
import type { Project, ProjectBundle, Role } from "@/lib/types";

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export const listProjects = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await linkInvites(sql, context.userId, context.email);
    const owned = await sql<DbProject>`
      select * from projects where owner_id = ${context.userId} order by created_at desc
    `;
    const shared = await sql<DbProject>`
      select p.* from projects p
      join project_access a on a.project_id = p.id
      where p.owner_id <> ${context.userId}
        and (a.user_id = ${context.userId} or (${context.email} <> '' and a.email = ${context.email}))
      order by p.created_at desc
    `;
    const accessRows = await sql<{ project_id: string; role: Role; keyword_filter: string }>`
      select project_id, role, keyword_filter from project_access
      where user_id = ${context.userId} or (${context.email} <> '' and email = ${context.email})
    `;
    const accessMap = new Map(accessRows.map((a) => [a.project_id, a]));
    const all = [...owned, ...shared.filter((p) => !owned.some((o) => o.id === p.id))];
    const out: Project[] = [];
    for (const p of all) {
      const role: Role = p.owner_id === context.userId ? "owner" : (accessMap.get(p.id)?.role ?? "client");
      const filter = p.owner_id === context.userId ? "" : (accessMap.get(p.id)?.keyword_filter ?? "");
      const keywordRows = await sql<{ keyword: string }>`
        select keyword from keywords where project_id = ${p.id}
      `;
      const scopedKeywords = filterKeywords(keywordRows, filter);
      const mem = await sql<{ c: number }>`select count(*)::int as c from project_access where project_id = ${p.id}`;
      const rankRows = await sql<{ keyword: string; rank: number | null }>`
        select distinct on (keyword) keyword, rank from rank_history
        where project_id = ${p.id}
        order by keyword, checked_at desc
      `;
      const scopedRanks = filterKeywords(rankRows, filter);
      const ranked = scopedRanks.map((r) => n(r.rank)).filter((x) => x > 0);
      const avgRank = ranked.length ? Math.round((ranked.reduce((s, x) => s + x, 0) / ranked.length) * 10) / 10 : null;
      const top10 = ranked.filter((x) => x <= 10).length;
      out.push(
        toProject(p, {
          role,
          keywordFilter: filter,
          keywordCount: scopedKeywords.length,
          memberCount: n(mem[0]?.c) + 1,
          avgRank,
          top10,
        }),
      );
    }
    return out;
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(
    z.object({
      name: z.string().min(1).max(120),
      domain: z.string().max(200).default(""),
      dataDomain: z.enum(["medical", "thesis", "other"]).default("other"),
      locationId: z.number().int().default(2840),
      languageId: z.number().int().default(1000),
      platformId: z.number().int().default(1),
      competitors: z.string().max(400).default(""),
      notes: z.string().max(2000).default(""),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = nid();
    await sql`
      insert into projects (id, owner_id, name, domain, data_domain, location_id, language_id, platform_id, competitors, notes)
      values (
        ${id}, ${context.userId}, ${data.name.trim()}, ${data.domain.trim().toLowerCase()}, ${data.dataDomain},
        ${data.locationId}, ${data.languageId}, ${data.platformId}, ${data.competitors}, ${data.notes}
      )
    `;
    return { id };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(120).optional(),
      domain: z.string().max(200).optional(),
      locationId: z.number().int().optional(),
      languageId: z.number().int().optional(),
      platformId: z.number().int().optional(),
      competitors: z.string().max(400).optional(),
      notes: z.string().max(2000).optional(),
      trackingId: z.string().max(80).optional(),
      status: z.string().max(20).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { project, role } = await resolveAccess(sql, context.userId, context.email, data.id);
    if (!canWrite(role)) throw new Error("Forbidden");
    // data_domain is intentionally immutable after create (AAX-55 / AAX-134).
    await sql`
      update projects set
        name = ${data.name ?? project.name},
        domain = ${data.domain ?? project.domain},
        location_id = ${data.locationId ?? project.location_id},
        language_id = ${data.languageId ?? project.language_id},
        platform_id = ${data.platformId ?? project.platform_id},
        competitors = ${data.competitors ?? project.competitors},
        notes = ${data.notes ?? project.notes},
        tracking_id = ${data.trackingId ?? project.tracking_id},
        status = ${data.status ?? project.status}
      where id = ${data.id}
    `;
    return { ok: true as const };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { role } = await resolveAccess(sql, context.userId, context.email, data.id);
    if (role !== "owner") throw new Error("Forbidden");
    await sql`delete from keywords where project_id = ${data.id}`;
    await sql`delete from rank_history where project_id = ${data.id}`;
    await sql`delete from serp_rows where project_id = ${data.id}`;
    await sql`delete from competitors where project_id = ${data.id}`;
    await sql`delete from gaps where project_id = ${data.id}`;
    await sql`delete from briefs where project_id = ${data.id}`;
    await sql`delete from agent_runs where project_id = ${data.id}`;
    await sql`delete from activity_log where project_id = ${data.id}`;
    await sql`delete from monday_events where project_id = ${data.id}`;
    await sql`delete from project_access where project_id = ${data.id}`;
    await sql`delete from projects where id = ${data.id} and owner_id = ${context.userId}`;
    return { ok: true as const };
  });

export const getProjectBundle = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }): Promise<ProjectBundle> => {
    const sql = await getSql();
    await linkInvites(sql, context.userId, context.email);
    const { project, role, filter } = await resolveAccess(sql, context.userId, context.email, data.id);
    const kwRows = await sql`select * from keywords where project_id = ${data.id} order by opportunity desc`;
    const keywords = filterKeywords(kwRows.map(mapKeyword), filter);
    const rankRows = await sql`
      select * from rank_history where project_id = ${data.id} order by checked_at desc
    `;
    const history = filterKeywords(rankRows.map(mapRank), filter);
    const latestByKw = new Map<string, (typeof history)[number]>();
    for (const r of history) {
      const key = `${r.keyword}::${r.device}`;
      if (!latestByKw.has(key)) latestByKw.set(key, r);
    }
    const ranks = [...latestByKw.values()];
    const ranked = ranks.map((r) => r.rank).filter((x): x is number => x != null && x > 0);
    const avgRank = ranked.length ? Math.round((ranked.reduce((s, x) => s + x, 0) / ranked.length) * 10) / 10 : null;
    const top10 = ranked.filter((x) => x <= 10).length;
    const mem = await sql<{ c: number }>`select count(*)::int as c from project_access where project_id = ${data.id}`;
    const relatedRaw = await sql`select * from keywords where project_id = ${data.id} and agent = 'Expander' order by opportunity desc`;
    const comps = await sql`select * from competitors where project_id = ${data.id}`;
    const gapRows = await sql`select * from gaps where project_id = ${data.id}`;
    const serpRows = await sql`select * from serp_rows where project_id = ${data.id} order by position asc`;
    const accessRows =
      role === "client"
        ? []
        : await sql`select * from project_access where project_id = ${data.id} order by created_at desc`;
    const briefRows = await sql`select * from briefs where project_id = ${data.id} order by created_at desc`;
    const logRows = filter.trim()
      ? []
      : await sql`select * from activity_log where project_id = ${data.id} order by created_at desc limit 40`;
    return {
      project: toProject(project, {
        role,
        keywordFilter: filter,
        keywordCount: keywords.length,
        memberCount: n(mem[0]?.c) + 1,
        avgRank,
        top10,
      }),
      keywords,
      ranks,
      history,
      related: filterKeywords(relatedRaw.map(mapKeyword), filter),
      competitors: filterKeywords(comps.map(mapCompetitor), filter),
      gaps: filterKeywords(gapRows.map(mapGap), filter),
      serp: filterKeywords(serpRows.map(mapSerp), filter),
      access: accessRows.map(mapAccess),
      briefs: filterKeywords(briefRows.map(mapBrief), filter),
      log: logRows.map(mapLog),
      quota: null,
    };
  });
