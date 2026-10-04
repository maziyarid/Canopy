/** Runs the real built app against disposable loopback reporting state. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
const configPath = process.argv[2];
const meta = await stat(configPath);
if ((meta.mode & 0o077) !== 0) throw new Error("Configuration must be private");
const settings = JSON.parse(await readFile(configPath, "utf8"));
if (settings.MS_ROBOT_SMOKE_FIXTURE !== "isolated-test-data" || new URL(settings.BETTER_AUTH_URL).hostname !== "127.0.0.1") throw new Error("Disposable loopback fixture required");
Object.assign(process.env, settings, { NODE_ENV: "test", DATABASE_URL: "", GROK_PROJECT_ID: "", MAZIYARID_LAUNCH_ENABLED: "false" });
const c = { productOrigin: settings.BETTER_AUTH_URL, port: Number(new URL(settings.BETTER_AUTH_URL).port) };
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
  ".webp": "image/webp",
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
