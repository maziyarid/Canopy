# Reporting HTTP contract (disabled source slice)

`GET /api/v1/reporting/snapshot` is a read-only facade for the existing
`ms-robot.reporting.v1` snapshot. **The shipped route is unconfigured and returns 503.** It does not access a database, call an upstream service, inspect a bearer
token, generate credentials, refresh providers, or activate an event consumer.
The handler factory is independently testable; it is not an authentication
implementation. There is no environment-only enable flag.

## Request

- `period`: `last_7d`, `last_14d`, `last_28d`, `last_30d`, `last_90d`; default `last_28d`.
- `comparison`: `previous` or `none`; default `previous`.
- `endDate`: optional real, nonfuture UTC date `YYYY-MM-DD`.
  Both requested and comparison windows must remain within positive four-digit
  years 0001–9999; underflow returns 400 rather than a malformed historical date.
- `If-None-Match`: optional entity-tag or list, including weak validators.

Duplicate or unknown query keys are rejected. In particular `projectId`, `site`,
clinic identity and user identity cannot be supplied in the query. A future CRM
adapter derives its binding from its authenticated clinic on its own backend;
it must not forward a CRM/browser bearer or infer project ownership from a domain.

## Success and errors

- `200`: the existing canonical snapshot, with period, comparison,
  sections/comparisonSections, providerHealth, stable etag, data dates, coverage,
  provenance and freshness. Client grants filter both windows and provider health.
- `304`: no body; only after fresh authentication, exact mapping and current grants.
- `400`: `{"error":"invalid_request"}`.
- `401`: `{"error":"unauthorized"}` for invalid identity.
- `404`: `{"error":"not_found"}` for missing, foreign or unauthorized mapping.
- `405`: `{"error":"method_not_allowed"}`, `Allow: GET` in the handler.
- `503`: `{"error":"reporting_unconfigured"}` (current route) or
  `{"error":"reporting_unavailable"}` (configured dependency failure).

Success uses `Cache-Control: private, no-cache`, `Vary: Authorization` and a weak HTTP ETag (`W/"hash"`);
errors use `no-store`. Snapshot times and correlation IDs are volatile; ETag
follows the existing semantic snapshot body. The JSON body's canonical `etag`
remains unchanged (`"hash"`). Weak comparison is used for conditional GET, per
[RFC 9110 §8.8.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3).
Every non-GET method is caught by the route and returns 405/no-store, including
extension methods such as PROPFIND and PURGE. Partial provider state remains
explicit, with valid metrics preserved; missing values are not converted to zero.
No raw exception messages, patient/contact data, provider credentials, narrative
generation, exports or manual refresh are introduced by this contract.

## Separate activation gate

Before replacing the route's no-argument factory call, independently review:

1. A real S2S authentication adapter, with bounded rate limits and credential
   lifecycle, using only an explicitly approved existing identity or separately
   approved credential provisioning. Never accept arbitrary request claims.
2. An authoritative identity-to-project/site binding. Every request rechecks the
   exact project ID and site against current client-role grants. Owner/editor or
   keyword-restricted identities cannot use this client reporting facade.
3. Existing `resolveAccess` and persisted gateway ledger wiring, with fresh-grant
   and cross-scope denial tests through the real route and consumer.
4. Private transport/proxy, operational health, retention and human consent gates,
   and explicit deployment/activation approval. The source slice does not waive
   existing AAX-55/AAX-69 or project/site mapping gates.

No database migration, runtime setting or shared credential changes are part of
this slice. Deployment and service-to-service activation are not yet verified.

## Disposable built-route regression

After `env -u DATABASE_URL NITRO_PRESET=node-server npm run build`, run
`env -u DATABASE_URL npm run test:reporting-http:built`. This directly exercises
the compiled SSR entry for disabled GETs and standard/extension method denials.
It prepares local build-only PGlite assets, uses synthetic requests, creates no
listener and rejects an ambient DATABASE_URL. It does not probe a live service.
