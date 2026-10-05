import { appPath, normalizeAppBase, validatePublicOrigin } from './public-paths.mjs';

/**
 * Resolve explicit deployment inputs without changing the root-mode defaults.
 * @param {{ builtBase?: string, env?: Record<string, string | undefined> }} options
 */
export function deploymentConfig({ builtBase = '/', env = {} } = {}) {
  const appBase = normalizeAppBase(builtBase);
  const runtimeBase = normalizeAppBase(env.MSROBOT_APP_BASE_PATH ?? '/');
  if (runtimeBase !== appBase) throw new Error('App base differs between build and runtime');
  const configured = env.BETTER_AUTH_URL?.trim();
  const publicOrigin = configured
    ? validatePublicOrigin(configured, { allowLocalHttp: env.NODE_ENV !== 'production' })
    : undefined;
  if (publicOrigin?.includes('*')) throw new Error('Public origin must be exact');
  if (appBase !== '/' && env.NODE_ENV === 'production' && !publicOrigin) {
    throw new Error('A prefixed production build requires an explicit public origin');
  }
  const cookiePrefix = appBase === '/' ? '__Host-grok-auth' : '__Host-msrobot-auth';
  return {
    appBase,
    publicOrigin,
    authBasePath: appPath('/api/auth', appBase),
    sessionTokenCookie: `${cookiePrefix}.session_token`,
    advanced: {
      useSecureCookies: false,
      // Root retains the legacy plugin cookie prefix; prefixed mode namespaces
      // all cookies created by Better Auth, including future plugin/state cookies.
      ...(appBase === '/' ? {} : { cookiePrefix }),
      defaultCookieAttributes: { secure: true, httpOnly: true, sameSite: /** @type {const} */ ('lax'), path: '/' },
      cookies: Object.fromEntries(['session_token', 'session_data', 'account_data', 'dont_remember'].map((name) => [name, { name: `${cookiePrefix}.${name}` }])),
    },
  };
}

/**
 * Existing OAuth registrations are never rewritten. Refuse an unready prefixed
 * deployment before creating state or exchanging codes.
 * @param {string} redirectUri
 * @param {string} appBase
 * @param {string | undefined} publicOrigin
 */
export function validateGoogleRedirectUri(redirectUri, appBase, publicOrigin) {
  if (normalizeAppBase(appBase) !== '/') {
    if (!publicOrigin || redirectUri !== publicOrigin + appPath('/api/google/oauth/callback', appBase)) {
      throw new Error('Google OAuth callback is not registered for this app mount');
    }
  }
  return redirectUri;
}
