import { useState } from "react";
import { saveManualReportNote, updateReportNote } from "@/lib/server/report-notes";
import type { InsightRecord } from "@/lib/server/evidence-insights";
import type { ClientReportView } from "@/lib/server/client-report-view";

export function ReportNotesEditor({ projectId, period, endDate, view, notes, canWrite, reload }: { projectId: string; period: string; endDate: string; view: ClientReportView; notes: Array<InsightRecord & { revision: number }>; canWrite: boolean; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<(InsightRecord & { revision: number }) | null>(null);
  const metrics = [...new Map(view.sections.flatMap(section => section.metrics).filter(metric => metric.value !== null && (metric.provider === "gsc" || metric.provider === "ga4")).map(metric => [`${metric.provider}:${metric.name}`, metric])).values()];
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError(false);
    try { await action(); setEditing(null); reload(); }
    catch { setError(true); }
    finally { setBusy(false); }
  }
  return <section className="grid min-w-0 grid-cols-1 gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]" aria-label="Manage evidence notes">
    <h2 className="font-display text-lg font-semibold">Manage notes</h2>
    <p className="text-xs text-muted">New and edited notes stay internal until reviewed. Notes cannot change site content.</p>
    {error ? <p role="alert" className="text-sm text-bad">Could not save. Reload the report if this note has changed.</p> : null}
    <ul className="grid min-w-0 grid-cols-1 gap-2">
      {notes.map(note => <li key={note.id} className="grid min-w-0 grid-cols-1 gap-2 rounded-xl bg-raised p-3 text-sm">
        <strong>{note.title}</strong><p className="text-xs text-muted">{note.periodStart} – {note.periodEnd} · {note.generatedBy.startsWith("human:") ? "Manual" : "Assistant"} · {note.reviewState} · {note.visibility}</p>
        <div className="flex flex-wrap gap-2">
          {note.reviewState !== "approved" ? <button disabled={busy} type="button" className="rounded bg-primary px-3 py-1 text-bg" onClick={() => run(() => updateReportNote({ data: { projectId, noteId: note.id, revision: note.revision, action: "approve" } }))}>Approve for client</button> : <button disabled={busy} type="button" className="rounded px-3 py-1 text-muted" onClick={() => run(() => updateReportNote({ data: { projectId, noteId: note.id, revision: note.revision, action: "hide" } }))}>Keep internal</button>}
          {canWrite && note.generatedBy.startsWith("human:") ? <button disabled={busy} type="button" className="rounded px-3 py-1 text-primary" onClick={() => setEditing(note)}>Edit</button> : null}
        </div>
      </li>)}
    </ul>
    {canWrite && metrics.length ? <form key={editing?.id ?? "new"} className="grid min-w-0 grid-cols-1 gap-2" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
      const title = String(data.get("title") ?? ""); const body = String(data.get("body") ?? "");
      if (editing) void run(() => updateReportNote({ data: { projectId, noteId: editing.id, revision: editing.revision, action: "edit", title, body } }));
      else { const metric = metrics.find(item => `${item.provider}:${item.name}` === data.get("metric")); if (metric) void run(async () => { await saveManualReportNote({ data: { projectId, period, endDate, title, body, provider: metric.provider as "gsc" | "ga4", metricName: metric.name } }); form.reset(); }); }
    }}>
      <label className="grid min-w-0 grid-cols-1 gap-1 text-xs">Title<input name="title" className="min-w-0 rounded-lg bg-raised p-2 text-sm" maxLength={200} required defaultValue={editing?.title ?? ""} /></label>
      <label className="grid min-w-0 grid-cols-1 gap-1 text-xs">Note<textarea name="body" className="min-w-0 rounded-lg bg-raised p-2 text-sm" maxLength={2000} rows={3} required defaultValue={editing?.body ?? ""} /></label>
      {!editing ? <label className="grid min-w-0 grid-cols-1 gap-1 text-xs">Supporting measurement<select name="metric" className="min-w-0 rounded-lg bg-raised p-2 text-sm">{metrics.map(metric => <option key={`${metric.provider}:${metric.name}`} value={`${metric.provider}:${metric.name}`}>{metric.provider} · {metric.name}</option>)}</select></label> : null}
      <div className="flex gap-2"><button type="submit" disabled={busy} className="rounded-lg bg-primary px-3 py-2 text-sm text-bg">Save internal note</button>{editing ? <button type="button" className="px-3 text-sm" onClick={() => setEditing(null)}>Cancel</button> : null}</div>
    </form> : null}
  </section>;
}
