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
