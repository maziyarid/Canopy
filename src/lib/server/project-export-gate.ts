import { bindResolvedDashboardAccess, type ReportRole } from "./client-report-view";

/**
 * AAX-80 export gate. Export may proceed only with the resolved project id.
 * Client-supplied and snapshot project ids must match that binding exactly.
 * This does not call /api/v1/reporting/snapshot.
 */
export function gateProjectExport(input: {
  role: ReportRole;
  resolvedProjectId: string;
  requestedProjectId: string;
  snapshotProjectId: string;
}): string {
  return bindResolvedDashboardAccess({
    role: input.role,
    resolvedProjectId: input.resolvedProjectId,
    requestedProjectId: input.requestedProjectId,
    snapshotProjectId: input.snapshotProjectId,
    reportingConfigured: true,
  }).boundProjectId;
}
