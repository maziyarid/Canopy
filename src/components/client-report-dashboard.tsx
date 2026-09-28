import type { ClientReportView } from "@/lib/server/client-report-view";
import { CHANNEL_KEYS, channelMeasuredTotal } from "@/lib/server/client-report-view";

function tone(status: string) {
  if (status === "ok") return "text-emerald-700";
  if (status === "stale" || status === "partial") return "text-amber-700";
  return "text-stone-500";
}

function formatChannelTotal(view: ClientReportView, channel: (typeof CHANNEL_KEYS)[number]) {
  if (
    view.acquisitionStatus === "unavailable" ||
    view.acquisitionStatus === "no_data" ||
    view.acquisitionStatus === "degraded" ||
    view.acquisitionStatus === "unknown"
  ) {
    return "—";
  }
  const total = channelMeasuredTotal(view.channels[channel]);
  return total === null ? "—" : total;
}

export function ClientReportDashboard({
  view,
  adminReason = false,
}: {
  view: ClientReportView;
  adminReason?: boolean;
}) {
  return (
    <section className="flex flex-1 flex-col gap-4" aria-label="Client report">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Ms Robot</p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">{view.site}</h1>
          <p className="text-xs text-subtle">
            {view.periodLabel}
            {view.comparisonLabel ? ` vs ${view.comparisonLabel}` : ""}
          </p>
        </div>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {view.sections.map((section) => (
          <li key={section.key} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium capitalize">{section.key}</h2>
              <span className={`text-xs ${tone(section.status)}`}>{section.clientLabel}</span>
            </div>
            {section.freshness ? <p className="mt-1 text-xs text-subtle">{section.freshness}</p> : null}
            {section.warning ? <p className="mt-2 text-xs text-muted">{section.warning}</p> : null}
            {adminReason && section.reasonCode ? (
              <p className="mt-1 font-mono text-[10px] text-subtle" title={section.reasonCode}>
                {section.reasonCode}
              </p>
            ) : null}
            <dl className="mt-3 grid gap-1 text-sm">
              {section.metrics.slice(0, 6).map((metric) => (
                <div key={`${metric.provider}-${metric.name}`} className="flex justify-between gap-2">
                  <dt className="truncate text-subtle">
                    {metric.name}
                    <span className="ml-1 text-[10px] uppercase">{metric.provenance === "first_party" ? "1P" : "est"}</span>
                  </dt>
                  <dd className="tabular-nums">{metric.value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="text-sm font-medium">Acquisition channels</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {CHANNEL_KEYS.map((channel) => {
            return (
              <li key={channel} className="rounded-xl bg-raised px-3 py-2">
                <p className="text-xs capitalize text-subtle">{channel}</p>
                <p className="font-medium tabular-nums">{formatChannelTotal(view, channel)}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
