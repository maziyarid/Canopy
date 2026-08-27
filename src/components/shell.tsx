import { Mark } from "@/components/mark";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCanopy } from "@/lib/store";
import type { ViewId } from "@/lib/types";
import {
  BookOpen,
  ClipboardList,
  KeyRound,
  LayoutGrid,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV: { id: ViewId; label: string; icon: typeof LayoutGrid }[] = [
  { id: "workspace", label: "Sheet", icon: LayoutGrid },
  { id: "agents", label: "Agents", icon: Sparkles },
  { id: "script", label: "Apps Script", icon: ClipboardList },
  { id: "atlas", label: "API", icon: BookOpen },
  { id: "setup", label: "Setup", icon: KeyRound },
];

export function Shell({ children }: { children: ReactNode }) {
  const view = useCanopy((s) => s.view);
  const setView = useCanopy((s) => s.setView);
  const quota = useCanopy((s) => s.quota);
  const apiKey = useCanopy((s) => s.settings.apiKey);
  const connected = Boolean(apiKey);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            className="flex min-h-11 items-center gap-2.5"
            onClick={() => setView("workspace")}
          >
            <Mark className="size-8" />
            <span className="font-display text-xl font-medium tracking-tight">Canopy</span>
          </button>
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium",
                  view === item.id ? "bg-raised text-fg" : "text-muted hover:text-fg",
                )}
              >
                <item.icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-3 rounded-md bg-raised px-3 py-1.5 text-xs tabular-nums text-muted shadow-[var(--shadow-border)] sm:flex">
              <span>
                Lookups{" "}
                <b className="font-medium text-fg">
                  {quota.lookups.remaining}/{quota.lookups.limit}
                </b>
              </span>
              <span className="text-subtle">·</span>
              <span>
                SERP{" "}
                <b className="font-medium text-fg">
                  {quota.serps.remaining}/{quota.serps.limit}
                </b>
              </span>
            </div>
            <Button
              size="sm"
              variant={connected ? "ghost" : "primary"}
              onClick={() => setView("setup")}
            >
              {connected ? "Connected" : "Connect Mangools"}
            </Button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium",
                view === item.id ? "bg-raised text-fg" : "text-muted",
              )}
            >
              <item.icon className="size-4" strokeWidth={1.75} />
              {item.label}
            </button>
          ))}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6">
        {children}
      </main>
    </div>
  );
}
