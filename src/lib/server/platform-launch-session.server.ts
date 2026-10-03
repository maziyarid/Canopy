import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { AuthContext } from "better-auth";
import type { Sql } from "../db.ts";
import { LaunchError, type LaunchReceipt } from "./platform-launch.ts";
import { currentLaunchMapping, LAUNCH_SESSION_MARKER } from "./platform-launch-store.ts";

// BetterAuth plugin-specific DBAdapter generics are invariant; the installed
// instance still supplies the complete runtime AuthContext.
type ProductAuth = { $context: Promise<unknown> };
/** Uses the EXISTING product BetterAuth adapter and signing configuration. */
export async function createProductLaunchSession(
  auth: ProductAuth,
  sql: Sql,
  receipt: LaunchReceipt,
  request: Request,
): Promise<Response> {
  const context = (await auth.$context) as AuthContext;
  const cookie = context.authCookies.sessionToken;
  if (
    !cookie.name.startsWith("__Host-") ||
    cookie.attributes.domain ||
    !cookie.attributes.secure ||
    !cookie.attributes.httpOnly ||
    cookie.attributes.path !== "/"
  )
    throw new LaunchError(503);
  const mapping = await currentLaunchMapping(sql, receipt.intent);
  const user = await context.internalAdapter.findUserById(mapping.user_id);
  if (!user) throw new LaunchError(403);
  const endpoint = createAuthEndpoint.serverOnly({ method: "POST" }, async (ctx) => {
    // Short product session, independent of the consumed 60-second handoff.
    const expiresAt = new Date(Date.now() + 3600_000);
    const session = await ctx.context.internalAdapter.createSession(
      user.id,
      false,
      { userAgent: LAUNCH_SESSION_MARKER + receipt.receipt_id, expiresAt },
      true,
    );
    if (!session) throw new LaunchError(503);
    try {
      const fresh = await currentLaunchMapping(sql, receipt.intent);
      if (
        fresh.user_id !== mapping.user_id ||
        fresh.project_id !== mapping.project_id ||
        fresh.tenant_id !== mapping.tenant_id
      )
        throw new LaunchError(403);
      await sql.query(
        `insert into platform_launch_sessions
        (session_id,receipt_id,principal_id,platform_tenant_id,platform_workspace_id,user_id,project_id,tenant_id,expires_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          session.id,
          receipt.receipt_id,
          mapping.principal_id,
          mapping.platform_tenant_id,
          mapping.platform_workspace_id,
          mapping.user_id,
          mapping.project_id,
          mapping.tenant_id,
          expiresAt,
        ],
      );
      await setSessionCookie(ctx, { session, user }, false, { maxAge: 3600 });
      // Browser receives cookies plus a local redirect only, never session JSON.
      ctx.setHeader("Location", "/p/" + encodeURIComponent(mapping.project_id));
      ctx.setHeader("Cache-Control", "no-store");
      ctx.setHeader("Referrer-Policy", "no-referrer");
      ctx.setStatus(303);
      return new Response(null, { status: 303 });
    } catch {
      await ctx.context.internalAdapter.deleteSession(session.token);
      throw new LaunchError(403);
    }
  });
  return endpoint({ context, request, headers: request.headers, asResponse: true });
}
