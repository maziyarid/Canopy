# Ms Robot Google Provider

Local-only read adapter for Google Search Console and authorised Google Analytics/Tag Manager discovery. It reuses the existing VPS Google identity and existing `googleapis` runtime rather than creating another Google Cloud project or credential.

## Security

- Binds to `127.0.0.1` only.
- All `/v1/*` endpoints require a separate internal bearer token.
- Google scopes remain read-only: Search Console, Analytics and Tag Manager.
- Does not expose the service-account key or Google access tokens.
- No Search Console, GA4 or GTM mutation endpoints are implemented.
- Project/site/property mapping is server-side and must fail closed when absent.
- GSC query/page/country/device filters are bounded and validated before reaching Google.
- GA4 landing-page query/fragment data and identifier-shaped path segments are removed before persistence.
- Legacy credential/package paths are installation dependencies and are not copied into this repository.

## Endpoints

- `GET /health`
- `GET /v1/sites`
- `POST /v1/gsc/search-analytics`
- `GET /v1/gsc/sitemaps?siteUrl=...`
- `POST /v1/gsc/inspect`
- `GET /v1/ga4/accounts`
- `POST /v1/ga4/run-report`
- `GET /v1/gtm/accounts`

Ms Robot analytics gateway is the durable normalization/ledger boundary; this service is a provider-specific read adapter.

## Existing GSC MCP compatibility adapter

`gsc-mcp-provider-adapter.mjs` preserves the existing four-tool stdio MCP contract while delegating Google calls to this provider through `gsc-mcp-provider-client.mjs`.

The intended runtime is the existing `maziyar-gsc-mcp-proxy.service` and existing public OAuth gateway route `/gsc-mcp`; this does **not** create a new public hostname or MCP gateway.

### Why this path

The legacy GSC MCP process is intentionally sandboxed with outbound networking denied and localhost allowed. Direct Google calls therefore fail at `tools/call` even though MCP initialize and `tools/list` work. The compatibility adapter keeps that sandbox intact and lets the already-authorised Google provider perform the external read.

### Activation gate

Do not activate merely because source tests pass. Before production change:

1. Confirm the current Google provider and OAuth gateway health.
2. Back up the existing GSC MCP source/build and systemd unit.
3. Copy the reviewed adapter and client into the existing GSC MCP application directory.
4. Point the adapter at `http://127.0.0.1:9131`.
5. Provide `GOOGLE_PROVIDER_TOKEN` only through an approved protected server-side credential reference. Never paste or copy the token into Git, chat, browser code or logs.
6. Keep `IPAddressDeny=any` and `IPAddressAllow=localhost`; do not grant the MCP process general internet access.
7. Change only the existing proxy child command from the legacy direct-Google entry point to the reviewed adapter.
8. Validate local stdio initialize, `tools/list`, and real bounded `tools/call`; then validate Streamable HTTP and the existing OAuth-protected `/gsc-mcp` path.
9. Verify unauthenticated public access still fails closed.
10. Monitor the service and gateway journal for a bounded window.

Steps 3–7 require explicit approval because they change production code/service state and add a persistent inter-service credential reference.

### Rollback

Restore the backed-up unit and legacy build/source, reload systemd, restart only `maziyar-gsc-mcp-proxy.service`, then re-run the pre-change MCP health checks. The Google provider and analytics gateway are independent and should not be rolled back for an MCP-adapter-only failure.
