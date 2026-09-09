import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/dashboard";
import { Landing } from "@/components/landing";
import { Shell } from "@/components/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-muted">
        <div className="h-8 w-40 animate-pulse rounded-full bg-raised" />
      </div>
    );
  }
  if (!user) return <Landing />;
  return (
    <Shell>
      <Dashboard />
    </Shell>
  );
}
