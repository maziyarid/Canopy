import { useState } from "react";
import { REPORT_SECTIONS } from "@/lib/server/report-sections";
import { saveReportGrants } from "@/lib/server/report-grants";

export function ReportSectionGrants({ projectId, memberId, sections, reload }: { projectId: string; memberId: string; sections: string[]; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function toggle(section: string, checked: boolean) {
    setBusy(true); setError(false);
    try { await saveReportGrants({ data: { projectId, memberId, sections: (checked ? [...sections, section] : sections.filter(key => key !== section)) as Array<(typeof REPORT_SECTIONS)[number]> } }); await reload(); }
    catch { setError(true); }
    finally { setBusy(false); }
  }
  return <fieldset className="mt-2 flex flex-wrap gap-3 text-xs text-muted" disabled={busy}>
    <legend className="mb-1">Report sections</legend>
    {REPORT_SECTIONS.map(section => <label key={section} className="flex items-center gap-1.5 capitalize"><input type="checkbox" checked={sections.includes(section)} onChange={event => toggle(section, event.target.checked)} />{section}</label>)}
    {error ? <span role="alert">Could not save report access.</span> : null}
  </fieldset>;
}
