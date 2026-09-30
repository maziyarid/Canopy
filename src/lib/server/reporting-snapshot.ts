import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { resolveAccess } from "./access";
import { studioAuth } from "./studio-auth";
import { loadReportingSnapshot, refreshReportingSnapshotRecord } from "./reporting-snapshot-service";
import { getProviderStates, getProviderMetricRows } from "../analytics/gateway.server";
import { readGatewayLedger } from "./reporting-ledger";
import { buildClientReportView } from "./client-report-view";
import { mountInsightJournal } from "./insight-journal-mount";
import { persistSnapshotInsights, readPeriodNotes } from "./insight-persistence";

const readLedger = (projectId: string, site: string, period: import("./reporting-snapshot-core").SnapshotPeriod) =>
  readGatewayLedger(projectId, site, period, { states: getProviderStates, metrics: getProviderMetricRows });

const GetSchema = z.object({
  projectId: z.string().min(1).max(80),
  period: z.string().max(40).optional(),
  comparison: z.string().max(40).optional(),
  correlationId: z.string().max(80).optional(),
});

const RefreshSchema = z.object({
  projectId: z.string().min(1).max(80),
  period: z.string().max(40).optional(),
  comparison: z.string().max(40).optional(),
  idempotencyKey: z.string().min(8).max(120),
  correlationId: z.string().max(80).optional(),
});

export const getReportingSnapshot = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(GetSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return loadReportingSnapshot({
      sql,
      readLedger,
      resolveAccess,
      userId: context.userId,
      email: context.email,
      projectId: data.projectId,
      periodLabel: data.period,
      comparisonLabel: data.comparison,
      correlationId: data.correlationId,
    });
  });

export const refreshReportingSnapshot = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(RefreshSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return refreshReportingSnapshotRecord({
      sql,
      readLedger,
      resolveAccess,
      userId: context.userId,
      email: context.email,
      projectId: data.projectId,
      idempotencyKey: data.idempotencyKey,
      periodLabel: data.period,
      comparisonLabel: data.comparison,
      correlationId: data.correlationId,
    });
  });

export const getProjectReport = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(GetSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await resolveAccess(sql, context.userId, context.email, data.projectId);
    const snapshot = await loadReportingSnapshot({ sql, readLedger, resolveAccess, userId: context.userId, email: context.email, projectId: data.projectId, periodLabel: data.period, comparisonLabel: "" });
    if (access.role !== "client") await persistSnapshotInsights(sql, access, snapshot);
    const notes = await readPeriodNotes(sql, access, snapshot.period);
    const sections = access.role === "client" ? snapshot.sections : [...snapshot.sections, snapshot.providerHealth];
    return {
      view: buildClientReportView({ projectId: snapshot.projectId, site: snapshot.site, periodLabel: snapshot.period.label, role: access.role, grants: access.reportSections ?? [], sections }),
      journal: mountInsightJournal({ snapshot, insights: notes, generate: false, role: access.role }),
      notes: access.role === "client" ? [] : notes,
      canManageNotes: access.role !== "client",
      canWriteNotes: access.role !== "client" && access.project.data_domain !== "medical",
      period: snapshot.period,
    };
  });
