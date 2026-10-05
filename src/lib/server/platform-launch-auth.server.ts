import { appPath } from "../../../scripts/public-paths.mjs";
import type { Sql } from "../db.ts";
import { launchSessionScope } from "./platform-launch-store.ts";
import type { LaunchScope } from "./platform-launch-store.ts";
type Session = { user: { id: string; email?: string | null }; session: { id: string } };
type Reader = {
  api: {
    getSession: (input: {
      headers: Headers;
      query: { disableCookieCache: boolean };
    }) => Promise<Session | null>;
  };
};
type Handler = Reader & {
  $context: Promise<{ authCookies: { sessionData: { name: string } } }>;
};
export type LaunchAuthority = { user: Session["user"]; scope: LaunchScope | null };
/** Resolve native identity and scope together; cached identity is never a fallback. */
export async function requestLaunchAuthority(
  auth: Reader,
  sql: Sql,
  headers: Headers,
  allowGate = false,
): Promise<LaunchAuthority | null> {
  const safeHeaders = new Headers(headers);
  safeHeaders.delete("x-grok-identity");
  let session = await auth.api.getSession({
    headers: safeHeaders,
    query: { disableCookieCache: true },
  });
  // The existing gate plugin verifies its signature/audience before creating a
  // persisted session. It may run only after native session authority is absent.
  if (!session && allowGate && headers.has("x-grok-identity")) {
    session = await auth.api.getSession({
      headers: new Headers(headers),
      query: { disableCookieCache: true },
    });
  }
  if (!session) return null;
  const scope = await launchSessionScope(sql, session.session.id, session.user.id);
  if (scope && headers.has("x-grok-identity"))
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  return { user: session.user, scope };
}
export async function requestLaunchScope(
  auth: Reader,
  sql: Sql,
  headers: Headers,
): Promise<LaunchScope | null> {
  return (await requestLaunchAuthority(auth, sql, headers))?.scope ?? null;
}
/** Pass this returned request to BetterAuth so its delegated read cannot use cache. */
export async function guardLaunchAuthRequest(
  auth: Handler,
  sql: Sql,
  request: Request,
  appBase = "/",
): Promise<Request> {
  const name = (await auth.$context).authCookies.sessionData.name;
  const headers = new Headers(request.headers);
  const kept = (headers.get("cookie") ?? "")
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => {
      const key = pair.slice(0, pair.indexOf("="));
      return pair && key !== name && !key.startsWith(name + ".");
    });
  if (kept.length) headers.set("cookie", kept.join("; "));
  else headers.delete("cookie");
  // Nitro can supply a Request-compatible wrapper without Undici's private
  // slots. Rebuild from the public fields instead of native Request cloning.
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    signal: request.signal,
  };
  if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
    init.body = request.body;
    init.duplex = "half";
  }
  const freshRequest = new Request(request.url, init);
  const path = new URL(request.url).pathname;
  // Recovery may clear a revoked launch session, while BetterAuth retains its
  // own Origin, method and native-session controls.
  if (request.method === "POST" && path === appPath("/api/auth/sign-out", appBase)) {
    if (headers.has("x-grok-identity"))
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    return freshRequest;
  }
  const scope = await requestLaunchScope(auth, sql, headers);
  if (scope && path !== appPath("/api/auth/get-session", appBase))
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  return freshRequest;
}
