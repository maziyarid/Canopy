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

## Bounded GSC retrieval

GSC sync fetches `site_daily` and `query_page_daily` in 5,000-row pages using
`startRow`. A short or empty page ends each dataset. Each dataset permits at
most 20 full pages (100,000 rows), followed by one empty termination probe.
A non-empty probe fails with `gsc_pagination_limit_exceeded`; malformed or
oversized pages fail with `gsc_invalid_page`; repeated/overlapping dimension
identities fail with `gsc_pagination_no_progress`. These fixed codes contain no
provider query/page content.

All pages and the sitemap response are fetched before the metric/snapshot
transaction. A later-page error does not write partial data, advance freshness
or add completed coverage; the existing sync receipt records failure and prior
successful evidence remains available. Replays retain the existing project-scoped
idempotency semantics. Refresh remains synchronous, so a large refresh may
outlast an application request timeout; inspect its scoped sync ledger before
requesting another refresh. This change does not add an automatic retry worker.

Completed receipts store versioned JSON cursor offsets, for example:
`cursor_before={"version":1,"site_daily":0,"query_page_daily":0}` and
`cursor_after={"version":1,"site_daily":7,"query_page_daily":5001}`.
Offsets count provider row positions, including rows later skipped by metric
validation. They describe a completed retrieval, not a resumable partial commit.
Google's own top-row and privacy limits still apply; page exhaustion does not
establish complete raw search traffic. Dashboard search tables retain their
separate bounded/sampled reads.

The gateway and Google adapter must both support offsets. A later release must
keep `ops/google-provider/search-analytics.mjs` beside `provider.mjs`; the adapter
forwards the validated offset to Google. No service is activated by this PR.

Hermetic pagination checks (no credentials or external bridge source):

```sh
node --test scripts/google-provider-pagination.test.mjs
python3 -m unittest discover -s ops/analytics-gateway -p 'test_gsc_pagination.py' -v
```


## Project isolation

All authenticated data-plane requests must include the internal `X-Ms-Robot-Project-Id` header in addition to the bearer token. The application server supplies this header only after its own project-access check; browser clients do not call the gateway directly.

Provider state, sync receipts, normalized metrics, snapshots, and GSC investigations are keyed and queried by project. Existing pre-scope SQLite rows are preserved under the reserved `legacy` project during the additive gateway migration and are never silently assigned to a real tenant.

Sync idempotency is enforced atomically with `unique(project_id, idempotency_key)`; concurrent retries for one logical project operation return the existing receipt rather than creating a second provider operation or reporting the uniqueness race as a provider failure.


### Scheduled portfolio sync

`portfolio_gsc.py` does not infer tenant ownership from a domain. Before enabling the portfolio timer, configure `MS_ROBOT_PROJECT_SITE_MAP_JSON` in the server-side analytics environment as a JSON object mapping each normalized site/domain to its canonical Ms Robot project ID. Example shape only: `{"example.com":"project-id"}`.

The job fails closed if that mapping is absent, malformed, or references a GSC property the connected Google account cannot read. Unmapped authorised GSC properties are not imported automatically. Monitor signals carry `projectId` through the ADA bridge so downstream evidence remains tenant-scoped.

The standalone `monitor_dispatch.py` path likewise requires `MS_ROBOT_MONITOR_PROJECT_ID`; it must not run as a portfolio-wide unscoped monitor.

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
