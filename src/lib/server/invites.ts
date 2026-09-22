import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { studioAuth } from "./studio-auth";
import { nid, resolveAccess } from "./access";
import { mapAccess } from "./mappers";

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(
    z.object({
      projectId: z.string(),
      email: z.string().email().max(200),
      role: z.enum(["editor", "client"]).default("client"),
      keywordFilter: z.string().max(800).default(""),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { role } = await resolveAccess(sql, context.userId, context.email, data.projectId);
    if (role !== "owner") throw new Error("Forbidden");
    const email = data.email.toLowerCase().trim();
    const existing = await sql<{ id: string }>`
      select id from project_access where project_id = ${data.projectId} and email = ${email}
    `;
    if (existing[0]) {
      await sql`
        update project_access
        set role = ${data.role}, keyword_filter = ${data.keywordFilter.trim()}
        where id = ${existing[0].id}
      `;
    } else {
      await sql`
        insert into project_access (id, project_id, email, role, keyword_filter)
        values (${nid()}, ${data.projectId}, ${email}, ${data.role}, ${data.keywordFilter.trim()})
      `;
    }
    const rows = await sql`select * from project_access where project_id = ${data.projectId} order by created_at desc`;
    return rows.map(mapAccess);
  });

export const revokeMember = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string(), id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { role } = await resolveAccess(sql, context.userId, context.email, data.projectId);
    if (role !== "owner") throw new Error("Forbidden");
    await sql`delete from project_access where id = ${data.id} and project_id = ${data.projectId}`;
    return { ok: true as const };
  });
