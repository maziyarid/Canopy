/** Isolated integration fixture: synthetic users, protected supplied runtime config. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { betterAuth } from "better-auth";
import { pgliteDialect } from "../src/lib/auth/pglite-dialect.ts";
import type { Sql } from "../src/lib/db.ts";
import { launchConfig, redeemLaunch, LaunchError } from "../src/lib/server/platform-launch.ts";
import { createProductLaunchSession } from "../src/lib/server/platform-launch-session.server.ts";
import { launchSessionScope } from "../src/lib/server/platform-launch-store.ts";
import { guardLaunchAuthRequest } from "../src/lib/server/platform-launch-auth.server.ts";
import { runWithLaunchScope } from "../src/lib/server/platform-launch-scope.server.ts";
import { resolveAccess } from "../src/lib/server/access.ts";
const configPath = process.argv[2];
if (!configPath) throw new Error("Protected fixture configuration required");
const meta = await stat(configPath);
if ((meta.mode & 0o077) !== 0) throw new Error("Configuration must be private");
const c = JSON.parse(await readFile(configPath, "utf8"));
const config = launchConfig({
  NODE_ENV: "test",
  MAZIYARID_LAUNCH_ENABLED: "true",
  MAZIYARID_PLATFORM_ORIGIN: c.platformOrigin,
  BETTER_AUTH_URL: c.productOrigin,
  MAZIYARID_LAUNCH_SERVICE_TOKEN: c.serviceToken,
});
if (
  !config ||
  !c.dbDir ||
  !c.secret ||
  !c.principalId ||
  !c.platformTenantId ||
  !c.platformWorkspaceId
)
  throw new Error("Incomplete fixture configuration");
const pg = new PGlite(c.dbDir);
await pg.waitReady;
for (const f of [
  "0001_auth.sql",
  "0002_canopy.sql",
  "0004_unified_stack.sql",
  "0010_report_section_grants.sql",
  "0012_platform_launch.sql",
])
  await pg.exec(await readFile(new URL("../migrations/" + f, import.meta.url), "utf8"));
await pg.query(
  'insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,$2,$3,true,now(),now()) on conflict(id) do nothing',
  ["fixture-product-user", "Synthetic", "synthetic@example.test"],
);
await pg.exec(
  "insert into tenants(id,owner_id) values('fixture-product-tenant','fixture-product-user') on conflict(id) do nothing;insert into projects(id,owner_id,name,tenant_id) values('fixture-project-one','fixture-product-user','One','fixture-product-tenant'),('fixture-project-two','fixture-product-user','Two','fixture-product-tenant') on conflict(id) do nothing;",
);
await pg.query(
  `insert into platform_launch_mappings(principal_id,platform_tenant_id,platform_workspace_id,user_id,project_id,tenant_id)
 values($1,$2,$3,'fixture-product-user','fixture-project-one','fixture-product-tenant') on conflict do nothing`,
  [c.principalId, c.platformTenantId, c.platformWorkspaceId],
);
const sql = (async (strings: TemplateStringsArray, ...params: unknown[]) => {
  let text = strings[0];
  for (let i = 0; i < params.length; i++) text += "$" + (i + 1) + strings[i + 1];
  return (await pg.query(text, params)).rows;
}) as Sql;
sql.query = async <T>(text: string, params: unknown[] = []) =>
  (await pg.query<T>(text, params)).rows;
const auth = betterAuth({
  baseURL: config.productOrigin,
  secret: c.secret,
  database: { dialect: pgliteDialect(() => pg), type: "postgres" },
  session: { cookieCache: { enabled: true, maxAge: 300 } },
  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: { secure: true, httpOnly: true, path: "/", sameSite: "lax" },
    cookies: {
      session_token: { name: "__Host-grok-auth.session_token" },
      session_data: { name: "__Host-grok-auth.session_data" },
    },
  },
});
const server = createServer(async (req, res) => {
  try {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers))
      if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(",") : v);
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 2048) throw new LaunchError(413);
      chunks.push(chunk);
    }
    const request = new Request(config.productOrigin + req.url, {
      method: req.method,
      headers,
      ...(["GET", "HEAD"].includes(req.method ?? "GET") ? {} : { body: Buffer.concat(chunks) }),
    });
    let response: Response;
    const path = new URL(request.url).pathname;
    if (path === "/launch/accept" && request.method === "POST") {
      const receipt = await redeemLaunch(request, config);
      response = await createProductLaunchSession(auth, sql, receipt, request);
    } else if (path.startsWith("/api/auth/")) {
      const freshRequest = await guardLaunchAuthRequest(auth, sql, request);
      response = await auth.handler(freshRequest);
    } else if (path.startsWith("/protected/")) {
      const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
      if (!session) throw new LaunchError(401);
      const scope = await launchSessionScope(sql, session.session.id, session.user.id);
      if (!scope) throw new LaunchError(403);
      await runWithLaunchScope(scope, () =>
        resolveAccess(
          sql,
          session.user.id,
          "",
          decodeURIComponent(path.slice("/protected/".length)),
        ),
      );
      response = Response.json({ allowed: true, project_id: scope.project_id });
    } else response = new Response("Not found", { status: 404 });
    res.statusCode = response.status;
    response.headers.forEach((v, k) => {
      if (k.toLowerCase() !== "set-cookie") res.setHeader(k, v);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader("Set-Cookie", cookies);
    res.end(await response.text());
  } catch (error) {
    res.statusCode = error instanceof LaunchError ? error.status : 503;
    res.setHeader("Cache-Control", "no-store");
    res.end("Launch unavailable");
  }
});
await new Promise<void>((resolve) => server.listen(c.port, "127.0.0.1", resolve));
console.log(JSON.stringify({ ready: true, port: c.port }));
async function stop() {
  await new Promise<void>((r) => server.close(() => r()));
  await pg.close();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
