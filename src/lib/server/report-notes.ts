import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { studioAuth } from "./studio-auth";
import { resolveAccess } from "./access";
import { createManualNote, changeNote } from "./insight-persistence";
import { loadReportingSnapshot } from "./reporting-snapshot-service";
import { getProviderStates, getProviderMetricRows } from "../analytics/gateway.server";
import { readGatewayLedger } from "./reporting-ledger";

export const saveManualReportNote = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string().min(1).max(80), period: z.string().max(40), title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(2000), provider: z.enum(["gsc", "ga4"]), metricName: z.string().min(1).max(80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await resolveAccess(sql, context.userId, context.email, data.projectId);
    const snapshot = await loadReportingSnapshot({ sql, resolveAccess, userId: context.userId, email: context.email, projectId: data.projectId, periodLabel: data.period, comparisonLabel: "", readLedger: (id, site, period) => readGatewayLedger(id, site, period, { states: getProviderStates, metrics: getProviderMetricRows }) });
    await createManualNote(sql, access, snapshot, data, context.userId);
    return { ok: true };
  });

export const updateReportNote = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string().min(1).max(80), noteId: z.string().min(1).max(100), revision: z.number().int().nonnegative(), action: z.enum(["edit", "approve", "hide"]), title: z.string().trim().min(1).max(200).optional(), body: z.string().trim().min(1).max(2000).optional() }).refine(data => data.action !== "edit" || Boolean(data.title && data.body), "Title and body are required for editing"))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await resolveAccess(sql, context.userId, context.email, data.projectId);
    await changeNote(sql, access, data.noteId, data.revision, data, context.userId);
    return { ok: true };
  });
