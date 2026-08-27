import { Badge, Button, Field, Input } from "@/components/ui";
import { LANGUAGES, LOCATIONS } from "@/lib/locations";
import { liveQuota } from "@/lib/live";
import { useCanopy } from "@/lib/store";
import { Check, ExternalLink, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STEPS = [
  {
    n: "01",
    title: "Get a Mangools token",
    body: "Create a free Mangools account and copy the key from mangools.com/api-token. Every request uses the X-Access-Token header — never put it in a URL.",
    href: "https://mangools.com/api-token",
    hrefLabel: "Open API token page",
  },
  {
    n: "02",
    title: "Paste it here to trial live calls",
    body: "Stored only in this browser. Canopy proxies lookups from the Sheet tab so you can verify credits before wiring Google.",
  },
  {
    n: "03",
    title: "New Google Sheet → Apps Script",
    body: "Extensions → Apps Script. Delete the stub. Paste Code.gs. Add appsscript.json via Project settings → Show appsscript.json, then paste the manifest. Save.",
  },
  {
    n: "04",
    title: "Reload and run Setup workbook",
    body: "Back in Sheets, Canopy appears in the menu. Run Setup workbook, then Save API key. Authorize UrlFetch and Spreadsheets when asked.",
  },
  {
    n: "05",
    title: "Install the daily trigger",
    body: "Canopy → Install daily trigger. Watch refreshes ranks; Assessor/Expander rows with Auto=TRUE run inside the 6-minute budget.",
  },
  {
    n: "06",
    title: "Point your other agents at doPost",
    body: "Deploy → New deployment → Web app. Anyone with the link + WEBHOOK_SECRET can read the sheet, expand keywords, or run a named agent. Pair with Mangools MCP in Cursor if you want the same data in chat.",
    href: "https://mangools.com/mcp",
    hrefLabel: "Mangools MCP",
  },
];

export function Setup() {
  const settings = useCanopy((s) => s.settings);
  const patch = useCanopy((s) => s.patchSettings);
  const quota = useCanopy((s) => s.quota);
  const resetDemo = useCanopy((s) => s.resetDemo);
  const [busy, setBusy] = useState(false);
  const [keyDraft, setKeyDraft] = useState(settings.apiKey);
  const [done, setDone] = useState<Record<string, boolean>>({});

  async function testKey() {
    patch({ apiKey: keyDraft.trim() });
    setBusy(true);
    try {
      const q = await liveQuota();
      toast.success(`Connected · ${q.lookups.remaining} lookups left`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reach Mangools");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section>
        <p className="text-xs font-medium uppercase tracking-widest text-muted">Connect</p>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Wire the workbook
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Six steps from a blank spreadsheet to a daily Mangools pipeline your AI agents
          can drive.
        </p>
        <ol className="mt-6 space-y-4">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <span className="font-display text-2xl text-subtle">{s.n}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-medium">{s.title}</h2>
                  <button
                    type="button"
                    className="size-10 shrink-0 rounded-md text-muted hover:bg-raised hover:text-accent"
                    onClick={() => setDone((d) => ({ ...d, [s.n]: !d[s.n] }))}
                    aria-label={done[s.n] ? "Mark incomplete" : "Mark complete"}
                  >
                    <Check className={done[s.n] ? "mx-auto size-5 text-good" : "mx-auto size-5"} />
                  </button>
                </div>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
                {s.href ? (
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex h-10 items-center gap-1 text-sm text-accent"
                  >
                    {s.hrefLabel}
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <aside className="grid h-fit gap-4">
        <form
          className="grid gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
          onSubmit={(e) => {
            e.preventDefault();
            testKey();
          }}
        >
          <h2 className="font-display text-lg font-medium">Mangools key</h2>
          <Field label="API token" hint="Browser only. The Apps Script stores its own copy in Script Properties.">
            <Input
              type="password"
              autoComplete="off"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="Paste X-Access-Token"
            />
          </Field>
          <Field label="Home domain">
            <Input
              value={settings.domain}
              onChange={(e) => patch({ domain: e.target.value })}
              placeholder="yoursite.com"
            />
          </Field>
          <Field label="Location">
            <select
              className="h-10 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]"
              value={settings.locationId}
              onChange={(e) => patch({ locationId: Number(e.target.value) })}
            >
              {LOCATIONS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label} ({l.id})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Language">
            <select
              className="h-10 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]"
              value={settings.languageId}
              onChange={(e) => patch({ languageId: Number(e.target.value) })}
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" disabled={busy || keyDraft.trim().length < 8}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Test quota
          </Button>
          {quota.live ? (
            <p className="text-xs text-good">
              Live · {quota.lookups.remaining} lookups · {quota.serps.remaining} SERPs · reset ~
              {quota.resetHours}h
            </p>
          ) : (
            <p className="text-xs text-muted">Demo quota until you test a key.</p>
          )}
        </form>

        <div className="rounded-2xl bg-raised p-4">
          <h2 className="font-display text-lg font-medium">What the sheet stores</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            <li>
              <Badge className="mr-1">Settings</Badge> location, domain, secrets, model
            </li>
            <li>
              <Badge className="mr-1">Keywords</Badge> seeds, metrics, opportunity, status
            </li>
            <li>
              <Badge className="mr-1">Tracking</Badge> SERPWatcher ranks and deltas
            </li>
            <li>
              <Badge className="mr-1">Agents</Badge> Scout → Brief playbook rows
            </li>
            <li>
              <Badge className="mr-1">Log</Badge> HTTP, credits, 429 backoffs
            </li>
          </ul>
          <Button variant="quiet" size="sm" className="mt-3" onClick={() => resetDemo()}>
            Reset demo ledger
          </Button>
        </div>
      </aside>
    </div>
  );
}
