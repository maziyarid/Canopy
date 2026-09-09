import { Badge, Button, Field, Input, Textarea } from "@/components/ui";
import { Spark } from "@/components/spark";
import { cn } from "@/lib/cn";
import { AGENT_ROSTER, type CopyKey } from "@/lib/i18n";
import { LANGUAGES, LOCATIONS, locationLabel } from "@/lib/locations";
import { useLocale, useT } from "@/lib/locale";
import { runResearchAgent, writeBrief } from "@/lib/server/agent";
import { inviteMember, revokeMember } from "@/lib/server/invites";
import { pushMonday, testMonday } from "@/lib/server/monday";
import { deleteProject, getProjectBundle, updateProject } from "@/lib/server/projects";
import {
  addSeeds,
  expandRelated,
  pullCompetitor,
  runGap,
  scoreKeywords,
  updateKeywordStatus,
} from "@/lib/server/research";
import { refreshRanks, trackSelected, fetchSerp } from "@/lib/server/serp";
import { ENDPOINTS } from "@/lib/api-catalog";
import { getSettings, saveSettings, testQuota } from "@/lib/server/settings";
import { downloadScriptZip } from "@/lib/zip";
import { formatCpc, formatVolume, kdTone, rankDelta, visibilityScore } from "@/lib/score";
import type {
  AgentPlaybook,
  KeywordStatus,
  ProjectBundle,
  ProjectTab,
  QuotaState,
  Role,
  StudioSettings,
} from "@/lib/types";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  LoaderCircle,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

const TAB_IDS: { id: ProjectTab; owner?: boolean; hideClient?: boolean }[] = [
  { id: "overview" },
  { id: "keywords" },
  { id: "tracker" },
  { id: "research", hideClient: true },
  { id: "agents", hideClient: true },
  { id: "progress" },
  { id: "access", owner: true },
  { id: "connect", hideClient: true },
];

export function Workspace({ id }: { id: string }) {
  const t = useT();
  const lang = useLocale((s) => s.lang);
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [tab, setTab] = useState<ProjectTab>("overview");
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const data = await getProjectBundle({ data: { id } });
    setBundle(data);
  }

  useEffect(() => {
    setBundle(null);
    setErr(null);
    reload().catch((e) => setErr(e instanceof Error ? e.message : "Error"));
  }, [id]);

  if (err) {
    return (
      <div className="grid flex-1 place-items-center gap-3 text-center">
        <p className="text-sm text-muted">{t("forbidden")}</p>
        <Link to="/" className="text-sm text-primary">
          {t("back")}
        </Link>
      </div>
    );
  }
  if (!bundle) {
    return (
      <div className="grid flex-1 place-items-center text-muted">
        <LoaderCircle className="size-6 animate-spin" />
      </div>
    );
  }

  const role = bundle.project.role;
  const tabs = TAB_IDS.filter((x) => {
    if (x.owner && role !== "owner") return false;
    if (x.hideClient && role === "client") return false;
    return true;
  });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/" className="text-xs text-muted hover:text-fg">
            {t("back")}
          </Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{bundle.project.name}</h1>
          <p className="mt-1 font-mono text-xs text-muted">
            {bundle.project.domain || "—"} · {locationLabel(bundle.project.locationId, lang === "fa")}
          </p>
        </div>
        <Badge tone={role === "client" ? "paper" : "primary"}>{t(role)}</Badge>
      </div>
      {role === "client" ? (
        <p className="rounded-lg bg-raised px-3 py-2 text-sm text-muted">{t("clientBanner")}</p>
      ) : null}
      {bundle.project.keywordFilter ? (
        <p className="text-sm text-accent">
          {t("scopedTo")}: {bundle.project.keywordFilter}
        </p>
      ) : null}

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "h-10 shrink-0 rounded-lg px-3 text-sm font-medium",
              tab === item.id ? "bg-raised text-fg shadow-[var(--shadow-border)]" : "text-muted hover:text-fg",
            )}
          >
            {t(item.id as CopyKey)}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview bundle={bundle} />}
      {tab === "keywords" && <KeywordsPanel bundle={bundle} reload={reload} />}
      {tab === "tracker" && <TrackerPanel bundle={bundle} reload={reload} />}
      {tab === "research" && <ResearchPanel bundle={bundle} reload={reload} />}
      {tab === "agents" && <AgentsPanel bundle={bundle} reload={reload} />}
      {tab === "progress" && <ProgressPanel bundle={bundle} />}
      {tab === "access" && <AccessPanel bundle={bundle} reload={reload} />}
      {tab === "connect" && <ConnectPanel bundle={bundle} reload={reload} />}
    </div>
  );
}

