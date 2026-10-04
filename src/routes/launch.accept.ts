import { createFileRoute } from "@tanstack/react-router";
import { acceptPlatformLaunch } from "@/lib/server/platform-launch-handler.server";
export const Route = createFileRoute("/launch/accept")({
  server: {
    handlers: {
      POST: ({ request }) => acceptPlatformLaunch(request),
      GET: () =>
        new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "POST", "Cache-Control": "no-store" },
        }),
    },
  },
});
