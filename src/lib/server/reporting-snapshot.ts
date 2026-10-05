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
import { clientComparisonRows, clientEvidenceExportCsv, comparisonRows } from "./report-export";
import { exportReportRecord } from "./report-export-service";
import { bindResolvedDashboardAccess, buildGatedClientDashboard, clientSafePeriod, redactClientText } from "./client-report-view";
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
    const view = buildGatedClientDashboard({
      access: dashboardAccess,
      site: snapshot.site,
      periodLabel: snapshot.period.label,
      comparisonLabel: snapshot.comparison?.label,
      grants: access.reportSections ?? [],
      sections,
    });
    return {
      view,
      journal: mountInsightJournal({
        snapshot,
        insights: notes,
        generate: false,
        role: access.role,
        projectId: dashboardAccess.boundProjectId,
        truncated: noteWindow.truncated,
        visibleLimit: noteWindow.limit,
      }),
      notes: access.role === "client" ? [] : notes,
      notesTruncated: noteWindow.truncated,
      visibleNoteLimit: noteWindow.limit,
      canManageNotes: access.role !== "client",
      canReadSearchTable: !access.filter.trim() && (access.role !== "client" || parseReportSections(access.reportSections).includes("search")),
      canWriteNotes: access.role !== "client" && access.project.data_domain !== "medical",
      period: access.role === "client" ? clientSafePeriod(snapshot.period) : snapshot.period,
      comparison: access.role === "client" ? clientSafePeriod(snapshot.comparison) : snapshot.comparison,
      comparisons: access.role === "client"
        ? clientComparisonRows(snapshot, view.sections.map((section) => section.key))
        : comparisonRows(snapshot),
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
    if (access.role === "client") {
      const noteWindow = await readPeriodNoteWindow(sql, access, snapshot.period);
      const dashboardAccess = bindResolvedDashboardAccess({
        role: access.role,
        resolvedProjectId: boundProjectId,
        requestedProjectId: data.projectId,
        snapshotProjectId: snapshot.projectId,
        reportingConfigured: true,
      });
      const view = buildGatedClientDashboard({
        access: dashboardAccess,
        site: snapshot.site,
        periodLabel: snapshot.period.label,
        comparisonLabel: snapshot.comparison?.label,
        grants: access.reportSections ?? [],
        sections: snapshot.sections,
      });
      const journal = mountInsightJournal({
        snapshot,
        insights: noteWindow.notes,
        generate: false,
        role: access.role,
        projectId: boundProjectId,
        truncated: noteWindow.truncated,
        visibleLimit: noteWindow.limit,
      });
      const periodStart = redactClientText(snapshot.period.start) ?? "";
      const periodEnd = redactClientText(snapshot.period.end) ?? "";
      const content = clientEvidenceExportCsv({
        site: view.site,
        periodStart,
        periodEnd,
        sections: view.sections,
        evidenceTitles: journal.journal.days.flatMap((day) => day.cards.map((card) => card.title)),
      });
      await sql`insert into operation_receipts(id,project_id,actor_ref,operation,target_ref,status,evidence)
        values (${crypto.randomUUID()},${boundProjectId},${context.userId},'report.export.csv',${boundProjectId},'completed',${JSON.stringify({ schemaVersion: snapshot.schemaVersion, start: periodStart, end: periodEnd, clientSafe: true, evidenceTitleCount: journal.journal.days.reduce((count, day) => count + day.cards.length, 0) })})`;
      return { content, contentType: "text/csv;charset=utf-8", filename: "ms-robot-client-report.csv" };
    }
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
