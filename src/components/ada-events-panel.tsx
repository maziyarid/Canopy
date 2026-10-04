import { Badge, Button, Input } from "@/components/ui";
import type { AdaEventView } from "@/lib/server/ada-events-view";
import { ADA_EVENT_LABELS, filterAdaEvents, type AdaEventFilter } from "@/lib/ada-event-list";
import { ChevronDown, RefreshCw, Search, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 20;

export function AdaEventsPanel({
  data,
  lang,
  refreshing = false,
  onRefresh,
}: {
  data: { available: boolean; items: AdaEventView[]; generatedAt?: string };
  lang: "fa" | "en";
  refreshing?: boolean;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AdaEventFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const input = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const listId = useId();
  const locale = lang === "fa" ? "fa-IR" : "en-GB";
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Tehran",
      }),
    [locale],
  );
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const stamp = (value?: string) =>
    value && !Number.isNaN(Date.parse(value)) ? formatter.format(new Date(value)) : "—";
  const ui =
    lang === "fa"
      ? {
          title: "رویدادهای Ada",
          body: "رویدادهای ثبت‌شده برای این پروژه. پیشنهادها برای اجرا همچنان به مجوز Ada نیاز دارند.",
          unavailable:
            "دریافت رویدادها فعلاً در دسترس نیست. دوباره بررسی کنید؛ داده‌های قبلی پروژه حفظ شده‌اند.",
          empty: "هنوز رویدادی برای این پروژه ثبت نشده است.",
          refresh: "بررسی دوباره رویدادها",
          checking: "در حال بررسی رویدادها…",
          confirmed: "دریافت تایید شد",
          pending: "دریافت هنوز تایید نشده",
          proposal: "پیشنهاد؛ نیازمند مجوز",
          source: "منبع اعلام‌شده",
          received: "زمان ثبت",
          reference: "شناسه مرتبط",
          updated: "آخرین بررسی",
          event: "شناسه رویداد",
          reported: "زمان اعلام منبع",
          changed: "آخرین تغییر وضعیت ثبت",
          site: "سایت",
          code: "نوع رویداد",
          details: "جزئیات رویداد",
          search: "جستجوی رویدادها",
          searchHint: "شناسه، منبع یا نوع رویداد",
          clearSearch: "پاک کردن جستجو",
          reset: "پاک کردن فیلترها",
          noResults: "رویدادی با این جستجو و فیلتر پیدا نشد.",
          all: "همه",
          unconfirmed: "تایید نشده",
          acknowledged: "تایید شده",
          proposals: "پیشنهادها",
          filters: "فیلتر رویدادها",
          more: "نمایش رویدادهای بیشتر",
          window: "جستجو در حداکثر ۵۰ رویداد اخیر این پروژه است.",
          timezone: "زمان‌ها به وقت تهران هستند.",
          summary: "رویدادهای دریافت‌شده",
          shown: (a: string, b: string) => `${a} رویداد از ${b} نتیجه نمایش داده شده`,
        }
      : {
          title: "Ada events",
          body: "Recorded events for this project. Proposals still require Ada authorisation before execution.",
          unavailable:
            "Event receipts are unavailable. Check again; existing project data is retained.",
          empty: "No event receipt has been recorded for this project yet.",
          refresh: "Check events again",
          checking: "Checking events…",
          confirmed: "Receipt acknowledged",
          pending: "Acknowledgement unconfirmed",
          proposal: "Proposal; authorisation required",
          source: "Reported source",
          received: "Recorded",
          reference: "Correlation reference",
          updated: "Last checked",
          event: "Event reference",
          reported: "Reported by source",
          changed: "Receipt state updated",
          site: "Site",
          code: "Event type",
          details: "Event details",
          search: "Search events",
          searchHint: "Reference, source or event type",
          clearSearch: "Clear search",
          reset: "Clear filters",
          noResults: "No events match this search and filter.",
          all: "All",
          unconfirmed: "Unconfirmed",
          acknowledged: "Acknowledged",
          proposals: "Proposals",
          filters: "Event filters",
          more: "Show more events",
          window: "Search covers up to the latest 50 receipts for this project.",
          timezone: "Times are shown in Tehran time.",
          summary: "Fetched receipts",
          shown: (a: string, b: string) => `Showing ${a} of ${b} matching events`,
        };
  const filtered = useMemo(
    () => filterAdaEvents(data.items, filter, query),
    [data.items, filter, query],
  );
  const visible = filtered.slice(0, visibleCount);
  const counts = {
    all: data.items.length,
    unconfirmed: data.items.filter((e) => e.state === "recorded").length,
    acknowledged: data.items.filter((e) => e.state === "acknowledged").length,
    proposals: data.items.filter((e) => e.action_state === "proposal_only").length,
  };
  function reset() {
    setQuery("");
    setFilter("all");
    setVisibleCount(PAGE_SIZE);
    input.current?.focus();
  }
  return (
    <section
      aria-label={ui.title}
      className="min-w-0 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{ui.title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">{ui.body}</p>
          <p className="mt-2 text-xs text-muted">
            {ui.window} {ui.timezone}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 shrink-0"
          disabled={refreshing}
          aria-busy={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-4 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
          />
          {ui.refresh}
        </Button>
      </div>
      <p role="status" aria-atomic="true" className="mt-2 min-h-5 text-xs text-muted">
        {refreshing
          ? ui.checking
          : data.generatedAt && data.available
            ? `${ui.updated}: ${stamp(data.generatedAt)}`
            : ""}
      </p>
      {!data.available ? (
        <p role="status" className="mt-3 rounded-lg bg-warn/10 p-3 text-sm text-warn">
          {ui.unavailable}
        </p>
      ) : !data.items.length ? (
        <p className="mt-3 text-sm text-muted">{ui.empty}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3">
            <label htmlFor={searchId} className="text-sm font-medium">
              {ui.search}
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-3.5 size-4 text-muted"
              />
              <Input
                ref={input}
                id={searchId}
                type="search"
                value={query}
                maxLength={240}
                autoComplete="off"
                className="h-11 ps-9 pe-12 placeholder:text-muted"
                placeholder={ui.searchHint}
                aria-controls={listId}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
              />
              {query ? (
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  className="absolute end-0 top-0 h-11 w-11 px-0"
                  aria-label={ui.clearSearch}
                  onClick={() => {
                    setQuery("");
                    setVisibleCount(PAGE_SIZE);
                    input.current?.focus();
                  }}
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              ) : null}
            </div>
            <div role="group" aria-label={ui.filters} className="flex flex-wrap gap-2">
              {(["all", "unconfirmed", "acknowledged", "proposals"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={filter === value ? "primary" : "ghost"}
                  className="min-h-11"
                  aria-pressed={filter === value}
                  onClick={() => {
                    setFilter(value);
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  {ui[value]} <span className="tabular-nums">{number.format(counts[value])}</span>
                </Button>
              ))}
            </div>
          </div>
          <p role="status" aria-atomic="true" className="mt-3 min-h-5 text-xs text-muted">
            {ui.shown(number.format(visible.length), number.format(filtered.length))}
          </p>
          {!filtered.length ? (
            <div className="mt-3 rounded-xl bg-raised p-4">
              <p className="text-sm text-muted">{ui.noResults}</p>
              <Button type="button" variant="quiet" className="mt-2 min-h-11" onClick={reset}>
                {ui.reset}
              </Button>
            </div>
          ) : null}
          <ul id={listId} className="mt-3 grid gap-3" aria-busy={refreshing}>
            {visible.map((event) => (
              <li key={event.event_id} className="min-w-0 rounded-xl bg-paper p-3 text-ink">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {ADA_EVENT_LABELS[event.event_type][lang]}
                  </h3>
                  <Badge
                    className="text-ink"
                    tone={event.state === "acknowledged" ? "good" : "warn"}
                  >
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
                    <dd className="mt-1">
                      <time dateTime={event.received_at}>{stamp(event.received_at)}</time>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">{ui.reference}</dt>
                    <dd className="mt-1 break-all">
                      <bdi>{event.correlation_id || "—"}</bdi>
                    </dd>
                  </div>
                </dl>
                <details className="group mt-3 border-t border-rule pt-2">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-sm text-xs font-medium hover:bg-ink/5">
                    {ui.details}
                    <ChevronDown aria-hidden="true" className="size-4 group-open:rotate-180" />
                  </summary>
                  <dl className="mt-2 grid gap-3 text-xs sm:grid-cols-2">
                    {[
                      [ui.event, event.event_id],
                      [ui.site, event.site_key],
                      [ui.code, event.event_type],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-ink-muted">{label}</dt>
                        <dd className="mt-1 break-all font-mono">
                          <bdi>{value}</bdi>
                        </dd>
                      </div>
                    ))}
                    <div>
                      <dt className="text-ink-muted">{ui.reported}</dt>
                      <dd className="mt-1">{stamp(event.reported_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">{ui.changed}</dt>
                      <dd className="mt-1">{stamp(event.updated_at)}</dd>
                    </div>
                  </dl>
                </details>
              </li>
            ))}
          </ul>
          {visible.length < filtered.length ? (
            <Button
              type="button"
              variant="ghost"
              className="mt-4 min-h-11"
              aria-controls={listId}
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            >
              {ui.more}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
