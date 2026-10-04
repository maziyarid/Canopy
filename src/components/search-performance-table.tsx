import { useEffect, useState } from "react";
import { getProjectSearchTable } from "@/lib/server/reporting-snapshot";

import { useLocale } from "@/lib/locale";
import { reportText, type ReportCopyKey } from "@/lib/report-copy";

type Table = Awaited<ReturnType<typeof getProjectSearchTable>>;
export function SearchPerformanceTable({ projectId, period, endDate, revision }: { projectId: string; period: string; endDate: string; revision: number }) {
  const lang = useLocale(state => state.lang);
  const t = (key: ReportCopyKey) => reportText(lang, key);
  const [offset, setOffset] = useState(0);
  const [table, setTable] = useState<Table | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => setOffset(0), [projectId, period, endDate]);
  useEffect(() => {
    let cancelled = false; setTable(null); setError(false);
    getProjectSearchTable({ data: { projectId, period, endDate: endDate || undefined, offset } }).then(data => { if (!cancelled) setTable(data); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [projectId, period, endDate, revision, offset]);
  return <section className="min-w-0 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]" aria-label={t("queries")}>
    <h2 className="text-sm font-medium">{t("queries")}</h2>
    <p className="mt-1 text-xs text-muted">{t("sampleRule")}</p>
    {error || table?.status === "unavailable" ? <p role="status" className="mt-3 text-sm text-muted">{t("searchUnavailable")}</p> : !table ? <p role="status" className="mt-3 text-sm text-muted">{t("searchLoading")}</p> : !table.rows.length ? <p className="mt-3 text-sm text-muted">{t("noRows")}</p> : <>
      <p className="mt-2 text-xs text-muted">{t("latestDate")}: {table.dataDate}{table.truncated ? ` · ${t("truncated")}` : ""}</p>
      <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={t("scrollableQueries")}><table className="w-full min-w-[40rem] text-start text-sm"><thead><tr>{(["query", "page", "clicks", "impressions", "ctr", "averagePosition"] as const).map(label => <th className="p-2" key={label}>{t(label)}</th>)}</tr></thead><tbody>
        {table.rows.map((row, index) => <tr className="border-t border-border" key={`${offset}:${index}`}><td className="max-w-64 break-words p-2">{row.query}</td><td className="max-w-80 break-all p-2">{row.page}</td><td className="p-2 tabular-nums">{row.clicks}</td><td className="p-2 tabular-nums">{row.impressions}</td><td className="p-2 tabular-nums">{row.ctr === null ? "—" : `${(row.ctr * 100).toFixed(1)}%`}</td><td className="p-2 tabular-nums">{row.averagePosition?.toFixed(1) ?? "—"}</td></tr>)}
      </tbody></table></div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span>{table.offset + 1}–{table.offset + table.rows.length} {t("of")} {table.total} {t("retrieved")}</span><button className="rounded-lg bg-raised px-3 py-2 min-h-11 disabled:opacity-50" type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - table.limit))}>{t("previousRows")}</button><button className="rounded-lg bg-raised px-3 py-2 min-h-11 disabled:opacity-50" type="button" disabled={offset + table.limit >= table.total} onClick={() => setOffset(offset + table.limit)}>{t("nextRows")}</button></div>
    </>}
  </section>;
}
