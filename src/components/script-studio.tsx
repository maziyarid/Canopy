import { Badge, Button } from "@/components/ui";
import { APPSSCRIPT_JSON, CODE_GS } from "@/lib/script";
import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const FUNCTIONS = [
  { name: "canopySetup", does: "Create all sheets, headers, formatting, quota check" },
  { name: "canopyPromptApiKey", does: "Store X-Access-Token in Script Properties" },
  { name: "canopyBulkImport", does: "POST /kwfinder/keyword-imports up to 700 kws" },
  { name: "canopyRelated", does: "GET /kwfinder/related-keywords for the active cell" },
  { name: "canopySerp", does: "GET /serpchecker/serps and live KD" },
  { name: "canopyCompetitorKeywords", does: "GET /kwfinder/competitor-keywords" },
  { name: "canopyGapAnalysis", does: "POST /kwfinder/gap-analysis vs Settings competitors" },
  { name: "canopyRefreshTracking", does: "SERPWatcher detail + stats → Tracking tab" },
  { name: "canopyCreateTracking", does: "POST /serpwatcher/trackings from Keywords" },
  { name: "canopySyncLists", does: "GET /kwfinder/lists" },
  { name: "canopySearchLocations", does: "GET /mangools/locations" },
  { name: "canopyRunAgents", does: "Execute due rows on the Agents sheet" },
  { name: "canopyDailyJob", does: "Quota + ranks + auto agents (time trigger)" },
  { name: "doPost", does: "JSON webhook for Cursor / Claude / custom agents" },
];

const CUSTOM_FNS = [
  { sig: '=MANGOOLS_VOLUME("waterproof notebook")', out: "Average monthly search volume" },
  { sig: "=MANGOOLS_KD(A2)", out: "Cached keyword difficulty (empty until SERP/KD)" },
  { sig: "=MANGOOLS_CPC(A2, 2840, 1000)", out: "CPC for US English" },
  { sig: "=MANGOOLS_PPC(A2)", out: "Paid competition 0–100" },
  { sig: "=MANGOOLS_SCORE(A2)", out: "Volume / (KD+8) × (1 − 0.45·PPC)" },
];

export function ScriptStudio() {
  const [copied, setCopied] = useState<"gs" | "json" | "curl" | null>(null);

  function copy(label: "gs" | "json" | "curl", text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("Copied");
    setTimeout(() => setCopied(null), 1500);
  }

  function download(name: string, text: string, type: string) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const curl = `curl -sS -X POST "$WEBAPP_URL" \\
  -H "Content-Type: application/json" \\
  -d '{
    "secret": "YOUR_WEBHOOK_SECRET",
    "action": "related",
    "payload": { "keyword": "waterproof field notebook" }
  }'`;

  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section>
        <p className="text-xs font-medium uppercase tracking-widest text-muted">Install</p>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Apps Script
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          One file. Paste into Extensions → Apps Script, save, reload the spreadsheet,
          then Canopy → Setup workbook. The script talks to api.mangools.com/v3 with
          X-Access-Token, retries 429s, and chunks work under the 6-minute cap.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => copy("gs", CODE_GS)}>
            {copied === "gs" ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copy Code.gs
          </Button>
          <Button variant="ghost" onClick={() => copy("json", APPSSCRIPT_JSON)}>
            {copied === "json" ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copy appsscript.json
          </Button>
          <Button
            variant="quiet"
            onClick={() => download("Code.gs", CODE_GS, "text/plain")}
          >
            <Download className="size-4" />
            Download
          </Button>
        </div>
        <pre className="mt-4 max-h-[min(62vh,720px)] overflow-auto rounded-2xl bg-ink p-4 font-mono text-[12px] leading-relaxed text-paper shadow-[var(--shadow-border)]">
          {CODE_GS}
        </pre>
      </section>

      <aside className="grid h-fit gap-4">
        <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-lg font-medium">Menu map</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {FUNCTIONS.map((f) => (
              <li key={f.name}>
                <code className="font-mono text-xs text-accent">{f.name}</code>
                <p className="text-muted">{f.does}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-lg font-medium">Sheet formulas</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {CUSTOM_FNS.map((f) => (
              <li key={f.sig}>
                <code className="font-mono text-xs text-fg">{f.sig}</code>
                <p className="text-muted">{f.out}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium">Agent webhook</h2>
            <Badge tone="accent">doPost</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            Deploy → Web app → execute as you, anyone with the link. Actions:
            quota, read, write, related, bulk, competitor, gap, track, agent, setting.
          </p>
          <pre className="mt-3 overflow-auto rounded-lg bg-bg p-3 font-mono text-[11px] text-muted">
            {curl}
          </pre>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => copy("curl", curl)}>
            {copied === "curl" ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copy curl
          </Button>
        </div>
      </aside>
    </div>
  );
}
