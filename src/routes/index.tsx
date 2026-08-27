import { Agents } from "@/components/agents";
import { Atlas } from "@/components/atlas";
import { ScriptStudio } from "@/components/script-studio";
import { Setup } from "@/components/setup";
import { Shell } from "@/components/shell";
import { Workspace } from "@/components/workspace";
import { useCanopy } from "@/lib/store";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const view = useCanopy((s) => s.view);
  useEffect(() => {
    void useCanopy.persist.rehydrate();
  }, []);
  return (
    <Shell>
      {view === "workspace" ? <Workspace /> : null}
      {view === "agents" ? <Agents /> : null}
      {view === "script" ? <ScriptStudio /> : null}
      {view === "atlas" ? <Atlas /> : null}
      {view === "setup" ? <Setup /> : null}
    </Shell>
  );
}
