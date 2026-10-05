import { APP_BASE } from "../public-paths";
import { launchConfig, LaunchError, redeemLaunch } from "./platform-launch.ts";
export async function acceptPlatformLaunch(request: Request): Promise<Response> {
  try {
    // A prefixed receiver cannot safely use the legacy origin-only launch contract.
    if (APP_BASE !== "/") throw new LaunchError(404);
    const config = launchConfig(process.env);
    if (!config) throw new LaunchError(404);
    const receipt = await redeemLaunch(request, config);
    const [{ auth }, { getSql }, { createProductLaunchSession }] = await Promise.all([
      import("../auth/server"),
      import("../db"),
      import("./platform-launch-session.server"),
    ]);
    return await createProductLaunchSession(auth, await getSql(), receipt, request);
  } catch (error) {
    const status = error instanceof LaunchError ? error.status : 503;
    return new Response("Launch unavailable", {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
