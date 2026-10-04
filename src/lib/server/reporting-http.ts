import {
  loadReportingSnapshot,
  reportClosingDate,
  SnapshotAccessError,
  type AccessResolver,
  type LedgerReader,
  type SnapshotSql,
} from "./reporting-snapshot-service.ts";
import {
  periodFromLabel,
  comparisonPeriod,
  type SnapshotPeriod,
} from "./reporting-snapshot-core.ts";

/** Internal values returned by a reviewed authentication and mapping adapter.
 * Neither is ever read from the request's project/site/user headers or query.
 */
export type ReportingIdentity = { userId: string; email: string };
export type ReportingBinding = { projectId: string; site: string };
export type ReportingHttpDependencies = {
  authenticate: (request: Request) => Promise<ReportingIdentity | null>;
  resolveBinding: (identity: ReportingIdentity) => Promise<ReportingBinding | null>;
  resolveAccess: AccessResolver;
  sql: SnapshotSql;
  readLedger: LedgerReader;
  now?: () => Date;
};

const periods = new Set(["last_7d", "last_14d", "last_28d", "last_30d", "last_90d"]);
const queryKeys = new Set(["period", "comparison", "endDate"]);

function failure(status: number, error: string, extraHeaders?: HeadersInit): Response {
  return Response.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...extraHeaders,
      },
    },
  );
}

function parseQuery(request: Request, now: Date) {
  const query = new URL(request.url).searchParams;
  for (const key of query.keys()) {
    if (!queryKeys.has(key) || query.getAll(key).length !== 1)
      throw new SnapshotAccessError(400, "Invalid request");
  }
  const periodLabel = query.get("period") ?? "last_28d";
  const comparison = query.get("comparison") ?? "previous";
  if (!periods.has(periodLabel) || !["previous", "none"].includes(comparison))
    throw new SnapshotAccessError(400, "Invalid request");
  const endDate = query.get("endDate") ?? undefined;
  if (endDate === "") throw new SnapshotAccessError(400, "Invalid request");
  const period = periodFromLabel(periodLabel, reportClosingDate(endDate, now));
  const validateWindow = (window: SnapshotPeriod) => {
    for (const date of [window.start, window.end]) {
      if (date < "0001-01-01") throw new SnapshotAccessError(400, "Invalid request");
      reportClosingDate(date, now);
    }
  };
  // Validate before comparison arithmetic: inherited ISO slicing cannot
  // represent negative or extended years. Both windows must stay in 0001–9999.
  validateWindow(period);
  if (comparison === "previous") validateWindow(comparisonPeriod(period));
  return { periodLabel, comparisonLabel: comparison === "none" ? "" : "previous", endDate };
}

/** Read-only transport around the existing snapshot/grants service.
 * No dependencies means unconfigured. The public route intentionally supplies
 * none until S2S authentication, rate limits and authoritative mapping have
 * separately passed review. This factory does not provision any credential.
 */
export function createReportingSnapshotHandler(dependencies?: ReportingHttpDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "GET") return failure(405, "method_not_allowed", { Allow: "GET" });
    if (!dependencies) return failure(503, "reporting_unconfigured");
    try {
      const identity = await dependencies.authenticate(request);
      if (!identity?.userId?.trim()) return failure(401, "unauthorized");
      const now = dependencies.now?.() ?? new Date();
      const query = parseQuery(request, now);
      const binding = await dependencies.resolveBinding(identity);
      if (!binding?.projectId?.trim() || !binding.site?.trim()) return failure(404, "not_found");
      const resolveAccess: AccessResolver = async (...args) => {
        const access = await dependencies.resolveAccess(...args);
        // A service account must be restricted to existing client grants.
        // Never promote an owner/editor role into external reporting access.
        if (
          access.role !== "client" ||
          access.filter.trim() ||
          access.project.id !== binding.projectId ||
          access.project.domain !== binding.site
        ) {
          throw new SnapshotAccessError(404, "Not found");
        }
        return access;
      };
      const snapshot = await loadReportingSnapshot({
        sql: dependencies.sql,
        resolveAccess,
        ...identity,
        projectId: binding.projectId,
        ...query,
        now,
        readLedger: dependencies.readLedger,
      });
      const headers = {
        "Cache-Control": "private, no-cache",
        Vary: "Authorization",
        // The canonical snapshot hash excludes volatile request timestamps.
        // RFC 9110 requires a weak HTTP validator for semantic equivalence.
        ETag: `W/${snapshot.etag}`,
        "X-Content-Type-Options": "nosniff",
      };
      // Revalidate identity, explicit scope and current grants before a 304.
      const validators =
        request.headers
          .get("If-None-Match")
          ?.split(",")
          .map((value) => value.trim().replace(/^W\//, "")) ?? [];
      if (validators.includes("*") || validators.includes(snapshot.etag))
        return new Response(null, { status: 304, headers });
      return Response.json(snapshot, { headers });
    } catch (error) {
      if (error instanceof SnapshotAccessError) {
        if (error.status === 400) return failure(400, "invalid_request");
        if (error.status === 403 || error.status === 404) return failure(404, "not_found");
      }
      // No raw exception, provider warning, URL, credential or PII in failures.
      return failure(503, "reporting_unavailable");
    }
  };
}
