import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { getProjectReport } from "@/lib/server/reporting-snapshot";
import { ClientReportDashboard } from "./client-report-dashboard";
import { InsightJournal } from "./insight-journal";
import { ReportNotesEditor } from "./report-notes-editor";

type Report = Awaited<ReturnType<typeof getProjectReport>>;

export function ProjectReport({ projectId }: { projectId: string }) {
  const [period, setPeriod] = useState("last_28d");
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(false);
    getProjectReport({ data: { projectId, period } }).then(data => {
      if (!cancelled) setReport(data);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [projectId, period, revision]);
  return (
    <div className="grid gap-4" aria-label="Analytics report">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm" htmlFor="report-period">Reporting period</label>
        <select id="report-period" className="rounded-lg bg-raised px-3 py-2 text-sm" value={period} onChange={event => setPeriod(event.target.value)}>
          <option value="last_7d">Last 7 days</option>
          <option value="last_28d">Last 28 days</option>
          <option value="last_90d">Last 90 days</option>
        </select>
        <button type="button" className="rounded-lg bg-raised px-3 py-2 text-sm hover:text-primary" onClick={() => setRevision(value => value + 1)}>Reload report</button>
      </div>
      {error ? <p role="alert" className="text-sm text-muted">This report is unavailable. Check your access or try again.</p> : !report ? <div role="status" className="flex items-center gap-2 text-sm text-muted"><LoaderCircle className="size-5 animate-spin" />Loading report…</div> : !report.view.sections.length ? <p className="rounded-xl bg-surface p-4 text-sm text-muted">No report sections have been granted for this project.</p> : <>
        <p className="text-xs text-muted">{report.period.start} – {report.period.end} · Data may be delayed by the provider.</p>
        <ClientReportDashboard view={report.view} />
        {report.canManageNotes ? <ReportNotesEditor projectId={projectId} period={period} view={report.view} notes={report.notes} canWrite={report.canWriteNotes} reload={() => setRevision(value => value + 1)} /> : null}
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]" aria-label="Evidence notes">
          <h2 className="mb-3 font-display text-lg font-semibold">Evidence notes</h2>
          {report.journal.warnings.map(warning => <p className="mb-2 text-sm text-muted" key={warning}>{warning}</p>)}
          <InsightJournal view={report.journal.journal} />
        </section>
      </>}
    </div>
  );
}
