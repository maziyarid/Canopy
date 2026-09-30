export const REPORT_SECTIONS = ["overview", "search", "acquisition", "conversions"] as const;
export type ReportSectionKey = (typeof REPORT_SECTIONS)[number];

/** Persisted grants are untrusted input; missing grants grant nothing. */
export function parseReportSections(raw: unknown): ReportSectionKey[] {
  try {
    const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(value)) return [];
    return REPORT_SECTIONS.filter(key => value.includes(key));
  } catch {
    return [];
  }
}
