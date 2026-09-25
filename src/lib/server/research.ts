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
import { redactForLog } from "./redact";

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
