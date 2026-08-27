import { Badge, Button, Textarea } from "@/components/ui";
import { AGENT_ROSTER } from "@/lib/demo-data";
import { locationLabel } from "@/lib/locations";
import { runResearchAgent } from "@/lib/server/agent";
import { useCanopy } from "@/lib/store";
import type { AgentPlaybook } from "@/lib/types";
import { LoaderCircle, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function Agents() {
  const messages = useCanopy((s) => s.messages);
  const addMessage = useCanopy((s) => s.addMessage);
  const addSeeds = useCanopy((s) => s.addSeeds);
  const setView = useCanopy((s) => s.setView);
  const keywords = useCanopy((s) => s.keywords);
  const settings = useCanopy((s) => s.settings);
  const [text, setText] = useState("Map a 90-day content plan for waterproof field notebooks in the US.");
  const [busy, setBusy] = useState(false);

  async function send() {
    const message = text.trim();
    if (!message || busy) return;
    addMessage({ role: "user", content: message });
    setText("");
    setBusy(true);
    try {
      const preview = keywords
        .slice(0, 12)
        .map((k) => `${k.keyword} (vol ${k.volume}, kd ${k.kd ?? "—"})`)
        .join("\n");
      const res = await runResearchAgent({
        data: {
          message,
          domain: settings.domain,
          location: locationLabel(settings.locationId),
          keywordsPreview: preview,
        },
      });
      if (!res.ok) {
        addMessage({ role: "assistant", content: res.error });
        toast.error(res.error);
        return;
      }
      addMessage({
        role: "assistant",
        content: res.reply,
        playbook: res.playbook as AgentPlaybook | null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Agent failed";
      addMessage({ role: "assistant", content: msg });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="flex min-h-0 flex-col">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">Desk</p>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Research agents
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Grok plans the run. The Google Sheet executes it against Mangools on a trigger
          or via the web app webhook your other agents can POST to.
        </p>

        <div className="mt-4 flex flex-1 flex-col overflow-hidden rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
          <div className="flex-1 space-y-4 overflow-auto px-1 py-2">
            {messages.map((m) => (
              <article
                key={m.id}
                className={
                  m.role === "user"
                    ? "ml-8 rounded-xl rounded-tr-sm bg-raised px-4 py-3 text-sm"
                    : "mr-4 rounded-xl rounded-tl-sm bg-bg px-4 py-3 text-sm shadow-[var(--shadow-border)]"
                }
              >
                <p className="whitespace-pre-wrap text-pretty">{m.content}</p>
                {m.playbook ? (
                  <PlaybookCard
                    playbook={m.playbook}
                    onApply={() => {
                      addSeeds(m.playbook!.seeds);
                      toast.success("Seeds written to the Keywords sheet");
                      setView("workspace");
                    }}
                  />
                ) : null}
              </article>
            ))}
            {busy ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <LoaderCircle className="size-4 animate-spin" />
                Drafting playbook
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Topic, domain, or a job for the sheet"
              className="min-h-20 flex-1"
            />
            <Button type="submit" disabled={busy || !text.trim()} className="h-11 shrink-0">
              <Send className="size-4" />
              Run
            </Button>
          </form>
        </div>
      </section>

      <aside className="grid h-fit gap-3">
        {AGENT_ROSTER.map((a) => (
          <div key={a.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-medium">{a.name}</h2>
              <Badge>{a.id}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{a.job}</p>
            <p className="mt-2 font-mono text-xs text-subtle">{a.uses}</p>
          </div>
        ))}
      </aside>
    </div>
  );
}

function PlaybookCard({
  playbook,
  onApply,
}: {
  playbook: AgentPlaybook;
  onApply: () => void;
}) {
  return (
    <div className="mt-3 rounded-lg bg-raised p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-medium">{playbook.title}</h3>
        <Button size="sm" onClick={onApply}>
          Write seeds to sheet
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted">{playbook.summary}</p>
      {playbook.seeds?.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {playbook.seeds.map((s) => (
            <li key={s}>
              <Badge tone="accent">{s}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {playbook.tasks?.length ? (
        <ol className="mt-3 space-y-1.5 text-sm">
          {playbook.tasks.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-16 shrink-0 font-medium text-accent">{t.agent}</span>
              <span className="text-muted">
                {t.action} — {t.input}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {playbook.notes ? <p className="mt-2 text-xs text-subtle">{playbook.notes}</p> : null}
    </div>
  );
}
