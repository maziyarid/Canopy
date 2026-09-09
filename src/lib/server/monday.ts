import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { studioAuth } from "./studio-auth";
import { canWrite, nid, ownerMondayHook, resolveAccess } from "./access";

export async function queueMonday(
  sql: Sql,
  ownerId: string,
  projectId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const hook = await ownerMondayHook(sql, ownerId);
  const body = JSON.stringify(payload);
  const id = nid();
  if (!hook) {
    await sql`
      insert into monday_events (id, project_id, event_type, payload, status)
      values (${id}, ${projectId}, ${eventType}, ${body}, 'pending')
    `;
    return { queued: true as const, sent: false as const };
  }
  try {
    const res = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    await sql`
      insert into monday_events (id, project_id, event_type, payload, status)
      values (${id}, ${projectId}, ${eventType}, ${body}, ${res.ok ? "sent" : "failed"})
    `;
    return { queued: true as const, sent: res.ok };
  } catch {
    await sql`
      insert into monday_events (id, project_id, event_type, payload, status)
      values (${id}, ${projectId}, ${eventType}, ${body}, 'failed')
    `;
    return { queued: true as const, sent: false as const };
  }
}

export const pushMonday = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(
    z.object({
      projectId: z.string(),
      items: z
        .array(
          z.object({
            keyword: z.string(),
            volume: z.number().optional(),
            rank: z.number().nullable().optional(),
            status: z.string().optional(),
            opportunity: z.number().optional(),
          }),
        )
        .max(80),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { project, role } = await resolveAccess(sql, context.userId, context.email, data.projectId);
    if (!canWrite(role)) throw new Error("Forbidden");
    const result = await queueMonday(sql, project.owner_id, data.projectId, "task_export", {
      event: "task_export",
      project: project.name,
      domain: project.domain,
      items: data.items,
      source: "Canopy · MΛZ",
    });
    if (!result.sent) {
      const hook = await ownerMondayHook(sql, project.owner_id);
      if (!hook) throw new Error("Add a Monday webhook URL in Connect.");
      throw new Error("Monday webhook did not accept the payload.");
    }
    return { ok: true as const, count: data.items.length };
  });

export const testMonday = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { project, role } = await resolveAccess(sql, context.userId, context.email, data.projectId);
    if (role !== "owner") throw new Error("Forbidden");
    const result = await queueMonday(sql, project.owner_id, data.projectId, "test", {
      event: "test",
      project: project.name,
      domain: project.domain,
      message: "Canopy → Monday handshake",
      source: "Canopy · MΛZ",
    });
    if (!result.sent) throw new Error("Webhook failed. Check the Monday URL.");
    return { ok: true as const };
  });
