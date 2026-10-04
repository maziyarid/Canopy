import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { getProjectReport, exportProjectReport } from "@/lib/server/reporting-snapshot";
import { ClientReportDashboard } from "./client-report-dashboard";
import { SearchPerformanceTable } from "./search-performance-table";
import { InsightJournal } from "./insight-journal";
import { ReportNotesEditor } from "./report-notes-editor";

import { useLocale } from "@/lib/locale";
import { reportText, type ReportCopyKey } from "@/lib/report-copy";

type Report = Awaited<ReturnType<typeof getProjectReport>>;

export function ProjectReport({ projectId }: { projectId: string }) {
  const lang = useLocale(state => state.lang);
  const t = (key: ReportCopyKey) => reportText(lang, key);
  const [period, setPeriod] = useState("last_28d");
  const [endDate, setEndDate] = useState("");
  const [comparison, setComparison] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(false);
    getProjectReport({ data: { projectId, period, comparison: comparison ? undefined : "", endDate: endDate || undefined } }).then(data => {
      if (!cancelled) setReport(data);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [projectId, period, endDate, comparison, revision]);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4" aria-label={t("report")}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm" htmlFor="report-period">{t("period")}</label>
        <select id="report-period" className="rounded-lg bg-raised px-3 py-2 min-h-11 text-sm" value={period} onChange={event => setPeriod(event.target.value)}>
          <option value="last_7d">{t("days7")}</option>
          <option value="last_28d">{t("days28")}</option>
          <option value="last_90d">{t("days90")}</option>
        </select>
        <button type="button" className="rounded-lg bg-raised px-3 py-2 min-h-11 text-sm hover:text-primary" onClick={() => setRevision(value => value + 1)}>{t("reload")}</button>
        <label className="flex items-center gap-2 text-sm">{t("ending")}<input type="date" className="rounded-lg bg-raised px-3 py-2" value={endDate} max={new Date().toISOString().slice(0, 10)} onChange={event => setEndDate(event.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={comparison} onChange={event => setComparison(event.target.checked)} />{t("compare")}</label>
        <button type="button" disabled={!report || exporting || !report.view.sections.length} className="rounded-lg bg-raised px-3 py-2 min-h-11 text-sm hover:text-primary disabled:opacity-50" onClick={async () => {
          setExporting(true);
          try {
            const file = await exportProjectReport({ data: { projectId, period, comparison: comparison ? undefined : "", endDate: endDate || undefined } });
            const href = URL.createObjectURL(new Blob(["\uFEFF", file.content], { type: file.contentType }));
            const link = document.createElement("a"); link.href = href; link.download = file.filename;
            link.click(); URL.revokeObjectURL(href);
          } catch { setError(true); } finally { setExporting(false); }
        }}>{exporting ? t("exporting") : t("export")}</button>
      </div>
      {error ? <p role="alert" className="text-sm text-muted">{t("unavailable")}</p> : !report ? <div role="status" className="flex items-center gap-2 text-sm text-muted"><LoaderCircle className="size-5 animate-spin" />{t("loading")}</div> : !report.view.sections.length ? <p className="rounded-xl bg-surface p-4 text-sm text-muted">{t("noGrants")}</p> : <>
        <p className="text-xs text-muted">{report.period.start} – {report.period.end} · {t("delay")}</p>
        <ClientReportDashboard view={report.view} />
        {report.comparison ? <section className="min-w-0 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]" aria-label={t("comparison")}>
          <h2 className="text-sm font-medium">{t("previousPeriod")}: {report.comparison.start} – {report.comparison.end}</h2>
          <p className="mt-1 text-xs text-muted">{t("comparisonRule")}</p>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-start text-sm"><thead><tr><th className="p-2">{t("metric")}</th><th className="p-2">{t("current")}</th><th className="p-2">{t("previous")}</th><th className="p-2">{t("change")}</th><th className="p-2">{t("coverage")}</th></tr></thead><tbody>
            {report.comparisons.map(row => <tr key={`${row.section}:${row.provider}:${row.metric}`} className="border-t border-border"><td className="p-2">{row.metric} <span className="text-xs text-muted">{row.provider}</span></td><td className="p-2 tabular-nums">{row.current ?? "—"}</td><td className="p-2 tabular-nums">{row.previous ?? "—"}</td><td className="p-2 tabular-nums">{row.relativeChange === null ? "—" : `${(row.relativeChange * 100).toFixed(1)}%`}</td><td className="p-2 text-xs">{t(row.reason)}</td></tr>)}
          </tbody></table>{!report.comparisons.length ? <p className="py-3 text-sm text-muted">{t("noComparison")}</p> : null}</div>
        </section> : null}
        {report.canReadSearchTable ? <SearchPerformanceTable projectId={projectId} period={period} endDate={endDate} revision={revision} /> : null}
        {report.canManageNotes ? <ReportNotesEditor key={`${projectId}:${period}:${endDate}`} projectId={projectId} period={period} endDate={report.period.end} view={report.view} notes={report.notes} canWrite={report.canWriteNotes} reload={() => setRevision(value => value + 1)} /> : null}
        <section className="min-w-0 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]" aria-label={t("evidenceNotes")}>
          <h2 className="mb-3 font-display text-lg font-semibold">{t("evidenceNotes")}</h2>
          {report.journal.warnings.map(warning => <p className="mb-2 text-sm text-muted" key={warning}>{warning}</p>)}
          <InsightJournal view={report.journal.journal} />
        </section>
      </>}
    </div>
  );
}
