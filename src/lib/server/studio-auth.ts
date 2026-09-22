import { createMiddleware } from "@tanstack/react-start";

export const studioAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
    const { getSessionUser, requireUserId } = await import("@/lib/auth/verify.server");
    assertSameSiteRequest();
    const userId = await requireUserId(context.bearerToken);
    const user = await getSessionUser(context.bearerToken);
    return next({
      context: {
        userId,
        email: (user?.email ?? "").toLowerCase().trim(),
      },
    });
  });
