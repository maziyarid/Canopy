# Ms Robot deployment-path contract

## Status and boundaries

This is a source-only foundation. No runtime consumer imports the new helpers;
root deployment remains unchanged. It does not enable subfolder hosting, change
authentication, install a proxy, migrate stored data, publish or deploy anything.

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
It can be consumed by later build/server/browser integrations. Configuration is
passed explicitly; no environment variable is introduced or activated here.

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

The generated server-function endpoint must also follow the app base. Its exact
URL must be checked against the installed framework during integration.

## Next integration step

First reconcile the exact running immutable release and any live-only fixes with
the intended source head. Then wire one validated base through Vite, TanStack
Start/router, auth client/server, redirects, OAuth callbacks, raw browser fetches,
PWA/install metadata and middleware. Preserve a root-compatibility build. Keep
origins separate from paths, fail on build/runtime base mismatch and verify actual
built node-server responses and redirects in both modes. Do not activate only one
consumer while the others still emit root URLs.

Retain the current same-origin launch rejection and exact-origin validation in
`src/lib/server/platform-launch.ts`. The path helper must not replace those guards.
Before a prefixed platform launch is enabled, add a versioned explicit registered
launch path and bind it through issuance and one-time redemption in both services.
Keep existing launch gates and trust settings; no path preference authorizes an
origin wildcard, cookie-domain expansion or new persistent access.

Subfolders share a browser origin. A path prefix or Cookie Path is not security
isolation. Review apex scripts and service-worker scope, preserve host-only
`__Host-` cookie requirements and use product-specific cookie/storage names before
authenticated exposure. Rebase PWA work after the separate demo/branding patch.
Production proxy, callback-registration and final route/auth cutover changes need
their own reviewed candidate, rollback plan and authorization.

## Verification

Run the dependency-free contract tests with:

```sh
node --test scripts/public-paths.test.mjs
```

They are also discovered by the existing `npm test` script. Run the full suite,
`npm run typecheck`, lint and `npm run test:launch` when integrating. The isolated
helper tests prove URL construction/validation, not a working prefixed deployment.
Later acceptance must cover hard refresh, login/logout, API and server-function
requests, OAuth cancel/retry, manifest/install scope, desktop/mobile and EN/FA RTL,
plus unchanged unrelated apex routes. Builds include a migration step: unset
`DATABASE_URL` or use a disposable test database, never a production database.
