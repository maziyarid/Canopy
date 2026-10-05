# Ms Robot deployment-path contract

## Status and boundaries

This is an integrated, source-only candidate. Root is still the default. An
explicit prefixed build wires the mount through Vite, TanStack Start, Nitro,
authentication, browser URLs, static assets and PWA metadata. Nothing here installs
a proxy, changes an active origin or OAuth registration, publishes, deploys or
migrates production data. The public product page belongs to the separate apex
source and is not implemented by this application patch.

The chosen public contract is:

- Public product page: `https://maziyarid.com/msrobot` (the apex website owns it).
- Full application: `https://maziyarid.com/msrobot/app/`.
- Identity and shared launch backend: keep the existing `id.maziyarid.com` and
  `app.maziyarid.com` services. The product and platform origins remain distinct.
- Product browser endpoints, assets and install help stay below the app mount;
  the app must not claim apex `/login`, `/api`, `/assets`, `/__grok` or `/`.
- Existing independent machine/backend API contracts are outside this change.

## Pure helper API

`scripts/public-paths.mjs` has no imports, environment reads or side effects.
Build/server/browser consumers pass configuration explicitly; the pure helpers
themselves do not read environment variables.

- `normalizeAppBase(value = "/")`: returns `/` for root, or a base such as
  `/msrobot/app` without a trailing slash. One optional trailing slash is accepted.
  Empty strings, non-strings, origins, query/fragment, percent encoding, whitespace,
  backslashes, doubled slashes and dot traversal segments throw `TypeError`.
  Base segments contain ASCII letters, digits, `.`, `_`, `~` or `-`.
- `appPath(route = "/", base = "/")`: mounts a logical app-local path. For example,
  `appPath("/login", "/msrobot/app")` returns `/msrobot/app/login`, and `/` maps to
  `/msrobot/app/`. Input requires a single leading slash; it is not a URL resolver.
  Pass logical paths exactly once, never an already mounted URL. Do not manually
  prefix TanStack `Link` route IDs: the router must apply its own configured base.
- `safeAppReturnPath(value, base = "/")`: validates an already mounted browser
  return target. A bad target returns `null`; a bad configured base throws. The
  exact bare mount normalizes to its trailing-slash form. Prefix lookalikes and
  absolute URLs are rejected, even when their origin appears correct. Callers
  choose an explicit safe fallback, for example `appPath("/", base)`.
- `validatePublicOrigin(value, { allowLocalHttp = false } = {})`: accepts an exact
  canonical HTTPS origin such as `https://maziyarid.com`, with no trailing slash,
  credentials, path, query or fragment. Explicit `allowLocalHttp: true` permits
  only `localhost`, `127.0.0.1` and `[::1]` over HTTP for local checks. An origin
  passing syntax validation is not automatically a trusted origin.

Paths use ordinary unreserved ASCII route/asset characters or percent-encoded
UTF-8 data. Raw spaces/Unicode must be encoded first. Literal or encoded `.`/`..`
segments, separators, backslashes, controls, encoded `%` and malformed encodings
are rejected before a URL parser can normalize them. Rejecting encoded `%` also
rejects nested encoding rather than guessing how many times a proxy may decode.
Query and fragment remain opaque, byte-for-byte suffixes; their UTF-8 escapes and
control characters and raw UTF-16 are validated. Encoded slashes in query data
are allowed. Preservation describes the helper's output string, not browser
canonical serialization: a browser can percent-encode valid raw Unicode suffixes.
Never decode a returned value before navigating. This helper does not authorize
access, validate the meaning of query parameters or secure nested redirect URLs.

## Route examples

With app base `/msrobot/app`, logical routes become:

- `/login` → `/msrobot/app/login`
- `/p/<id>` → `/msrobot/app/p/<id>` (encode dynamic path segments first)
- `/api/auth/*` → `/msrobot/app/api/auth/*`
- `/api/v1/reporting/snapshot` → `/msrobot/app/api/v1/reporting/snapshot`
- `/api/google/oauth/callback` → `/msrobot/app/api/google/oauth/callback`
- `/launch/accept` → `/msrobot/app/launch/accept`
- `/assets/*`, the manifest and `/__grok/*` → their corresponding app-prefixed paths

The locked Start plugin generates `/msrobot/app/_serverFn/<id>` for this mount.
TanStack route IDs stay logical and unprefixed. Nitro's asset base is configured
explicitly because it does not inherit Vite's base. Root CSS uses a side-effect
import so Start supplies the matching stylesheet from its generated manifest.

