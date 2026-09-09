import { Mark } from "@/components/mark";
import { Button } from "@/components/ui";
import { useLocale, useT } from "@/lib/locale";
import {
  Bot,
  FolderKanban,
  LineChart,
  ShieldCheck,
  Table2,
  Webhook,
} from "lucide-react";

export function Landing() {
  const t = useT();
  const toggle = useLocale((s) => s.toggle);
  const features = [
    { icon: FolderKanban, title: t("fProjects"), body: t("fProjectsBody") },
    { icon: ShieldCheck, title: t("fAccess"), body: t("fAccessBody") },
    { icon: LineChart, title: t("fSerp"), body: t("fSerpBody") },
    { icon: Bot, title: t("fAgents"), body: t("fAgentsBody") },
    { icon: Webhook, title: t("fMonday"), body: t("fMondayBody") },
    { icon: Table2, title: t("fSheet"), body: t("fSheetBody") },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg text-fg">
      <div className="maz-grid pointer-events-none absolute inset-0" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 sm:px-6">
        <Mark />
        <span className="font-display text-xl font-semibold">{t("appName")}</span>
        <span className="hidden font-mono text-[10px] tracking-[0.2em] text-subtle sm:inline">MΛZ STUDIO</span>
        <div className="ms-auto flex items-center gap-2">
          <Button size="sm" variant="quiet" onClick={toggle}>
            {t("navLang")}
          </Button>
          <a href="/login">
            <Button size="sm" variant="ghost">
              {t("ctaLogin")}
            </Button>
          </a>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:py-16">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">{t("studio")}</p>
          <h1 className="mt-3 max-w-xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {t("tagline")}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">{t("heroLead")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="/login">
              <Button size="lg">{t("ctaStart")}</Button>
            </a>
            <a href="/login">
              <Button size="lg" variant="ghost">
                {t("ctaCreate")}
              </Button>
            </a>
            <a href="/canopy-sheets.zip" download="canopy-sheets.zip">
              <Button size="lg" variant="quiet">
                {t("downloadScript")}
              </Button>
            </a>
          </div>
          <p className="mt-6 font-mono text-xs text-subtle">MAZ//ID · KWFinder · SERPWatcher · Maz•Assist</p>
        </div>
        <aside className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border),var(--shadow-lift)]">
          <p className="text-xs uppercase tracking-widest text-muted">{t("tracker")}</p>
          <div className="mt-3 space-y-2">
            {[
              ["waterproof field notebook", "6", "+5"],
              ["جراحی بینی تهران", "7", "+12"],
              ["متخصص گوش حلق بینی", "5", "+6"],
              ["geology field notebook", "4", "+14"],
            ].map(([kw, rank, delta]) => (
              <div key={kw} className="flex items-center justify-between rounded-lg bg-raised px-3 py-2.5">
                <span className="truncate text-sm">{kw}</span>
                <span className="ms-3 flex items-center gap-3 font-mono text-sm tabular-nums">
                  <span className="text-fg">{rank}</span>
                  <span className="text-accent">{delta}</span>
                </span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        {features.map((f) => (
          <article key={f.title} className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <f.icon className="size-5 text-primary" strokeWidth={1.75} />
            <h2 className="mt-3 font-display text-lg font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{f.body}</p>
          </article>
        ))}
      </section>

      <footer className="relative z-10 border-t border-border px-4 py-6 text-center text-xs text-subtle">
        {t("madeBy")}
      </footer>
    </div>
  );
}
