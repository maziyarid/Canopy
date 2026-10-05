import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { resolveAccess } from "./access";
import { studioAuth } from "./studio-auth";
import { loadReportingSnapshot, refreshReportingSnapshotRecord, reportClosingDate } from "./reporting-snapshot-service";
import { getProviderStates, getProviderMetricRows, getProviderSearchRows } from "../analytics/gateway.server";
import { readGatewayLedger } from "./reporting-ledger";
import { loadSearchTable } from "./search-table";
import { periodFromLabel } from "./reporting-snapshot-core";
import { parseReportSections } from "./report-sections";
import { comparisonRows } from "./report-export";
import { exportReportRecord } from "./report-export-service";
import { bindResolvedDashboardAccess, buildGatedClientDashboard } from "./client-report-view";
import { gateProjectExport, gateProjectSearch } from "./project-export-gate";
import { mountInsightJournal } from "./insight-journal-mount";
import { persistSnapshotInsights, readPeriodNoteWindow } from "./insight-persistence";

const readLedger = (projectId: string, site: string, period: import("./reporting-snapshot-core").SnapshotPeriod) =>
  readGatewayLedger(projectId, site, period, { states: getProviderStates, metrics: getProviderMetricRows });

const GetSchema = z.object({
  projectId: z.string().min(1).max(80),
  period: z.string().max(40).optional(),
  comparison: z.string().max(40).optional(),
  endDate: z.string().max(10).optional(),
  correlationId: z.string().max(80).optional(),
});

const RefreshSchema = z.object({
  projectId: z.string().min(1).max(80),
  period: z.string().max(40).optional(),
  comparison: z.string().max(40).optional(),
  endDate: z.string().max(10).optional(),
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
      comparisonLabel: data.comparison, endDate: data.endDate,
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
      comparisonLabel: data.comparison, endDate: data.endDate,
      correlationId: data.correlationId,
    });
  });

export const getProjectReport = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(GetSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await resolveAccess(sql, context.userId, context.email, data.projectId);
    const snapshot = await loadReportingSnapshot({ sql, readLedger, resolveAccess, userId: context.userId, email: context.email, projectId: data.projectId, periodLabel: data.period, comparisonLabel: data.comparison, endDate: data.endDate });
    if (access.role !== "client") await persistSnapshotInsights(sql, access, snapshot);
    const noteWindow = await readPeriodNoteWindow(sql, access, snapshot.period);
    const notes = noteWindow.notes;
    const sections = access.role === "client" ? snapshot.sections : [...snapshot.sections, snapshot.providerHealth];
    const dashboardAccess = bindResolvedDashboardAccess({
      role: access.role,
      resolvedProjectId: access.project.id,
      requestedProjectId: data.projectId,
      snapshotProjectId: snapshot.projectId,
      reportingConfigured: true,
    });
    return {
      view: buildGatedClientDashboard({
        access: dashboardAccess,
        site: snapshot.site,
        periodLabel: snapshot.period.label,
        comparisonLabel: snapshot.comparison?.label,
        grants: access.reportSections ?? [],
        sections,
      }),
      journal: mountInsightJournal({ snapshot, insights: notes, generate: false, role: access.role, truncated: noteWindow.truncated, visibleLimit: noteWindow.limit }),
      notes: access.role === "client" ? [] : notes,
      notesTruncated: noteWindow.truncated,
      visibleNoteLimit: noteWindow.limit,
      canManageNotes: access.role !== "client",
      canReadSearchTable: !access.filter.trim() && (access.role !== "client" || parseReportSections(access.reportSections).includes("search")),
      canWriteNotes: access.role !== "client" && access.project.data_domain !== "medical",
      period: snapshot.period,
      comparison: snapshot.comparison,
      comparisons: comparisonRows(snapshot),
    };
  });

export const exportProjectReport = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(GetSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await resolveAccess(sql, context.userId, context.email, data.projectId);
    const snapshot = await loadReportingSnapshot({
      sql,
      readLedger,
      resolveAccess,
      userId: context.userId,
      email: context.email,
      projectId: data.projectId,
      periodLabel: data.period,
      comparisonLabel: data.comparison,
      endDate: data.endDate,
    });
    const boundProjectId = gateProjectExport({
      role: access.role,
      resolvedProjectId: access.project.id,
      requestedProjectId: data.projectId,
      snapshotProjectId: snapshot.projectId,
    });
    return exportReportRecord({
      sql,
      readLedger,
      resolveAccess,
      userId: context.userId,
      email: context.email,
      projectId: boundProjectId,
      periodLabel: data.period,
      comparisonLabel: data.comparison,
      endDate: data.endDate,
    });
  });


export const getProjectSearchTable = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(GetSchema.extend({ offset: z.number().int().min(0).max(2000).optional() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await resolveAccess(sql, context.userId, context.email, data.projectId);
    const projectId = gateProjectSearch({
      role: access.role,
      resolvedProjectId: access.project.id,
      requestedProjectId: data.projectId,
    });
    return loadSearchTable({
      sql, resolveAccess, userId: context.userId, email: context.email,
      projectId, period: periodFromLabel(data.period, reportClosingDate(data.endDate)),
      offset: data.offset, readRows: getProviderSearchRows,
    });
  });
