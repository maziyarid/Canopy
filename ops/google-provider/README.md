# Ms Robot Google Provider

Local-only read adapter for Google Search Console. It deliberately reuses the existing VPS service account and existing `googleapis` runtime rather than creating a new Google Cloud project or credential.

## Security

- Binds to `127.0.0.1` only.
- All `/v1/*` endpoints require a separate bearer token.
- Uses only `https://www.googleapis.com/auth/webmasters.readonly`.
- Does not expose the service-account key or OAuth access tokens.
- No Search Console mutation endpoints are implemented.
- Legacy credential/package paths are installation dependencies and are not copied into this repository.

## Endpoints

- `GET /health`
- `GET /v1/sites`
- `POST /v1/gsc/search-analytics`
- `GET /v1/gsc/sitemaps?siteUrl=...`
- `POST /v1/gsc/inspect`

Ms Robot analytics gateway is the durable normalization/ledger boundary; this service is a provider-specific read adapter.

## Search Analytics pagination

`POST /v1/gsc/search-analytics` accepts `startRow` (a non-negative safe integer,
default `0`) and `rowLimit` (an integer from `1` to `25000`, default `1000`).
Both are forwarded to Google's Search Analytics query. Invalid values return
`400` before any Google request; strings and booleans are not coerced.

The gateway owns the page loop and its completeness checks. This adapter returns
one page, including an empty final page. Google may omit anonymised queries or
apply its own row limits; exhausting pages is not a guarantee of every search.

Keep `search-analytics.mjs` beside `provider.mjs` when preparing a release. Its
request/response code is tested without credentials or the VPS `googleapis`
installation by `node --test scripts/google-provider-pagination.test.mjs`.