function Overview({ bundle }: { bundle: ProjectBundle }) {
  const t = useT();
  const vis = visibilityScore(bundle.ranks.map((r) => ({ rank: r.rank, volume: r.volume })));
  const up = bundle.ranks.filter((r) => rankDelta(r.rank, r.prev) > 0).length;
  const down = bundle.ranks.filter((r) => rankDelta(r.rank, r.prev) < 0).length;
  const chart = useMemo(() => {
    const map = new Map<string, { date: string; sum: number; n: number }>();
    for (const r of bundle.history) {
      const date = r.checkedAt.slice(0, 10);
      const cur = map.get(date) ?? { date, sum: 0, n: 0 };
      if (r.rank != null) {
        cur.sum += r.rank;
        cur.n += 1;
      }
      map.set(date, cur);
    }
    return [...map.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((x) => ({ date: x.date.slice(5), rank: x.n ? Math.round((x.sum / x.n) * 10) / 10 : null }));
  }, [bundle.history]);

  const kpis = [
    { label: t("keywords"), value: String(bundle.keywords.length) },
    { label: t("avgRank"), value: bundle.project.avgRank == null ? "—" : String(bundle.project.avgRank) },
    { label: t("top10"), value: String(bundle.project.top10) },
    { label: t("visibility"), value: `${vis}` },
    { label: t("movingUp"), value: String(up) },
    { label: t("movingDown"), value: String(down) },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs text-muted">{k.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-paper p-4 text-ink shadow-[var(--shadow-border)]">
        <p className="text-sm font-medium">{t("history")}</p>
        <div className="mt-2 h-56">
          {chart.length < 2 ? (
            <p className="p-6 text-sm text-ink-muted">{t("nothingYet")}</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid stroke="#d7e3ee" />
                <XAxis dataKey="date" stroke="#475569" fontSize={12} />
                <YAxis reversed domain={[1, "auto"]} stroke="#475569" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="rank" stroke="#0B6FAF" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      {bundle.log.length ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-lg font-semibold">{t("log")}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {bundle.log.slice(0, 8).map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span className="truncate text-muted">
                  {row.action}
                  {row.detail ? ` · ${row.detail}` : ""}
                </span>
                <span className="shrink-0 font-mono text-xs text-subtle">{row.createdAt.slice(0, 16)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function KeywordsPanel({ bundle, reload }: { bundle: ProjectBundle; reload: () => Promise<void> }) {
  const t = useT();
  const writable = canEdit(bundle.project.role);
  const [seed, setSeed] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const rows = bundle.keywords.filter((k) => k.keyword.toLowerCase().includes(q.toLowerCase()));

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try {
      await fn();
      await reload();
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  const picked = rows.filter((r) => selected.includes(r.id)).map((r) => r.keyword);

  return (
    <div className="grid gap-3">
      {writable ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            const list = seed.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
            if (!list.length) return;
            run(t("addSeeds"), () => addSeeds({ data: { projectId: bundle.project.id, seeds: list } }));
            setSeed("");
          }}
        >
          <Input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder={t("addSeeds")} className="sm:flex-1" />
          <Button type="submit" variant="ghost">
            <Plus className="size-4" />
            {t("addSeeds")}
          </Button>
        </form>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchKw")} className="max-w-xs" />
        {writable ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={Boolean(busy)}
              onClick={() => run(t("scoreList"), () => scoreKeywords({ data: { projectId: bundle.project.id, keywords: picked.length ? picked : rows.map((r) => r.keyword) } }))}
            >
              {busy === t("scoreList") ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {t("scoreList")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={Boolean(busy)}
              onClick={() => {
                const kw = picked[0] ?? rows[0]?.keyword;
                if (!kw) return toast.error(t("nothingYet"));
                run(t("expandRelated"), () => expandRelated({ data: { projectId: bundle.project.id, seed: kw } }));
              }}
            >
              {t("expandRelated")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={Boolean(busy) || !picked.length}
              onClick={() => run(t("addToTrack"), () => trackSelected({ data: { projectId: bundle.project.id, keywords: picked } }))}
            >
              {t("addToTrack")}
            </Button>
          </>
        ) : null}
      </div>
      <div className="overflow-auto rounded-2xl bg-paper text-ink">
        <table className="sheet-grid w-full min-w-[760px] border-collapse text-start text-sm">
          <thead>
            <tr className="text-ink-muted">
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2 font-medium">{t("keywords")}</th>
              <th className="px-3 py-2 font-medium">{t("volume")}</th>
              <th className="px-3 py-2 font-medium">{t("trend")}</th>
              <th className="px-3 py-2 font-medium">{t("kd")}</th>
              <th className="px-3 py-2 font-medium">{t("cpc")}</th>
              <th className="px-3 py-2 font-medium">{t("score")}</th>
              <th className="px-3 py-2 font-medium">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className={cn("border-t border-rule", i % 2 === 1 && "bg-ink/5")}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary-dark"
                    checked={selected.includes(row.id)}
                    onChange={() =>
                      setSelected((s) => (s.includes(row.id) ? s.filter((x) => x !== row.id) : [...s, row.id]))
                    }
                    aria-label={row.keyword}
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
                  {writable ? (
                    <select
                      value={row.status}
                      onChange={(e) =>
                        updateKeywordStatus({
                          data: { projectId: bundle.project.id, id: row.id, status: e.target.value as KeywordStatus },
                        }).then(reload)
                      }
                      className="h-8 rounded-sm bg-transparent text-xs"
                    >
                      <option value="new">{t("stNew")}</option>
                      <option value="tracked">{t("stTracked")}</option>
                      <option value="briefed">{t("stBriefed")}</option>
                      <option value="ignored">{t("stIgnored")}</option>
                    </select>
                  ) : (
                    t(statusKey(row.status))
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="p-6 text-sm text-ink-muted">{t("nothingYet")}</p> : null}
      </div>
    </div>
  );
}

function TrackerPanel({ bundle, reload }: { bundle: ProjectBundle; reload: () => Promise<void> }) {
  const t = useT();
  const writable = canEdit(bundle.project.role);
  const [busy, setBusy] = useState(false);
  const [serpKw, setSerpKw] = useState<string | null>(null);
  const [serpBusy, setSerpBusy] = useState(false);
  const serpRows = serpKw ? bundle.serp.filter((r) => r.keyword === serpKw) : [];
  const historyFor = (kw: string) =>
    bundle.history
      .filter((h) => h.keyword === kw && h.rank != null)
      .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt))
      .map((h) => h.rank as number);

  return (
    <div className="grid gap-3">
      {writable ? (
        <Button
          size="sm"
          className="w-fit"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await refreshRanks({ data: { projectId: bundle.project.id } });
              await reload();
              toast.success(t("refreshRanks"));
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {t("refreshRanks")}
        </Button>
      ) : null}
      <div className="overflow-auto rounded-2xl bg-paper text-ink">
        <table className="sheet-grid w-full min-w-[720px] border-collapse text-start text-sm">
          <thead>
            <tr className="text-ink-muted">
              {[t("keywords"), t("device"), t("rank"), t("change"), t("best"), t("visits"), t("trend"), t("url")].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bundle.ranks.map((r, i) => {
              const delta = rankDelta(r.rank, r.prev);
              return (
                <tr
                  key={r.id}
                  className={cn(
                    "cursor-pointer border-t border-rule",
                    i % 2 === 1 && "bg-ink/5",
                    serpKw === r.keyword && "bg-primary/10",
                  )}
                  onClick={() => setSerpKw(r.keyword)}
                >
                  <td className="px-3 py-2 font-medium">{r.keyword}</td>
                  <td className="px-3 py-2">{r.device === "mobile" ? t("mobile") : t("desktop")}</td>
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
                  <td className="px-3 py-2">
                    <Spark values={historyFor(r.keyword)} />
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-ink-muted">{r.url}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!bundle.ranks.length ? <p className="p-6 text-sm text-ink-muted">{t("nothingYet")}</p> : null}
      </div>
      {serpKw ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">
              SERP · {serpKw}
            </h2>
            {writable ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={serpBusy}
                onClick={async () => {
                  setSerpBusy(true);
                  try {
                    await fetchSerp({ data: { projectId: bundle.project.id, keyword: serpKw } });
                    await reload();
                    toast.success(t("features"));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : t("noKey"));
                  } finally {
                    setSerpBusy(false);
                  }
                }}
              >
                {serpBusy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {t("features")}
              </Button>
            ) : null}
          </div>
          <SimpleTable
            columns={[t("position"), t("url"), t("kd"), t("features")]}
            rows={serpRows.map((s) => [s.position, s.title || s.url, s.kd ?? "—", s.features || s.domain])}
          />
        </section>
      ) : null}
    </div>
  );
}

function ResearchPanel({ bundle, reload }: { bundle: ProjectBundle; reload: () => Promise<void> }) {
  const t = useT();
  const [rival, setRival] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try {
      await fn();
      await reload();
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="grid gap-6">
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg font-semibold">{t("competitors")}</h2>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rival.trim()) return;
            run(t("pullCompetitor"), () => pullCompetitor({ data: { projectId: bundle.project.id, url: rival.trim() } }));
          }}
        >
          <Input value={rival} onChange={(e) => setRival(e.target.value)} placeholder={t("competitorDomain")} />
          <Button type="submit" size="sm" disabled={Boolean(busy)}>
            {t("pullCompetitor")}
          </Button>
        </form>
        <SimpleTable
          columns={[t("domain"), t("keywords"), t("volume"), t("kd"), t("cpc"), t("position")]}
          rows={bundle.competitors.map((c) => [c.domain, c.keyword, formatVolume(c.volume), c.kd ?? "—", formatCpc(c.cpc), c.position ?? "—"])}
        />
      </section>
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t("gaps")}</h2>
          <Button
            size="sm"
            variant="ghost"
            disabled={Boolean(busy)}
            onClick={() => run(t("runGap"), () => runGap({ data: { projectId: bundle.project.id } }))}
          >
            {t("runGap")}
          </Button>
        </div>
        <SimpleTable
          columns={[t("keywords"), t("volume"), t("cpc"), t("you"), t("competitors"), t("theirPos")]}
          rows={bundle.gaps.map((g) => [g.keyword, formatVolume(g.volume), formatCpc(g.cpc), g.yourPosition ?? "—", g.competitor, g.competitorPosition])}
        />
      </section>
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg font-semibold">{t("related")}</h2>
        <SimpleTable
          columns={[t("seed"), t("keywords"), t("volume"), t("kd"), t("score")]}
          rows={bundle.related.map((r) => [r.seed, r.keyword, formatVolume(r.volume), r.kd ?? "—", r.opportunity])}
        />
      </section>
    </div>
  );
}

function AgentsPanel({ bundle, reload }: { bundle: ProjectBundle; reload: () => Promise<void> }) {
  const t = useT();
  const lang = useLocale((s) => s.lang);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; playbook?: AgentPlaybook | null }[]>([
    { role: "assistant", content: t("deskBody") },
  ]);

  async function send() {
    const message = text.trim();
    if (!message || busy) return;
    setMessages((m) => [...m, { role: "user", content: message }]);
    setText("");
    setBusy(true);
    try {
      const preview = bundle.keywords
        .slice(0, 12)
        .map((k) => `${k.keyword} (vol ${k.volume}, kd ${k.kd ?? "—"})`)
        .join("\n");
      const res = await runResearchAgent({
        data: {
          projectId: bundle.project.id,
          message,
          domain: bundle.project.domain,
          location: locationLabel(bundle.project.locationId, lang === "fa"),
          keywordsPreview: preview,
        },
      });
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: res.error }]);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: res.reply, playbook: res.playbook }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: err instanceof Error ? err.message : "Error" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="flex min-h-0 flex-col rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
        <h2 className="px-2 font-display text-lg font-semibold">{t("desk")}</h2>
        <div className="mt-2 flex-1 space-y-3 overflow-auto px-1 py-2">
          {messages.map((m, i) => (
            <article
              key={i}
              className={m.role === "user" ? "ms-8 rounded-xl bg-raised px-4 py-3 text-sm" : "me-4 rounded-xl bg-bg px-4 py-3 text-sm shadow-[var(--shadow-border)]"}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.playbook ? (
                <div className="mt-3 rounded-lg bg-raised p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-base font-medium">{m.playbook.title}</h3>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await addSeeds({ data: { projectId: bundle.project.id, seeds: m.playbook!.seeds } });
                        await reload();
                        toast.success(t("writeSeeds"));
                      }}
                    >
                      {t("writeSeeds")}
                    </Button>
                  </div>
                  <p className="mt-1 text-sm text-muted">{m.playbook.summary}</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {m.playbook.seeds.map((s) => (
                      <li key={s}>
                        <Badge tone="primary">{s}</Badge>
                      </li>
                    ))}
                  </ul>
                  <ol className="mt-3 space-y-1.5 text-sm">
                    {m.playbook.tasks.map((task, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="w-20 shrink-0 font-medium text-primary">{task.agent}</span>
                        <span className="text-muted">
                          {task.action} — {task.input}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </article>
          ))}
          {busy ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <LoaderCircle className="size-4 animate-spin" />
              Maz•Assist
            </p>
          ) : null}
        </div>
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("agentPlaceholder")}
            className="min-h-20 flex-1"
          />
          <Button type="submit" disabled={busy || !text.trim()} className="h-11 shrink-0">
            <Send className="size-4" />
            {t("run")}
          </Button>
        </form>
      </section>
      <aside className="grid h-fit gap-3">
        {AGENT_ROSTER.map((a) => (
          <div key={a.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-medium">{lang === "fa" ? a.nameFa : a.name}</h3>
              <Badge>{a.id}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{a.job[lang]}</p>
            <p className="mt-2 font-mono text-xs text-subtle">{a.uses}</p>
            {a.id === "brief" ? (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={async () => {
                  const kw = bundle.keywords[0]?.keyword;
                  if (!kw) return;
                  try {
                    await writeBrief({ data: { projectId: bundle.project.id, keyword: kw } });
                    await reload();
                    toast.success(t("briefs"));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Error");
                  }
                }}
              >
                {t("briefs")}
              </Button>
            ) : null}
          </div>
        ))}
      </aside>
    </div>
  );
}

function ProgressPanel({ bundle }: { bundle: ProjectBundle }) {
  const t = useT();
  const wins = bundle.ranks.filter((r) => rankDelta(r.rank, r.prev) > 0);
  const losses = bundle.ranks.filter((r) => rankDelta(r.rank, r.prev) < 0);

  function csv() {
    const header = "keyword,volume,kd,opportunity,status,rank,prev,url\n";
    const body = bundle.keywords
      .map((k) => {
        const r = bundle.ranks.find((x) => x.keyword === k.keyword);
        return [k.keyword, k.volume, k.kd ?? "", k.opportunity, k.status, r?.rank ?? "", r?.prev ?? "", r?.url ?? ""].join(",");
      })
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bundle.project.domain || "canopy"}-progress.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={csv}>
          {t("exportCsv")}
        </Button>
        {canEdit(bundle.project.role) ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                await pushMonday({
                  data: {
                    projectId: bundle.project.id,
                    items: bundle.keywords.slice(0, 40).map((k) => ({
                      keyword: k.keyword,
                      volume: k.volume,
                      status: k.status,
                      opportunity: k.opportunity,
                      rank: bundle.ranks.find((r) => r.keyword === k.keyword)?.rank ?? null,
                    })),
                  },
                });
                toast.success(t("pushMonday"));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Error");
              }
            }}
          >
            {t("pushMonday")}
          </Button>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-lg font-semibold">{t("wins")}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {wins.map((r) => (
              <li key={r.id} className="flex justify-between">
                <span>{r.keyword}</span>
                <span className="text-accent tabular-nums">+{rankDelta(r.rank, r.prev)}</span>
              </li>
            ))}
            {!wins.length ? <li className="text-muted">{t("nothingYet")}</li> : null}
          </ul>
        </section>
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-lg font-semibold">{t("losses")}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {losses.map((r) => (
              <li key={r.id} className="flex justify-between">
                <span>{r.keyword}</span>
                <span className="text-bad tabular-nums">{rankDelta(r.rank, r.prev)}</span>
              </li>
            ))}
            {!losses.length ? <li className="text-muted">{t("nothingYet")}</li> : null}
          </ul>
        </section>
      </div>
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg font-semibold">{t("briefs")}</h2>
        {!bundle.briefs.length ? <p className="mt-2 text-sm text-muted">{t("noBriefs")}</p> : null}
        <ul className="mt-3 space-y-3">
          {bundle.briefs.map((b) => (
            <li key={b.id} className="rounded-lg bg-raised p-3">
              <p className="font-medium">{b.keyword}</p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-muted">{b.content}</pre>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AccessPanel({ bundle, reload }: { bundle: ProjectBundle; reload: () => Promise<void> }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"client" | "editor">("client");
  const [filter, setFilter] = useState("");
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg font-semibold">{t("members")}</h2>
        <ul className="mt-3 space-y-2">
          {bundle.access.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-raised px-3 py-2">
              <div>
                <p className="text-sm font-medium">{a.email}</p>
                <p className="text-xs text-muted">
                  {t(a.role)} {a.keywordFilter ? `· ${a.keywordFilter}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  await revokeMember({ data: { projectId: bundle.project.id, id: a.id } });
                  await reload();
                }}
              >
                {t("revoke")}
              </Button>
            </li>
          ))}
          {!bundle.access.length ? <p className="text-sm text-muted">{t("noAccessYet")}</p> : null}
        </ul>
      </div>
      <form
        className="grid h-fit gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await inviteMember({
              data: { projectId: bundle.project.id, email, role, keywordFilter: filter },
            });
            setEmail("");
            setFilter("");
            await reload();
            toast.success(t("invited"));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error");
          }
        }}
      >
        <h2 className="font-display text-lg font-semibold">{t("invite")}</h2>
        <p className="text-sm text-muted">{t("inviteHint")}</p>
        <Field label={t("email")}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label={t("role")}>
          <select
            className="h-10 w-full rounded-md bg-raised px-3 text-sm shadow-[var(--shadow-border)]"
            value={role}
            onChange={(e) => setRole(e.target.value as "client" | "editor")}
          >
            <option value="client">{t("client")}</option>
            <option value="editor">{t("editor")}</option>
          </select>
        </Field>
        <Field label={t("keywordScope")} hint={t("allKeywords")}>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="keyword, keyword" />
        </Field>
        <Button type="submit">{t("invite")}</Button>
      </form>
    </div>
  );
}

function ConnectPanel({ bundle, reload }: { bundle: ProjectBundle; reload: () => Promise<void> }) {
  const t = useT();
  const lang = useLocale((s) => s.lang);
  const nav = useNavigate();
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [key, setKey] = useState("");
  const [hook, setHook] = useState("");
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [domain, setDomain] = useState(bundle.project.domain);
  const [competitors, setCompetitors] = useState(bundle.project.competitors);
  const [loc, setLoc] = useState(bundle.project.locationId);
  const [langId, setLangId] = useState(bundle.project.languageId);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s);
        setHook(s.mondayWebhook);
      })
      .catch(() => setSettings({ hasKey: false, mondayWebhook: "", defaultLocationId: 2840, defaultLanguageId: 1000 }));
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="grid gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
        onSubmit={async (e) => {
          e.preventDefault();
          await updateProject({
            data: { id: bundle.project.id, domain, competitors, locationId: loc, languageId: langId },
          });
          await reload();
          toast.success(t("saved"));
        }}
      >
        <h2 className="font-display text-lg font-semibold">{bundle.project.name}</h2>
        <Field label={t("homeDomain")}>
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
        </Field>
        <Field label={t("competitors")}>
          <Input value={competitors} onChange={(e) => setCompetitors(e.target.value)} />
        </Field>
        <Field label={t("location")}>
          <select
            className="h-10 w-full rounded-md bg-raised px-3 text-sm shadow-[var(--shadow-border)]"
            value={loc}
            onChange={(e) => setLoc(Number(e.target.value))}
          >
            {LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {lang === "fa" ? l.labelFa : l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("language")}>
          <select
            className="h-10 w-full rounded-md bg-raised px-3 text-sm shadow-[var(--shadow-border)]"
            value={langId}
            onChange={(e) => setLangId(Number(e.target.value))}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {lang === "fa" ? l.labelFa : l.label}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit">{t("save")}</Button>
        {bundle.project.role === "owner" ? (
          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              if (!window.confirm(t("delete"))) return;
              await deleteProject({ data: { id: bundle.project.id } });
              await nav({ to: "/" });
            }}
          >
            <Trash2 className="size-4" />
            {t("delete")}
          </Button>
        ) : null}
      </form>

      <div className="grid gap-4">
        {bundle.project.role === "owner" ? (
          <form
            className="grid gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
            onSubmit={async (e) => {
              e.preventDefault();
              await saveSettings({ data: { mangoolsKey: key || undefined, mondayWebhook: hook } });
              const s = await getSettings();
              setSettings(s);
              toast.success(t("saved"));
            }}
          >
            <h2 className="font-display text-lg font-semibold">{t("setupTitle")}</h2>
            <Field label={t("mangoolsKey")} hint={t("keyHint")}>
              <Input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={settings?.hasKey ? "••••••••" : "X-Access-Token"}
              />
            </Field>
            <Field label={t("mondayWebhook")} hint={t("mondayHint")}>
              <Input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://..." />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">{t("save")}</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  try {
                    const q = await testQuota();
                    setQuota(q);
                    toast.success(t("connected"));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : t("noKey"));
                  }
                }}
              >
                {t("testQuota")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  try {
                    await testMonday({ data: { projectId: bundle.project.id } });
                    toast.success(t("testWebhook"));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Error");
                  }
                }}
              >
                {t("testWebhook")}
              </Button>
            </div>
            {quota ? (
              <p className="text-xs text-good">
                {t("quotaLookups")} {quota.lookups.remaining}/{quota.lookups.limit} · {t("quotaSerp")}{" "}
                {quota.serps.remaining}/{quota.serps.limit}
              </p>
            ) : (
              <p className="text-xs text-muted">{settings?.hasKey ? t("connected") : t("demoMode")}</p>
            )}
          </form>
        ) : null}

        <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-lg font-semibold">{t("scriptTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("scriptBody")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                void downloadScriptZip();
              }}
            >
              {t("downloadScript")}
            </Button>
            <a href="/canopy/Code.gs" download="Code.gs">
              <Button variant="quiet">{t("copyGs")}</Button>
            </a>
          </div>
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-lg font-semibold">{t("atlas")}</h2>
          <ul className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">
            {ENDPOINTS.map((e) => (
              <li key={`${e.method}-${e.path}`} className="rounded-lg bg-raised px-3 py-2">
                <p className="font-mono text-xs text-primary">
                  {e.method} {e.path}
                </p>
                <p className="mt-0.5 font-medium">{e.name}</p>
                <p className="text-xs text-muted">{e.credits}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SimpleTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  const t = useT();
  if (!rows.length) return <p className="mt-3 text-sm text-muted">{t("nothingYet")}</p>;
  return (
    <div className="mt-3 overflow-auto rounded-xl bg-paper text-ink">
      <table className="sheet-grid w-full min-w-[560px] border-collapse text-start text-sm">
        <thead>
          <tr className="text-ink-muted">
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
    </div>
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

function canEdit(role: Role) {
  return role === "owner" || role === "editor";
}

function statusKey(s: KeywordStatus) {
  if (s === "tracked") return "stTracked" as const;
  if (s === "briefed") return "stBriefed" as const;
  if (s === "ignored") return "stIgnored" as const;
  return "stNew" as const;
}
