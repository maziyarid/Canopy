import { loadReportingSnapshot } from "./reporting-snapshot-service.ts";
import { reportCsv } from "./report-export.ts";

export async function exportReportRecord(opts: Parameters<typeof loadReportingSnapshot>[0]) {
  const snapshot = await loadReportingSnapshot(opts);
  const content = reportCsv(snapshot);
  await opts.sql`insert into operation_receipts(id,project_id,actor_ref,operation,target_ref,status,evidence)
    values (${crypto.randomUUID()},${snapshot.projectId},${opts.userId},'report.export.csv',${snapshot.projectId},'completed',${JSON.stringify({ schemaVersion: snapshot.schemaVersion, start: snapshot.period.start, end: snapshot.period.end, sections: snapshot.sections.map(section => section.key), comparison: Boolean(snapshot.comparison) })})`;
  return { content, contentType: "text/csv;charset=utf-8", filename: `ms-robot-report-${snapshot.period.start}-${snapshot.period.end}.csv` };
}
