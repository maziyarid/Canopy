import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { Workspace } from "@/components/workspace";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/p/$id")({ component: ProjectPage });

function ProjectPage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="h-8 w-40 animate-pulse rounded-full bg-raised" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return (
    <Shell dense>
      <Workspace id={id} />
    </Shell>
  );
}
