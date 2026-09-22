import { Badge, Button } from "@/components/ui";
import { useLocale } from "@/lib/locale";
import type { ProviderKey } from "@/lib/analytics/contracts";
import {
  getProviderAdmin,
  requestProviderSync,
  type ProviderAdminView,
} from "@/lib/server/provider-admin";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  gsc: "Google Search Console",
  ga4: "Google Analytics 4",
  gtm: "Google Tag Manager",
  clarity: "Microsoft Clarity",
  bing_webmaster: "Bing Webmaster",
  semrush: "Semrush",
  ubersuggest: "Ubersuggest",
  mangools: "Mangools",
};

function tone(status: string) {
  if (status === "ok") return "good" as const;
  if (status === "stale" || status === "degraded") return "warn" as const;
  if (status === "error") return "bad" as const;
  return "muted" as const;
}

function stamp(value: string | null | undefined, locale: "fa" | "en") {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(locale === "fa" ? "fa-IR" : "en-GB");
}

export function ProviderAdminPanel({ projectId }: { projectId: string }) {
  const lang = useLocale((state) => state.lang);
  const [data, setData] = useState<ProviderAdminView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<ProviderKey | null>(null);

  const ui =
    lang === "fa"
      ? {
          title: "منابع داده",
          body: "وضعیت اتصال، تازگی داده و اجرای همگام‌سازی هر منبع. اطلاعات ورود و توکن‌ها در این صفحه نمایش داده نمی‌شوند.",
          runtime: "سرویس همگام‌سازی",
          online: "فعال",
          offline: "در دسترس نیست",
          test: "بررسی اتصال",
          account: "حساب / Property",
          permission: "سطح دسترسی",
          freshness: "تازگی داده",
          lastAttempt: "آخرین تلاش",
          lastSuccess: "آخرین موفقیت",
          error: "آخرین خطا",
          ledger: "تاریخچه همگام‌سازی",
          empty: "هنوز اجرای همگام‌سازی برای این سایت ثبت نشده است.",
          provider: "منبع",
          runStatus: "نتیجه",
          window: "بازه",
          started: "شروع",
          rows: "رکورد",
          queued: "درخواست ثبت شد.",
        }
      : {
          title: "Data providers",
          body: "Connection, freshness and sync state for each provider. Credentials and tokens are never displayed here.",
          runtime: "Sync runtime",
          online: "Available",
          offline: "Unavailable",
          test: "Test sync",
          account: "Account / property",
          permission: "Permission",
          freshness: "Data freshness",
          lastAttempt: "Last attempt",
          lastSuccess: "Last success",
          error: "Last error",
          ledger: "Sync ledger",
          empty: "No sync run has been recorded for this site yet.",
          provider: "Provider",
          runStatus: "Result",
          window: "Window",
          started: "Started",
          rows: "Rows",
          queued: "Sync request recorded.",
        };

  const load = useCallback(async () => {
    try {
      setError("");
      setData(await getProviderAdmin({ data: { projectId } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider admin unavailable");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data && !error) {
    return (
      <div className="grid min-h-48 place-items-center text-muted">
        <RefreshCw className="size-5 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <p className="rounded-xl bg-bad/10 p-4 text-sm text-bad">{error}</p>;
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">{ui.title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted">{ui.body}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">{ui.runtime}</span>
            <Badge tone={data.runtimeAvailable ? "good" : "bad"}>
              {data.runtimeAvailable ? ui.online : ui.offline}
            </Badge>
          </div>
        </div>
        {!data.runtimeAvailable && data.runtimeError ? (
          <p className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-xs text-bad">
            {data.runtimeError}
          </p>
        ) : null}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {data.providers.map((provider) => (
          <section
            key={provider.provider}
            className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  {PROVIDER_LABELS[provider.provider]}
                </h3>
                <p className="mt-0.5 font-mono text-xs text-subtle">{provider.provider}</p>
              </div>
              <Badge tone={tone(provider.status)}>{provider.status}</Badge>
            </div>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-subtle">{ui.account}</dt>
                <dd className="mt-0.5 break-all">{provider.accountRef || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">{ui.permission}</dt>
                <dd className="mt-0.5">{provider.permissionTier || provider.capability || "read"}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">{ui.freshness}</dt>
                <dd className="mt-0.5">{stamp(provider.freshness || provider.connectionFreshness, lang)}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">{ui.lastAttempt}</dt>
                <dd className="mt-0.5">{stamp(provider.last_attempt || provider.connectionLastAttempt, lang)}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">{ui.lastSuccess}</dt>
                <dd className="mt-0.5">{stamp(provider.last_success || provider.connectionLastSuccess, lang)}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">{ui.error}</dt>
                <dd className="mt-0.5 break-words text-bad">
                  {provider.last_error || provider.connectionError || "—"}
                </dd>
              </div>
            </dl>
            <Button
              className="mt-4"
              size="sm"
              variant="ghost"
              disabled={!data.runtimeAvailable || busy !== null}
              onClick={async () => {
                setBusy(provider.provider);
                try {
                  await requestProviderSync({
                    data: { projectId, providers: [provider.provider], window: "28d" },
                  });
                  toast.success(ui.queued);
                  await load();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Sync failed");
                } finally {
                  setBusy(null);
                }
              }}
            >
              <RefreshCw className={busy === provider.provider ? "size-4 animate-spin" : "size-4"} />
              {ui.test}
            </Button>
          </section>
        ))}
      </div>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg font-semibold">{ui.ledger}</h2>
        {!data.runs.length ? (
          <p className="mt-3 text-sm text-muted">{ui.empty}</p>
        ) : (
          <div className="mt-3 overflow-auto rounded-xl bg-paper text-ink">
            <table className="sheet-grid w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="text-ink-muted">
                  {[ui.provider, ui.runStatus, ui.window, ui.started, ui.rows].map((label) => (
                    <th key={label} className="px-3 py-2 text-start font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.runs.slice(0, 50).map((run) => (
                  <tr key={run.id} className="border-t border-rule">
                    <td className="px-3 py-2 font-medium">{PROVIDER_LABELS[run.provider]}</td>
                    <td className="px-3 py-2">{run.status}</td>
                    <td className="px-3 py-2">{run.window}</td>
                    <td className="px-3 py-2">{stamp(run.started_at, lang)}</td>
                    <td className="px-3 py-2 tabular-nums">{run.rows_written}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
