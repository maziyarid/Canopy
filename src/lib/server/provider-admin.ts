import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import {
  PROVIDER_KEYS,
  type ProviderKey,
  type ProviderState,
  type ProviderSyncRun,
} from "@/lib/analytics/contracts";
import {
  getProviderStates,
  getProviderSyncRuns,
  requestProviderRefresh,
} from "@/lib/analytics/gateway.server";
import { studioAuth } from "./studio-auth";
import { canAdminProviders, resolveAccess } from "./access";

export type ProviderAdminProvider = ProviderState & {
  accountRef: string;
  permissionTier: string;
  scopes: string[];
  connectionStatus: string;
  connectionLastSuccess: string | null;
  connectionLastAttempt: string | null;
  connectionFreshness: string | null;
  connectionError: string;
};

export type ProviderAdminView = {
  projectId: string;
  site: string;
  runtimeAvailable: boolean;
  runtimeError?: string;
  generatedAt?: string;
  providers: ProviderAdminProvider[];
  runs: ProviderSyncRun[];
};

const ProjectSchema = z.object({ projectId: z.string() });
const RefreshSchema = z.object({
  projectId: z.string(),
  providers: z.array(z.enum(PROVIDER_KEYS)).min(1).max(PROVIDER_KEYS.length),
  window: z.string().max(40).default("default"),
});

type ConnectionRow = {
  provider: string;
  account_ref: string;
  permission_tier: string;
  scopes: string;
  status: string;
  last_success: string | null;
  last_attempt: string | null;
  freshness: string | null;
  last_error: string;
};

function parseScopes(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function fallbackState(provider: ProviderKey): ProviderState {
  return {
    provider,
    status: "not_configured",
    auth_type: "",
    capability: "read",
    last_success: null,
    last_attempt: null,
    last_error: null,
    freshness: null,
    enabled: 1,
    updated_at: "",
  };
}

export const getProviderAdmin = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(ProjectSchema)
  .handler(async ({ context, data }): Promise<ProviderAdminView> => {
    const sql = await getSql();
    const { project, role, filter } = await resolveAccess(
      sql,
      context.userId,
      context.email,
      data.projectId,
    );
    if (!canAdminProviders(role, filter)) throw new Error("Forbidden");
    const rows = await sql<ConnectionRow>`
      select provider, account_ref, permission_tier, scopes, status,
             last_success, last_attempt, freshness, last_error
      from provider_connections
      where project_id = ${data.projectId}
    `;
    const connectionMap = new Map(rows.map((row) => [row.provider, row]));

    let runtimeAvailable = true;
    let runtimeError: string | undefined;
    let generatedAt: string | undefined;
    let states: ProviderState[] = [];
    let runs: ProviderSyncRun[] = [];

    try {
      const [providerResponse, runResponse] = await Promise.all([
        getProviderStates(data.projectId),
        getProviderSyncRuns(data.projectId, 100),
      ]);
      states = providerResponse.providers;
      generatedAt = providerResponse.generatedAt;
      runs = runResponse.runs.filter((run) => run.site === project.domain);
    } catch (error) {
      runtimeAvailable = false;
      runtimeError = error instanceof Error ? error.message : "Analytics gateway unavailable";
    }

    const stateMap = new Map(states.map((state) => [state.provider, state]));
    const providers = PROVIDER_KEYS.map((provider): ProviderAdminProvider => {
      const state = stateMap.get(provider) ?? fallbackState(provider);
      const connection = connectionMap.get(provider);
      return {
        ...state,
        accountRef: connection?.account_ref ?? "",
        permissionTier: connection?.permission_tier ?? "read",
        scopes: parseScopes(connection?.scopes ?? "[]"),
        connectionStatus: connection?.status ?? "not_configured",
        connectionLastSuccess: connection?.last_success ?? null,
        connectionLastAttempt: connection?.last_attempt ?? null,
        connectionFreshness: connection?.freshness ?? null,
        connectionError: connection?.last_error ?? "",
      };
    });

    return {
      projectId: data.projectId,
      site: project.domain,
      runtimeAvailable,
      runtimeError,
      generatedAt,
      providers,
      runs,
    };
  });

export const requestProviderSync = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(RefreshSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { project, role, filter } = await resolveAccess(
      sql,
      context.userId,
      context.email,
      data.projectId,
    );
    if (!canAdminProviders(role, filter)) throw new Error("Forbidden");
    if (!project.domain.trim()) throw new Error("Project domain is required before provider sync");

    return requestProviderRefresh(data.projectId, project.domain, data.providers, data.window);
  });
