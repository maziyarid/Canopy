import { Badge, Button, Field, Input } from "@/components/ui";
import { LANGUAGES, LOCATIONS, locationLabel } from "@/lib/locations";
import { useLocale, useT } from "@/lib/locale";
import { createProject, listProjects } from "@/lib/server/projects";
import { seedSampleStudio } from "@/lib/server/seed";
import type { DataDomain, Project } from "@/lib/types";
import { Link } from "@tanstack/react-router";
import { FolderPlus, Globe, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function Dashboard() {
  const t = useT();
  const lang = useLocale((s) => s.lang);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    domain: "",
    dataDomain: "other" as DataDomain,
    locationId: 2840,
    languageId: 1000,
  });

  async function reload() {
    const rows = await listProjects();
    setProjects(rows);
  }

  useEffect(() => {
    reload().catch(() => setProjects([]));
  }, []);

  if (projects === null) {
    return (
      <div className="grid flex-1 place-items-center text-muted">
        <LoaderCircle className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary">{t("studio")}</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t("yourProjects")}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await seedSampleStudio();
                await reload();
                toast.success(t("sampleLoaded"));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : t("forbidden"));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("loadSample")}
          </Button>
          <Button onClick={() => setOpen((v) => !v)}>
            <FolderPlus className="size-4" />
            {t("newProject")}
          </Button>
        </div>
      </div>

      {open ? (
        <form
          className="grid gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await createProject({ data: form });
              setForm({
                name: "",
                domain: "",
                dataDomain: form.dataDomain,
                locationId: form.locationId,
                languageId: form.languageId,
              });
              setOpen(false);
              await reload();
              toast.success(t("saved"));
            } catch (err) {
              toast.error(err instanceof Error ? err.message : t("forbidden"));
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="sm:col-span-2 text-sm text-muted">{t("createBody")}</p>
          <Field label={t("projectName")}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label={t("domain")}>
            <Input
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              placeholder="example.com"
            />
          </Field>
          <Field label="Data domain">
            <select
              className="h-10 w-full rounded-md bg-raised px-3 text-sm shadow-[var(--shadow-border)]"
              value={form.dataDomain}
              onChange={(e) => setForm({ ...form, dataDomain: e.target.value as DataDomain })}
            >
              <option value="medical">Medical</option>
              <option value="thesis">Thesis</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label={t("location")}>
            <select
              className="h-10 w-full rounded-md bg-raised px-3 text-sm shadow-[var(--shadow-border)]"
              value={form.locationId}
              onChange={(e) => setForm({ ...form, locationId: Number(e.target.value) })}
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
              value={form.languageId}
              onChange={(e) => setForm({ ...form, languageId: Number(e.target.value) })}
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {lang === "fa" ? l.labelFa : l.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy || !form.name.trim()}>
              {t("create")}
            </Button>
            <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : null}

      {!projects.length ? (
        <div className="grid flex-1 place-items-center rounded-2xl bg-surface px-6 py-16 text-center shadow-[var(--shadow-border)]">
          <Globe className="size-8 text-primary" />
          <p className="mt-3 max-w-md text-sm text-muted">{t("empty")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                to="/p/$id"
                params={{ id: p.id }}
                className="block h-full rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] transition-shadow duration-150 hover:shadow-[var(--shadow-border-hover)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-xl font-semibold">{p.name}</h2>
                  <Badge tone={p.role === "client" ? "paper" : "primary"}>{t(p.role)}</Badge>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted">{p.domain || "—"}</p>
                {p.keywordFilter ? (
                  <p className="mt-2 text-xs text-accent">
                    {t("scopedTo")}: {p.keywordFilter}
                  </p>
                ) : null}
                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-subtle">{t("keywords")}</dt>
                    <dd className="font-medium tabular-nums">{p.keywordCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">{t("avgRank")}</dt>
                    <dd className="font-medium tabular-nums">{p.avgRank ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">{t("top10")}</dt>
                    <dd className="font-medium tabular-nums">{p.top10}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-subtle">
                  {locationLabel(p.locationId, lang === "fa")} · {t("members")} {p.memberCount}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
