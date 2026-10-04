import { createFileRoute } from "@tanstack/react-router";
import { createReportingSnapshotHandler } from "@/lib/server/reporting-http";

// Deliberately unconfigured: no environment-only activation switch, implicit
// project inference, browser session forwarding or new persistent credentials.
// Enable only through a separately reviewed S2S identity/mapping integration.
const handle = createReportingSnapshotHandler();

export const Route = createFileRoute("/api/v1/reporting/snapshot")({
  server: {
    handlers: {
      // Unknown extension methods must not fall through to HTML rendering.
      ANY: ({ request }) => handle(request),
    },
  },
});
