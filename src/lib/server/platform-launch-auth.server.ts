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
  const freshRequest = new Request(request, { headers });
  const path = new URL(request.url).pathname;
  // Recovery may clear a revoked launch session, while BetterAuth retains its
  // own Origin, method and native-session controls.
  if (request.method === "POST" && path === "/api/auth/sign-out") {
    if (headers.has("x-grok-identity"))
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    return freshRequest;
  }
  const scope = await requestLaunchScope(auth, sql, headers);
  if (scope && path !== "/api/auth/get-session")
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  return freshRequest;
}
