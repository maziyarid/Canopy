import { Badge, Input } from "@/components/ui";
import { ENDPOINTS, FIELD_MAP, RATE_NOTES } from "@/lib/api-catalog";
import { cn } from "@/lib/cn";
import { useMemo, useState } from "react";

const GROUPS = ["All", "KWFinder", "SERPChecker", "SERPWatcher", "Locations", "Quota"] as const;

export function Atlas() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("All");
  const list = useMemo(() => {
    return ENDPOINTS.filter((e) => {
      if (group !== "All" && e.group !== group) return false;
      if (!q.trim()) return true;
      const hay = `${e.name} ${e.path} ${e.notes}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [q, group]);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted">Reference</p>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Mangools API
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Base URL <code className="font-mono text-accent">https://api.mangools.com/v3</code>.
          Header <code className="font-mono text-accent">X-Access-Token</code>. Every
          endpoint the workbook implements, plus the metric dictionary.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter endpoints"
          className="sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-1">
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={cn(
                "h-9 rounded-md px-3 text-sm",
                group === g ? "bg-accent text-accent-fg" : "bg-raised text-muted",
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((e) => (
          <article key={e.method + e.path} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={e.method === "GET" ? "accent" : "warn"}>{e.method}</Badge>
              <code className="font-mono text-xs text-muted">{e.path}</code>
              <Badge className="ml-auto" tone="muted">
                {e.sheet}
              </Badge>
            </div>
            <h2 className="mt-2 font-display text-xl font-medium">{e.name}</h2>
            <p className="mt-1 text-sm text-muted">{e.notes}</p>
            <p className="mt-2 text-xs text-subtle">Credits: {e.credits}</p>
            <ul className="mt-3 space-y-1 text-sm">
              {e.params.map((p) => (
                <li key={p.name} className="flex gap-2">
                  <code className="w-28 shrink-0 font-mono text-xs text-accent">
                    {p.name}
                    {p.required ? "" : "?"}
                  </code>
                  <span className="text-muted">{p.hint}</span>
                </li>
              ))}
            </ul>
            {e.body ? (
              <pre className="mt-3 overflow-auto rounded-lg bg-bg p-3 font-mono text-[11px] text-muted">
                {e.body}
              </pre>
            ) : null}
          </article>
        ))}
      </div>

      <section className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl font-medium">Response fields</h2>
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 font-medium">Key</th>
                <th className="py-2 font-medium">Sheet column</th>
                <th className="py-2 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {FIELD_MAP.map((f) => (
                <tr key={f.key} className="border-t border-border">
                  <td className="py-2 font-mono text-xs text-accent">{f.key}</td>
                  <td className="py-2">{f.label}</td>
                  <td className="py-2 text-muted">{f.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-raised p-5">
        <h2 className="font-display text-xl font-medium">Rate limits & credits</h2>
        <ul className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
          {RATE_NOTES.map((n) => (
            <li key={n} className="rounded-lg bg-bg/50 px-3 py-2">
              {n}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
