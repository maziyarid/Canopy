import { deploymentConfig } from "../../scripts/deployment-config.mjs";
import { appPath, safeAppReturnPath } from "../../scripts/public-paths.mjs";

// Fail during server startup, before any HTML/API/static response can be served.
// Runtime environment must agree with the immutable build's external mount.
const { appBase } = deploymentConfig({
  builtBase: import.meta.env.BASE_URL,
  env: process.env,
});

export default function appMountMiddleware(
  event: { url: URL; req: { method: string } },
  next: () => unknown | Promise<unknown>,
): unknown | Promise<unknown> {
  if (appBase === "/") return next();
  if (event.url.pathname === appBase && ["GET", "HEAD"].includes(event.req.method)) {
    return new Response(null, {
      status: 307,
      headers: { Location: appPath("/", appBase) + event.url.search, "Cache-Control": "no-store" },
    });
  }
  if (!safeAppReturnPath(event.url.pathname, appBase)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return next();
}
