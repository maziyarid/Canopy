import { appPath, normalizeAppBase, safeAppReturnPath } from './public-paths.mjs';

/**
 * Enforce path containment in addition to Better Auth's exact-origin checks.
 * The guard also covers direct HTTP/API callers that bypass the browser helper.
 * @param {{ path: string, body?: Record<string, unknown> | null, query?: Record<string, unknown> | null }} context
 * @param {string} appBase
 * @param {string | undefined} publicOrigin
 */
export function applyAuthReturnPolicy(context, appBase, publicOrigin) {
  if (normalizeAppBase(appBase) === '/') return;
  for (const values of [context.body, context.query]) {
    if (!values) continue;
    for (const key of ['callbackURL', 'errorCallbackURL', 'newUserCallbackURL', 'redirectTo']) {
      if (values[key] === undefined) continue;
      const value = values[key];
      const local = typeof value === 'string' && publicOrigin && value.startsWith(`${publicOrigin}/`)
        ? value.slice(publicOrigin.length)
        : value;
      const safe = safeAppReturnPath(local, appBase);
      if (!safe) throw new Error('Auth return URL must stay inside the app mount');
      values[key] = safe;
    }
  }
  // genericOAuth otherwise falls back to baseURL (an origin, not the app mount).
  if (context.body && /^\/(?:sign-in|sign-up)\//.test(context.path)) {
    context.body.callbackURL ??= appPath('/', appBase);
  }
}
