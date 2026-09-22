# Ms Robot analytics gateway

Local-only provider gateway for AAX-50/AAX-66/AAX-67/AAX-68.

## Contract
- binds to 127.0.0.1 by default;
- bearer auth is required for provider/sync endpoints;
- /health is unauthenticated for local service checks;
- credentials stay in the server environment/secret store;
- provider failures degrade independently and never erase historical state;
- unconfigured providers are explicit rather than simulated.

## Runtime
Repository source is deployed to /srv/ms-robot-analytics/gateway.py.
State is stored in /var/lib/ms-robot-analytics/state.sqlite3.
The systemd unit reads /etc/ms-robot-analytics.env.

Provider adapters are activated only after real credentials and live read-back verification.


## Project isolation

All authenticated data-plane requests must include the internal `X-Ms-Robot-Project-Id` header in addition to the bearer token. The application server supplies this header only after its own project-access check; browser clients do not call the gateway directly.

Provider state, sync receipts, normalized metrics, snapshots, and GSC investigations are keyed and queried by project. Existing pre-scope SQLite rows are preserved under the reserved `legacy` project during the additive gateway migration and are never silently assigned to a real tenant.

Sync idempotency is enforced atomically with `unique(project_id, idempotency_key)`; concurrent retries for one logical project operation return the existing receipt rather than creating a second provider operation or reporting the uniqueness race as a provider failure.


### Scheduled portfolio sync

`portfolio_gsc.py` does not infer tenant ownership from a domain. Before enabling the portfolio timer, configure `MS_ROBOT_PROJECT_SITE_MAP_JSON` in the server-side analytics environment as a JSON object mapping each normalized site/domain to its canonical Ms Robot project ID. Example shape only: `{"example.com":"project-id"}`.

The job fails closed if that mapping is absent, malformed, or references a GSC property the connected Google account cannot read. Unmapped authorised GSC properties are not imported automatically. Monitor signals carry `projectId` through the ADA bridge so downstream evidence remains tenant-scoped.

The standalone `monitor_dispatch.py` path likewise requires `MS_ROBOT_MONITOR_PROJECT_ID`; it must not run as a portfolio-wide unscoped monitor.
