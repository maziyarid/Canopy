import type { Lang } from "./types";

// Qalam: professional explanatory / product UX; reviewed 2026-10-03.
// Evidence limits remain explicit. This catalogue is not a global style update.
const labels = {
  report: ["Analytics report", "گزارش تحلیل"], period: ["Reporting period", "بازه گزارش"],
  days7: ["Last 7 days", "۷ روز گذشته"], days28: ["Last 28 days", "۲۸ روز گذشته"], days90: ["Last 90 days", "۹۰ روز گذشته"],
  reload: ["Reload report", "بارگذاری دوباره گزارش"], ending: ["Period ending", "پایان بازه"],
  compare: ["Compare previous period", "مقایسه با بازه قبل"], export: ["Export CSV", "دریافت CSV"], exporting: ["Preparing export…", "در حال آماده‌سازی فایل…"],
  unavailable: ["This report is unavailable. Check your access or try again.", "گزارش در دسترس نیست. دسترسی خود را بررسی کنید یا دوباره تلاش کنید."],
  loading: ["Loading report…", "در حال بارگذاری گزارش…"], noGrants: ["No report sections have been granted for this project.", "برای این پروژه، دسترسی به هیچ بخش گزارش داده نشده است."],
  delay: ["Data may be delayed by the provider.", "ممکن است داده‌ها با تأخیر ارائه شوند."],
  comparison: ["Period comparison", "مقایسه بازه‌ها"], previousPeriod: ["Previous period", "بازه قبل"],
  comparisonRule: ["Changes appear only when both windows have verified coverage. A zero baseline has no percentage change.", "تغییر فقط زمانی نمایش داده می‌شود که پوشش داده در هر دو بازه تأیید شده باشد. برای مقدار پایه صفر، درصد تغییر محاسبه نمی‌شود."],
  metric: ["Metric", "شاخص"], current: ["Current", "بازه فعلی"], previous: ["Previous", "بازه قبل"], change: ["Change", "تغییر"], coverage: ["Coverage", "پوشش داده"],
  comparable: ["Comparable", "قابل مقایسه"], incomplete: ["Incomplete", "ناقص"], zero_baseline: ["Zero baseline", "مقدار پایه صفر"],
  noComparison: ["No measured comparisons are available.", "داده تأییدشده‌ای برای مقایسه وجود ندارد."],
  evidenceNotes: ["Evidence notes", "یادداشت‌های شواهد"],
  queries: ["Search queries and pages", "عبارت‌های جست‌وجو و صفحات"],
  scrollableQueries: ["Scrollable search table", "جدول جست‌وجو با پیمایش افقی"],
  sampleRule: ["Query data is a sample and excludes some queries. It does not equal site totals. Position and click rate are weighted by impressions.", "این داده‌ها نمونه‌ای از عبارت‌های جست‌وجو هستند و همه عبارت‌ها را شامل نمی‌شوند؛ بنابراین با مجموع داده‌های سایت برابر نیستند. جایگاه میانگین و نرخ کلیک بر اساس تعداد نمایش محاسبه می‌شوند."],
  searchUnavailable: ["Search rows are unavailable. Check your access or try again.", "داده‌های جست‌وجو در دسترس نیستند. دسترسی خود را بررسی کنید یا دوباره تلاش کنید."],
  searchLoading: ["Loading search rows…", "در حال بارگذاری داده‌های جست‌وجو…"],
  noRows: ["No daily query records are stored for this period.", "برای این بازه، داده روزانه عبارت‌های جست‌وجو ذخیره نشده است."],
  latestDate: ["Latest stored date", "آخرین تاریخ ذخیره‌شده"],
  truncated: ["The stored result exceeds the retrieval limit; these rows are incomplete.", "حجم داده از سقف دریافت بیشتر است؛ ردیف‌های نمایش‌داده‌شده کامل نیستند."],
  query: ["Query", "عبارت جست‌وجو"], page: ["Page", "صفحه"], clicks: ["Clicks", "کلیک"], impressions: ["Impressions", "نمایش"], ctr: ["Click rate", "نرخ کلیک"], averagePosition: ["Average position", "جایگاه میانگین"],
  retrieved: ["retrieved rows", "ردیف دریافت‌شده"], of: ["of", "از"], previousRows: ["Previous rows", "ردیف‌های قبل"], nextRows: ["Next rows", "ردیف‌های بعد"],
} satisfies Record<string, [string, string]>;
export type ReportCopyKey = keyof typeof labels;
export function reportText(lang: Lang, key: ReportCopyKey) { return labels[key][lang === "fa" ? 1 : 0]; }
