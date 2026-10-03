import { Badge, Button } from "@/components/ui";
import type { AdaEventView } from "@/lib/server/ada-events-view";
import { RefreshCw } from "lucide-react";

function stamp(value: string | undefined, lang: "fa" | "en") {
  if (!value || Number.isNaN(Date.parse(value))) return "—";
  return new Date(value).toLocaleString(lang === "fa" ? "fa-IR" : "en-GB", {
    timeZone: "Asia/Tehran",
  });
}

export function AdaEventsPanel({
  data,
  lang,
  onRefresh,
}: {
  data: { available: boolean; items: AdaEventView[]; generatedAt?: string };
  lang: "fa" | "en";
  onRefresh: () => void;
}) {
  const ui =
    lang === "fa"
      ? {
          title: "رویدادهای Ada",
          body: "رویدادهای ثبت‌شده برای این پروژه. پیشنهادها برای اجرا همچنان به مجوز Ada نیاز دارند.",
          unavailable:
            "دریافت رویدادها فعلاً در دسترس نیست. دوباره بررسی کنید؛ داده‌های قبلی پروژه حفظ شده‌اند.",
          empty: "هنوز رویدادی برای این پروژه ثبت نشده است.",
          refresh: "بررسی دوباره رویدادها",
          confirmed: "دریافت تایید شد",
          pending: "دریافت هنوز تایید نشده",
          proposal: "پیشنهاد؛ نیازمند مجوز",
          source: "منبع اعلام‌شده",
          received: "زمان ثبت",
          reference: "شناسه مرتبط",
          updated: "آخرین بررسی",
          event: "رویداد",
        }
      : {
          title: "Ada events",
          body: "Recorded events for this project. Proposals still require Ada authorisation before execution.",
          unavailable:
            "Event receipts are unavailable. Check again; existing project data is retained.",
          empty: "No event receipt has been recorded for this project yet.",
          refresh: "Check events again",
          confirmed: "Receipt acknowledged",
          pending: "Acknowledgement unconfirmed",
          proposal: "Proposal; authorisation required",
          source: "Reported source",
          received: "Recorded",
          reference: "Correlation reference",
          updated: "Last checked",
          event: "Event",
        };
  return (
    <section
      aria-label={ui.title}
      className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{ui.title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">{ui.body}</p>
          {data.generatedAt ? (
            <p className="mt-1 text-xs text-subtle">
              {ui.updated}: {stamp(data.generatedAt, lang)}
            </p>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-4" />
          {ui.refresh}
        </Button>
      </div>
      {!data.available ? (
        <p role="status" className="mt-3 rounded-lg bg-warn/10 p-3 text-sm text-warn">
          {ui.unavailable}
        </p>
      ) : !data.items.length ? (
        <p className="mt-3 text-sm text-muted">{ui.empty}</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {data.items.map((event) => (
            <li key={event.event_id} className="min-w-0 rounded-xl bg-paper p-3 text-ink">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="break-all text-sm font-medium">
                  <bdi>{event.event_type}</bdi>
                </span>
                <Badge className="text-ink" tone={event.state === "acknowledged" ? "good" : "warn"}>
                  {event.state === "acknowledged" ? ui.confirmed : ui.pending}
                </Badge>
              </div>
              {event.action_state === "proposal_only" ? (
                <p className="mt-2 text-sm font-medium">{ui.proposal}</p>
              ) : null}
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-ink-muted">{ui.source}</dt>
                  <dd className="mt-1 break-all">
                    <bdi>{event.source}</bdi>
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{ui.received}</dt>
                  <dd className="mt-1">{stamp(event.received_at, lang)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{ui.reference}</dt>
                  <dd className="mt-1 break-all">
                    <bdi>{event.correlation_id || "—"}</bdi>
                  </dd>
                </div>
              </dl>
              <p className="mt-2 break-all text-xs text-ink-muted">
                {ui.event}: <bdi>{event.event_id}</bdi>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
