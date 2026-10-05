# Ms Robot analytics gateway

Local-only provider gateway for AAX-50/AAX-66/AAX-67/AAX-68/AAX-69.

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

### GA4 Data API reporting

GA4 reporting uses the same loopback Google provider and server-side service-account identity as GSC, with the minimum read-only `analytics.readonly` scope. Account discovery through the Analytics Admin API does not establish reporting access; a real Data API `runReport` read is required before GA4 can be treated as available.

The gateway never infers a GA4 property from a domain. Configure `MS_ROBOT_PROJECT_GA4_MAP_JSON` only in the protected analytics environment, using canonical Ms Robot project IDs, normalized site keys and explicit GA4 property references. Example shape only:

```json
{
  "project-id": {
    "example.com": "properties/123456789"
  }
}
```

Missing, malformed, cross-project or unmapped entries fail closed. The mapping is configuration, not a credential, but it still belongs server-side because it defines tenant/property authority. Browser clients never submit or select a property ID.

The provider calls the official Google Analytics Data API `v1beta properties.runReport` endpoint for:
- period summary metrics (active/new users, sessions, engaged sessions, engagement rate, average session duration, event count and key events);
- daily measurements;
- session default channel group;
- landing-page path.

Raw provider credentials never leave the Google adapter. Query strings and fragments are removed from landing-page values; identifier-shaped path segments are redacted before persistence. Reporting snapshots expose only normalized aggregate facts. They include provider, exact property reference, measurement date, provider timezone when supplied, retrieval timestamp, freshness and partial/complete coverage status.

GA4 is independent from GSC: a GA4 failure must not erase valid Search Console data, and a GSC failure must not turn missing Analytics data into zero. Do not enable GA4 for a project until the mapped property is actually authorised to the existing Google identity and a bounded real read has succeeded.

## Ada bridge receipts (AAX-69)

`ada_bridge_consumer.py` is an explicitly enabled, bounded consumer of the existing
loopback Ada Event Bridge v1. It introduces no scheduler or execution authority.
It accepts only its configured project/site and `ms_robot` target. Unmatched
events are left untouched. Version, event family, reference, payload size/depth,
credential/privacy and optional payload digest checks precede intake. Absent
bridge correlation references (`null` or empty) are normalised to empty metadata.
Stable reference IDs are percent-encoded for transition paths.

The existing analytics SQLite migration coordinator creates the additive
`ada_bridge_receipt` table in its transaction. A receipt commits before the
bridge is marked delivered or acknowledged. Event ID and project/idempotency
uniqueness bind the complete envelope fingerprint; altered identity reuse fails
closed. Only metadata and the fingerprint are stored, never payload bodies.
Action proposals always remain `proposal_only`; acknowledging receipt grants
no permission to execute an action. Invalid in-scope events with safely
addressable reference IDs use the bridge's existing fail/dead lifecycle. Unsafe
identities are reported rejected/unconfirmed for operator reconciliation;
dead events are never automatically reactivated.

The CLI defaults to disabled and performs no I/O in that mode. An authorised
bounded run requires `--enabled --project-id <canonical-id> --site-key <site>`
(limit 1–20, default 5) and protected environment configuration:
`MSROBOT_BRIDGE_URL`, `MSROBOT_BRIDGE_TOKEN`, `ANALYTICS_GATEWAY_DB`.
The bridge URL must be HTTP loopback; redirects and environment proxies are
disabled. Do not put credentials in command arguments, transcripts or source.
No timer or production consumer is enabled by this change. Canonical project
mapping, deployment approval and backup/read-back are separate rollout gates.

Pending durable receipts are checked through authenticated, exact-scope
`GET /v1/events/<encoded-id>` before fresh intake. The returned envelope must
validate and match the stored fingerprint. A confirmed `acked` record then
updates only the local receipt and increments `reconciled`; it sends no bridge
transition. Matching queued/delivered records resume the normal lifecycle using
the existing receipt. Pending verification and fresh intake share the configured
batch limit. Other project/site receipts are never queried or confirmed.

The first uncertain ACK retains `recorded` state and exits nonzero. A subsequent
bounded run can confirm an accepted ACK whose reply was lost, including after a
process restart. Missing, changed, dead, malformed or unavailable lookup records
remain `reconciliation_required`, receive no transition and require operator
verification. Legacy bridges without exact lookup also remain unconfirmed.
Never infer success, regress an ACK with fail, edit receipt state by guesswork or
redrive a dead event. A reconciliation failure consumes a batch slot; investigate
persistently unresolved receipts before widening or scheduling intake.
Intake requires the paired Ada bridge update that filters exact project/site
before applying the limit and confirms that scope in the response. A legacy
bridge without this capability reports unavailable before any transition; no
fallback to global queue consumption is permitted. Response byte budgets cover
each permitted 64 KiB payload and bounded envelope in the configured batch.
A complete run describes its bounded batch, not a global queue drain.

`GET /v1/ada-events?site=<site>&limit=50` requires the existing internal bearer
credential and `X-Ms-Robot-Project-Id` header, and queries exact project/site
metadata only. It omits payload, fingerprint and idempotency key. The application
access check additionally restricts the panel to unrestricted project owners;
editors, viewers and clients receive no Ada event panel. The operations view
labels source as reported, shows correlation and unconfirmed acknowledgements,
and presents no execution control. The Persian and British English views use
Tehran time.

Deploy `ada_bridge_receipts.py` beside `gateway.py`, `gsc_monitor.py`,
`sqlite_migrations.py`, `provider_retry_checkpoint.py` and `monitor_dispatch.py`.
The bounded consumer must also sit beside these shared modules. Preserve the
analytics database and its recovery ownership; do not apply PostgreSQL or Ada
memory migrations to this SQLite store.

Verification uses disposable data only:

```sh
ADA_BRIDGE_TEST_SOURCE=/path/to/AdaAI/ops/ms-robot-bridge/bridge.py \
  python3 -m unittest discover -s ops/analytics-gateway -p 'test_*.py'
npm test
npm run typecheck
```

The protocol tests require `ADA_BRIDGE_TEST_SOURCE` and otherwise skip explicitly.
They start the actual bridge implementation on a disposable loopback port with
a temporary database and fixture credential; never point tests at the live queue.
