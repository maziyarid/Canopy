import { APP_BASE } from "@/lib/public-paths";
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

async function handle(request: Request): Promise<Response> {
  try {
    const [{ getSql }, { guardLaunchAuthRequest }] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/server/platform-launch-auth.server"),
    ]);
    const freshRequest = await guardLaunchAuthRequest(auth, await getSql(), request, APP_BASE);
    return auth.handler(freshRequest);
  } catch {
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
