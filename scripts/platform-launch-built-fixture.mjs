/** Disposable acceptance runner for the actual built app; never a deployment entry point. */
import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const configPath = process.argv[2];
if (!configPath) throw new Error("Protected fixture configuration required");
const meta = await stat(configPath);
if ((meta.mode & 0o077) !== 0) throw new Error("Configuration must be private");
const c = JSON.parse(await readFile(configPath, "utf8"));
if (
  !c.dbDir ||
  !c.secret ||
  !c.productOrigin ||
  !c.platformOrigin ||
  !c.serviceToken ||
  !c.principalId ||
  !c.platformTenantId ||
  !c.platformWorkspaceId ||
  !Number.isInteger(c.port)
)
  throw new Error("Incomplete fixture configuration");
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "";
process.env.PGLITE_DATA_DIR = c.dbDir;
process.env.BETTER_AUTH_URL = c.productOrigin;
process.env.BETTER_AUTH_SECRET = c.secret;
process.env.VITE_AUTH_ENABLED = "true";
process.env.MAZIYARID_LAUNCH_ENABLED = "true";
process.env.MAZIYARID_PLATFORM_ORIGIN = c.platformOrigin;
process.env.MAZIYARID_LAUNCH_SERVICE_TOKEN = c.serviceToken;

// Seed using the same complete migration order and tracking table as the real app.
// Close this writer before importing the bundle, which opens its own instance.
const pg = new PGlite(c.dbDir);
try {
  await pg.waitReady;
  await pg.exec(
    "create table _migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const migrations = (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) {
    await pg.transaction(async (tx) => {
      await tx.exec(await readFile(resolve("migrations", file), "utf8"));
      await tx.query("insert into _migrations(name) values($1)", [file]);
    });
  }
  await pg.query(
    'insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,$2,$3,true,now(),now())',
    ["fixture-product-user", "Synthetic", "synthetic@example.test"],
  );
  await pg.exec(
    "insert into tenants(id,owner_id) values('fixture-product-tenant','fixture-product-user');insert into projects(id,owner_id,name,tenant_id) values('fixture-project-one','fixture-product-user','One','fixture-product-tenant'),('fixture-project-two','fixture-product-user','Two','fixture-product-tenant');",
  );
  await pg.query(
    "insert into platform_launch_mappings(principal_id,platform_tenant_id,platform_workspace_id,user_id,project_id,tenant_id) values($1,$2,$3,'fixture-product-user','fixture-project-one','fixture-product-tenant')",
    [c.principalId, c.platformTenantId, c.platformWorkspaceId],
  );
} finally {
  await pg.close();
}

const { default: app } = await import(
  pathToFileURL(resolve(".vercel/output/functions/__server.func/index.mjs")).href
);
if (typeof app.fetch !== "function") throw new Error("Built application fetch handler unavailable");
const staticRoot = resolve(".vercel/output/static");
const mime = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, c.productOrigin);
    const staticPath = resolve(staticRoot, "." + decodeURIComponent(url.pathname));
    if (req.method === "GET" && staticPath.startsWith(staticRoot + "/")) {
      try {
        const meta = await stat(staticPath);
        if (meta.isFile()) {
          res.setHeader("Content-Type", mime[extname(staticPath)] ?? "application/octet-stream");
          res.end(await readFile(staticPath));
          return;
        }
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
      }
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(",") : value);
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) {
        res.writeHead(413);
        res.end();
        return;
      }
      chunks.push(chunk);
    }
    const request = new Request(url, {
      method: req.method,
      headers,
      ...(["GET", "HEAD"].includes(req.method) ? {} : { body: Buffer.concat(chunks) }),
    });
    const response = await app.fetch(request, { waitUntil: (p) => p.catch(() => {}) });
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "set-cookie") res.setHeader(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader("Set-Cookie", cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(503, { "Cache-Control": "no-store" });
    res.end("Fixture unavailable");
  }
});
await new Promise((resolve) => server.listen(c.port, "127.0.0.1", resolve));
console.log(JSON.stringify({ ready: true, built_handler: true, port: c.port }));
async function stop() {
  await new Promise((resolve) => server.close(resolve));
  const database = await globalThis.__pgliteInstance__;
  if (database) await database.close();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
