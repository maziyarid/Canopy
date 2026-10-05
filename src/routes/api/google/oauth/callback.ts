import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { completeGoogleOAuthConnection } from "@/lib/google/google-oauth-flow.server";

function redirect(request: Request, state: "connected" | "error") {
  const target = new URL("/", request.url);
  target.searchParams.set("googleOAuth", state);
  return Response.redirect(target, 303);
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const error = url.searchParams.get("error");
  if (error || !state || !code) return redirect(request, "error");

  try {
    await completeGoogleOAuthConnection(await getSql(), state, code);
    return redirect(request, "connected");
  } catch {
    return redirect(request, "error");
  }
}

export const Route = createFileRoute("/api/google/oauth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: () =>
        new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET", "Cache-Control": "no-store" },
        }),
    },
  },
});