## Build and runtime configuration

- `MSROBOT_APP_BASE_PATH` defaults to `/`. Set `/msrobot/app` at both build and
  runtime for the staged candidate. A mismatch aborts startup before listening.
- `BETTER_AUTH_URL` remains an exact HTTPS origin with no path or trailing slash,
  e.g. `https://maziyarid.com`. A prefixed production build requires it. Production
  credentialed auth trusts only this exact configured origin, with no local-dev
  additions or wildcard expansion.
- Better Auth's separate `basePath` becomes `/msrobot/app/api/auth`. Server-side
  callback/return guards reject same-origin paths outside the application too.
- `NITRO_PRESET=node-server` selects the existing node build; the default preset
  is unchanged. The build copies PGLite support assets into the selected output.
- Native email/password configuration and provider enablement are unchanged.
  `GOOGLE_WRITE_OAUTH_REDIRECT_URI` is never rewritten or registered automatically.
  Prefixed mode refuses to start/exchange a delegated Google flow unless it equals
  the explicit public origin plus `/msrobot/app/api/google/oauth/callback`.
- Prefixed platform launch returns a no-store 404 even if its legacy enable flag
  is set. The platform issuer's path-bound contract is unavailable in this source.
  Root-mode launch keeps its existing guards and protocol.
- Prefixed cookies all use `__Host-msrobot-auth.*`, including provider state,
  and retain Secure, HttpOnly, SameSite=Lax, Path=/ and no Domain. Root session
  names remain unchanged. Cookie Path is deliberately not narrowed.
- Prefixed local/session storage uses a product/version namespace. Only a validated
  `en`/`fa` locale preference may copy once from the legacy key. No token, account,
  saved ledger or cross-origin data is migrated; old storage is retained.

## Remaining cutover gates

Reconcile the exact running immutable release and live-only fixes before proposing
activation. Review the actual apex Flask source, proxy include ordering, shared
origin scripts/service workers and owner login flow. These are not available or
changed in this source-only candidate. Preserve the existing independent backend
services, hostnames and legacy callbacks until a separate transition is accepted.

Retain the current same-origin launch rejection and exact-origin validation in
`src/lib/server/platform-launch.ts`. The path helper must not replace those guards.
Before a prefixed platform launch is enabled, add a versioned explicit registered
launch path and bind it through issuance and one-time redemption in both services.
Keep existing launch gates and trust settings; no path preference authorizes an
origin wildcard, cookie-domain expansion or new persistent access.

Subfolders share a browser origin. A path prefix or Cookie Path is not security
isolation. Review apex scripts and service-worker scope, preserve host-only
`__Host-` cookie requirements and use product-specific cookie/storage names before
authenticated exposure. This candidate includes the separate PR #27 demo/branding correction and PR #29 path foundation.
Production proxy, callback-registration and final route/auth cutover changes need
their own reviewed candidate, rollback plan and authorization.

## Verification

Builds include a migration step: explicitly unset `DATABASE_URL` for isolated
checks. The built test launches its own loopback process and disposable local
PGLite database using only synthetic credentials and data, then removes them.

```sh
env -u DATABASE_URL MSROBOT_APP_BASE_PATH=/ NITRO_PRESET=node-server npm run build
env -u DATABASE_URL MSROBOT_APP_BASE_PATH=/ node scripts/check-subfolder-built.mjs
env -u DATABASE_URL MSROBOT_APP_BASE_PATH=/msrobot/app NITRO_PRESET=node-server npm run build
env -u DATABASE_URL MSROBOT_APP_BASE_PATH=/msrobot/app node scripts/check-subfolder-built.mjs
npm run typecheck
npm run test:launch
npm test
```

The HTTP checks cover hard refresh, login/deep links, referenced assets, manifest
and install scope, native signup/session/logout, stale-cookie denial, an actual
server function, reporting-disabled responses, OAuth initiation/cancellation,
return-path containment, disabled prefixed launch, external path boundaries and
startup mismatch. They are not desktop/mobile browser or real-provider acceptance.

Existing broad-suite failures must be disclosed separately: the migration manifest
expectation omits 0013, the worker imports an absent `parseVaultKeyring`, and the
published-content calendar-end-date test includes an extra row. Existing lint
findings also remain outside this bounded change. Browser rendering, RTL/mobile,
real provider login, apex/proxy coexistence and production rollback are still gates.
