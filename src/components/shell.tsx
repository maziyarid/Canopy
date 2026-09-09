import { Mark } from "@/components/mark";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui";
import { useLocale, useT } from "@/lib/locale";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function Shell({ children, dense = false }: { children: ReactNode; dense?: boolean }) {
  const t = useT();
  const lang = useLocale((s) => s.lang);
  const toggle = useLocale((s) => s.toggle);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-h-11 items-center gap-2.5">
            <Mark className="size-8" />
            <span className="font-display text-xl font-semibold tracking-tight">{t("appName")}</span>
            <span className="hidden font-mono text-[10px] tracking-widest text-subtle sm:inline">MΛZ</span>
          </Link>
          <div className="ms-auto flex items-center gap-2">
            <Button size="sm" variant="quiet" onClick={toggle} className="min-w-16">
              {t("navLang")}
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>
      <main
        className={
          dense
            ? "mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 py-5 sm:px-6"
            : "mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8"
        }
      >
        {children}
      </main>
      <footer className="border-t border-border px-4 py-4 text-center text-xs text-subtle">
        {t("madeBy")} · {t("signature")} · {lang === "fa" ? "مازیار" : "Maziyar"}
      </footer>
    </div>
  );
}
