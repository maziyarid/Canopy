import { Spark } from "@/components/spark";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { liveBulk, liveCompetitor, liveGap, liveRelated } from "@/lib/live";
import { formatCpc, formatVolume, kdTone, rankDelta } from "@/lib/score";
import { useCanopy } from "@/lib/store";
import type { KeywordRow, SheetTab } from "@/lib/types";
import { ArrowDownRight, ArrowUpRight, LoaderCircle, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const TABS: { id: SheetTab; label: string }[] = [
  { id: "keywords", label: "Keywords" },
  { id: "related", label: "Related" },
  { id: "tracking", label: "Tracking" },
  { id: "competitors", label: "Competitors" },
  { id: "gaps", label: "Gaps" },
  { id: "lists", label: "Lists" },
  { id: "log", label: "Log" },
];

export function Workspace() {
  const tab = useCanopy((s) => s.sheetTab);
  const setTab = useCanopy((s) => s.setSheetTab);
  const keywords = useCanopy((s) => s.keywords);
  const related = useCanopy((s) => s.related);
  const tracking = useCanopy((s) => s.tracking);
  const competitors = useCanopy((s) => s.competitors);
  const gaps = useCanopy((s) => s.gaps);
  const lists = useCanopy((s) => s.lists);
  const log = useCanopy((s) => s.log);
  const selected = useCanopy((s) => s.selected);
  const settings = useCanopy((s) => s.settings);
  const addSeeds = useCanopy((s) => s.addSeeds);
  const toggleSelected = useCanopy((s) => s.toggleSelected);
  const [seed, setSeed] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [rival, setRival] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({
    key: "opportunity",
    dir: "desc",
  });

  const ranked = useMemo(() => {
    const rows = [...keywords];
    rows.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sort.key];
      const bv = (b as unknown as Record<string, unknown>)[sort.key];
      const an = typeof av === "number" ? av : String(av ?? "");
      const bn = typeof bv === "number" ? bv : String(bv ?? "");
      if (an < bn) return sort.dir === "asc" ? -1 : 1;
      if (an > bn) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [keywords, sort]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try {
      await fn();
      toast.success(label + " complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  const picked = keywords.filter((k) => selected.includes(k.id));
  const pickKws = (picked.length ? picked : keywords).map((k) => k.keyword);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted">Workbook</p>
          <h1 className="font-display text-3xl font-medium tracking-tight text-fg sm:text-4xl">
            Keyword ledger
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Same tabs the Apps Script builds in Google Sheets. Demo data is loaded for
            northline.studio — connect Mangools to score live.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={Boolean(busy)}
            onClick={() =>
              run("Bulk score", () => liveBulk(pickKws))
            }
          >
            {busy === "Bulk score" ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Score list
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={Boolean(busy)}
            onClick={() => {
              const kw = picked[0]?.keyword ?? keywords[0]?.keyword;
              if (!kw) return toast.error("Add a keyword first");
              setTab("related");
              run("Related", () => liveRelated(kw));
            }}
          >
            Expand related
          </Button>
          <Button size="sm" variant="paper" onClick={() => useCanopy.getState().setView("script")}>
            Copy Apps Script
          </Button>
        </div>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const list = seed
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (!list.length) return;
          addSeeds(list);
          setSeed("");
          toast.success(`Added ${list.length} seed${list.length === 1 ? "" : "s"}`);
        }}
      >
        <Input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Add seeds — comma or newline separated"
          className="sm:flex-1"
        />
        <Button type="submit" variant="ghost">
          <Plus className="size-4" />
          Add to sheet
        </Button>
      </form>

      <div className="flex-1 overflow-hidden rounded-2xl bg-paper p-2 text-ink shadow-[var(--shadow-paper)]">
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-ink/5 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "h-9 shrink-0 rounded-lg px-3 text-sm font-medium",
                tab === t.id ? "bg-paper text-ink shadow-sm" : "text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
          <span className="ml-auto hidden px-2 text-xs text-ink-muted sm:inline">
            {settings.domain || "no domain"} · loc {settings.locationId}
          </span>
        </div>

        <div className="mt-2 max-h-[min(70vh,720px)] overflow-auto rounded-xl">
          {tab === "keywords" && (
            <KeywordTable
              rows={ranked}
              selected={selected}
              onToggle={toggleSelected}
              sort={sort}
              onSort={(key) =>
                setSort((s) => ({
                  key,
                  dir: s.key === key && s.dir === "desc" ? "asc" : "desc",
                }))
              }
            />
          )}
          {tab === "related" && <RelatedTable rows={related} />}
          {tab === "tracking" && <TrackingTable />}
          {tab === "competitors" && (
            <div className="p-3">
              <form
                className="mb-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!rival.trim()) return;
                  run("Competitor", () => liveCompetitor(rival.trim()));
                }}
              >
                <Input
                  value={rival}
                  onChange={(e) => setRival(e.target.value)}
                  placeholder="Competitor domain"
                  className="bg-paper text-ink shadow-none ring-1 ring-rule"
                />
                <Button type="submit" size="sm">
                  Pull keywords
                </Button>
              </form>
              <SimpleTable
                columns={["Domain", "Keyword", "Volume", "KD", "CPC", "Pos"]}
                rows={competitors.map((c) => [
                  c.domain,
                  c.keyword,
                  formatVolume(c.volume),
                  c.kd ?? "—",
                  formatCpc(c.cpc),
                  c.position ?? "—",
                ])}
              />
            </div>
          )}
          {tab === "gaps" && (
            <div className="p-3">
              <Button
                size="sm"
                className="mb-3"
                onClick={() => {
                  const raw = window.prompt("Competitors, comma-separated (max 5)") ?? "";
                  run("Gap analysis", () => liveGap(raw.split(",")));
                }}
              >
                Run gap analysis
              </Button>
              <SimpleTable
                columns={["Keyword", "Volume", "CPC", "You", "Competitor", "Their pos"]}
                rows={gaps.map((g) => [
                  g.keyword,
                  formatVolume(g.volume),
                  formatCpc(g.cpc),
                  g.yourPosition ?? "—",
                  g.competitor,
                  g.competitorPosition,
                ])}
              />
            </div>
          )}
          {tab === "lists" && (
            <SimpleTable
              columns={["List", "Keywords", "Updated"]}
              rows={lists.map((l) => [l.name, l.count, l.updated])}
            />
          )}
          {tab === "log" && (
            <SimpleTable
              columns={["When", "Level", "Action", "Detail", "Credits"]}
              rows={log.map((l) => [l.at, l.level, l.action, l.detail, l.credits])}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function KeywordTable({
  rows,
  selected,
  onToggle,
  sort,
  onSort,
}: {
  rows: KeywordRow[];
  selected: string[];
  onToggle: (id: string) => void;
  sort: { key: string; dir: "asc" | "desc" };
  onSort: (key: string) => void;
}) {
  const updateStatus = useCanopy((s) => s.updateStatus);
  const headers: { key: string; label: string }[] = [
    { key: "keyword", label: "Keyword" },
    { key: "volume", label: "Volume" },
    { key: "msv", label: "Trend" },
    { key: "kd", label: "KD" },
    { key: "cpc", label: "CPC" },
    { key: "opportunity", label: "Score" },
    { key: "status", label: "Status" },
    { key: "agent", label: "Agent" },
  ];
  return (
    <table className="sheet-grid w-full min-w-[760px] border-collapse text-left text-sm">
      <thead>
        <tr className="bg-paper text-ink-muted">
          <th className="w-10 px-3 py-2" />
          {headers.map((h) => (
            <th key={h.key} className="px-3 py-2 font-medium">
              <button type="button" onClick={() => onSort(h.key)} className="hover:text-ink">
                {h.label}
                {sort.key === h.key ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.id}
            className={cn(
              "border-t border-rule",
              i % 2 === 1 && "bg-ink/5",
              selected.includes(row.id) && "bg-accent/20",
            )}
          >
            <td className="px-3 py-2">
              <input
                type="checkbox"
                className="size-4 accent-ink"
                checked={selected.includes(row.id)}
                onChange={() => onToggle(row.id)}
                aria-label={`Select ${row.keyword}`}
              />
            </td>
            <td className="px-3 py-2">
              <div className="font-medium">{row.keyword}</div>
              <div className="text-xs text-ink-muted">{row.seed}</div>
            </td>
            <td className="px-3 py-2 tabular-nums">{formatVolume(row.volume)}</td>
            <td className="px-3 py-2">
              <Spark values={row.msv} />
            </td>
            <td className="px-3 py-2">
              <KdCell kd={row.kd} />
            </td>
            <td className="px-3 py-2 tabular-nums">{formatCpc(row.cpc)}</td>
            <td className="px-3 py-2 font-medium tabular-nums">{row.opportunity}</td>
            <td className="px-3 py-2">
              <select
                value={row.status}
                onChange={(e) => updateStatus(row.id, e.target.value as KeywordRow["status"])}
                className="h-8 rounded-sm bg-transparent text-xs"
              >
                <option value="new">new</option>
                <option value="tracked">tracked</option>
                <option value="briefed">briefed</option>
                <option value="ignored">ignored</option>
              </select>
            </td>
            <td className="px-3 py-2 text-ink-muted">{row.agent}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RelatedTable({ rows }: { rows: KeywordRow[] }) {
  if (!rows.length) {
    return <p className="p-6 text-sm text-ink-muted">Expand a seed to fill this tab.</p>;
  }
  return (
    <SimpleTable
      columns={["Seed", "Keyword", "Volume", "KD", "CPC", "Score"]}
      rows={rows.map((r) => [
        r.seed,
        r.keyword,
        formatVolume(r.volume),
        r.kd ?? "—",
        formatCpc(r.cpc),
        r.opportunity,
      ])}
    />
  );
}

function TrackingTable() {
  const rows = useCanopy((s) => s.tracking);
  return (
    <table className="sheet-grid w-full min-w-[720px] border-collapse text-left text-sm">
      <thead>
        <tr className="bg-paper text-ink-muted">
          {["Keyword", "Loc", "Device", "Rank", "Change", "Best", "Visits", "URL"].map((h) => (
            <th key={h} className="px-3 py-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const delta = rankDelta(r.rank, r.prev);
          return (
            <tr key={r.id} className={cn("border-t border-rule", i % 2 === 1 && "bg-ink/5")}>
              <td className="px-3 py-2 font-medium">{r.keyword}</td>
              <td className="px-3 py-2 text-ink-muted">{r.location}</td>
              <td className="px-3 py-2">{r.device}</td>
              <td className="px-3 py-2 tabular-nums">{r.rank ?? "—"}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 tabular-nums",
                    delta > 0 && "text-good",
                    delta < 0 && "text-bad",
                  )}
                >
                  {delta > 0 ? <ArrowUpRight className="size-3.5" /> : null}
                  {delta < 0 ? <ArrowDownRight className="size-3.5" /> : null}
                  {delta === 0 ? "—" : Math.abs(delta)}
                </span>
              </td>
              <td className="px-3 py-2 tabular-nums">{r.best ?? "—"}</td>
              <td className="px-3 py-2 tabular-nums">{r.visits}</td>
              <td className="max-w-[180px] truncate px-3 py-2 text-ink-muted">{r.url}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SimpleTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  if (!rows.length) {
    return <p className="p-6 text-sm text-ink-muted">Nothing on this tab yet.</p>;
  }
  return (
    <table className="sheet-grid w-full min-w-[640px] border-collapse text-left text-sm">
      <thead>
        <tr className="bg-paper text-ink-muted">
          {columns.map((c) => (
            <th key={c} className="px-3 py-2 font-medium">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={cn("border-t border-rule", i % 2 === 1 && "bg-ink/5")}>
            {r.map((cell, j) => (
              <td key={j} className={cn("px-3 py-2", j === 0 && "font-medium")}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KdCell({ kd }: { kd: number | null }) {
  const tone = kdTone(kd);
  const width = kd == null ? 0 : Math.min(100, kd);
  return (
    <div className="flex min-w-16 items-center gap-2">
      <span className="w-6 tabular-nums">{kd ?? "—"}</span>
      <span className="kd-bar w-12">
        <span
          style={{ width: `${width}%` }}
          className={cn(
            tone === "good" && "bg-good",
            tone === "warn" && "bg-warn",
            tone === "bad" && "bg-bad",
            tone === "muted" && "bg-rule",
          )}
        />
      </span>
    </div>
  );
}
