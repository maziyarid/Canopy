import { Button } from "@/components/ui";
import { useT } from "@/lib/locale";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useState } from "react";

export function UserMenu() {
  const t = useT();
  const { user, isPending } = useCurrentUserState();
  const [signingOut, setSigningOut] = useState(false);
  if (isPending) return <div className="h-8 w-28 animate-pulse rounded-full bg-raised" />;
  if (!user) {
    return (
      <a href="/login" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg">
        {t("ctaLogin")}
      </a>
    );
  }
  const label = user.displayName ?? user.primaryEmail ?? "Account";
  return (
    <div className="flex items-center gap-2">
      {user.profileImageUrl ? (
        <img src={user.profileImageUrl} alt="" className="size-8 rounded-full object-cover" />
      ) : (
        <span className="grid size-8 place-items-center rounded-full bg-primary/20 text-sm font-medium text-primary">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{label}</span>
      {authEnabled ? (
        <Button
          size="sm"
          variant="quiet"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOut("/").catch(() => setSigningOut(false));
          }}
        >
          {signingOut ? t("signingIn") : t("signOut")}
        </Button>
      ) : null}
    </div>
  );
}
