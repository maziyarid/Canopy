import { createMiddleware } from "@tanstack/react-start";

export const studioAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
    const { requireUserId, UnauthorizedError, authConfigured } =
      await import("@/lib/auth/verify.server");
    assertSameSiteRequest();
    const [{ auth }, { getSql }, { requestLaunchAuthority }, { runWithLaunchScope }] =
      await Promise.all([
        import("@/lib/auth/server"),
        import("@/lib/db"),
        import("./platform-launch-auth.server"),
        import("./platform-launch-scope.server"),
      ]);
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const headers = new Headers(request?.headers);
    if (context.bearerToken) headers.set("Authorization", `Bearer ${context.bearerToken}`);
    const { gateIdentityEnabled } = await import("@/lib/auth/gate-identity.server");
    const authenticationEnabled = authConfigured || gateIdentityEnabled();
    const authority =
      request && authenticationEnabled
        ? await requestLaunchAuthority(auth, await getSql(), headers, true)
        : null;
    if (!authority && authenticationEnabled) throw new UnauthorizedError();
    const scope = authority?.scope ?? null;
    const user = authority?.user ?? null;
    const userId = user?.id ?? (await requireUserId(context.bearerToken));
    return runWithLaunchScope(scope, () =>
      next({
        context: {
          userId,
          email: scope ? "" : (user?.email ?? "").toLowerCase().trim(),
        },
      }),
    );
  });
