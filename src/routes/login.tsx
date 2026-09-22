import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Mark } from "@/components/mark";
import { Button, Field, Input } from "@/components/ui";
import { authClient, authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLocale, useT } from "@/lib/locale";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const t = useT();
  const toggle = useLocale((s) => s.toggle);
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="h-8 w-40 animate-pulse rounded-full bg-raised" />
      </div>
    );
  }
  if (user) return <Navigate to="/" />;

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0]!,
        });
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) throw new Error(err.message);
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-fg">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mark className="size-8" />
            <span className="font-display text-xl font-semibold">{t("appName")}</span>
          </div>
          <Button size="sm" variant="quiet" onClick={toggle}>
            {t("navLang")}
          </Button>
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold">{t("welcome")}</h1>
        <p className="mt-1 text-sm text-muted">{t("welcomeBody")}</p>

        {authEnabled ? (
          <div className="mt-5 grid gap-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="ghost"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                {t("continueWith")} {p.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Sign-in is disabled.</p>
        )}

        <p className="mt-5 text-center text-xs uppercase tracking-widest text-subtle">{t("orEmail")}</p>
        <form className="mt-3 grid gap-3" onSubmit={onEmail}>
          {mode === "up" ? (
            <Field label={t("name")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
          ) : null}
          <Field label={t("email")}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
          <Field label={t("password")}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
            />
          </Field>
          {error ? <p className="text-sm text-bad">{error}</p> : null}
          <Button type="submit" disabled={busy || !authEnabled}>
            {busy ? t("signingIn") : mode === "up" ? t("createAccount") : t("signIn")}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 text-sm text-primary"
          onClick={() => setMode((m) => (m === "in" ? "up" : "in"))}
        >
          {mode === "in" ? `${t("noAccount")} ${t("createAccount")}` : `${t("haveAccount")} ${t("signIn")}`}
        </button>
      </div>
    </main>
  );
}
