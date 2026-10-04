# Ms Robot integration checkpoint — 30 September 2026

This branch combines reviewed PRs 4–9 and connects authenticated reports, saved
section grants, and reviewed evidence notes. It is a staging checkpoint. The
nine-stage product specification and production acceptance remain open.

## Runtime configuration

Build with `VITE_AUTH_ENABLED=true`; the checked-in application setting is now
true. Run with `NODE_ENV=production` and a stable private `BETTER_AUTH_SECRET`
of at least 32 characters. Choose either an external PostgreSQL `DATABASE_URL`
or an absolute `PGLITE_DATA_DIR` on a durable, private volume. Production rejects
an in-memory database. PGLite permits one writer process per directory; use
PostgreSQL for multiple application instances. Back up the application database
and analytics database independently.

Set server-only `ANALYTICS_GATEWAY_URL` and `ANALYTICS_GATEWAY_TOKEN`; do not expose
them through `VITE_` variables. The app sends project scope after authenticating
the user and resolving membership. Optionally set a private
`PII_REDACTION_KEY` of at least 32 characters for server-only HMAC correlation.
Without it, PII is replaced by a plain redaction marker. Client errors always
remove the entire private correlation marker.

Application migrations run through 0011. Migration 0010 persists client report
sections, with existing clients defaulting to no sections. Migration 0011 stores
notes independently of measured metrics, with revision and review history.
Local PGLite migrates during initialization; external PostgreSQL uses
`npm run db:migrate`. Preserve database backups before applying migrations.

## Verified isolated staging

The built app and gateway were bound only to loopback ports 8816 and 8815.
Private runtime configuration, synthetic account credentials, and browser
sessions remain outside the repository. The active analytics database contains
only two explicitly labelled fixture measurements for example.com.

`scripts/ms-robot-staging-smoke.mjs` refuses a non-loopback origin and requires
`MS_ROBOT_SMOKE_FIXTURE=isolated-test-data` plus an absolute private
`MS_ROBOT_SMOKE_FIXTURE_DIR`. Supply `MS_ROBOT_CHROMIUM_PATH` for the installed
browser. Its `prepare` phase signs up synthetic owner and client accounts and
creates a project. Seed only that isolated project's analytics fixture before
the `owner` phase. The `owner` phase creates and approves a note and grants only
Search access. Restart both staging processes, then run the `verify` phase.
Never use this harness against customer data or a public deployment.

Verification covered owner/client sessions, Search totals (63 clicks, 630
impressions, 10% CTR, impression-weighted position 6), partial period coverage,
approved-note visibility, draft-note hiding, owner controls hidden from clients,
anonymous report access refused, and desktop/mobile rendering. Grants, notes,
and owner sessions survived a process restart. Screenshots were inspected.

A separate read-only backup of the live analytics database was migrated with
four concurrent coordinator starts. Counts remained unchanged: eight provider
states, 12,187 metrics, 14 snapshots, 81 sync receipts. Integrity was `ok`; all
old rows remained under reserved `legacy` scope. This is migration evidence,
not a production migration or a verified assignment to client projects.

## Before production acceptance

- Verify canonical site-to-project ownership for the seven live GSC sites.
  Configure `MS_ROBOT_PROJECT_SITE_MAP_JSON` and reconcile legacy data using an
  approved mapping before enabling the scoped scheduled portfolio job.
- Connect an authorised GA4 property and GTM account. Discovery returned zero
  GA4 accounts and HTTP403 for GTM. Other provider adapters need implementation
  and independent live read-back, not fabricated successful status.
- Complete the durable provider queue/retry/checkpoint stages, comparison and
  table reports, export/deletion/retention flows, approved brand assets and ADA
  state UI, and shared MaziyarID authentication acceptance.
- Resolve the medical retention policy before enabling manual medical notes.
  Free-text medical note writes remain disabled.
- Review this combined branch and prove the intended production deployment,
  monitoring, backups, rollback, and client role acceptance before promotion.

Keep production on its current release until those gates are met. Staging can
be rolled back by stopping only its recorded process groups and switching the
isolated checkout; its application/analytics databases and private auth secret
must be preserved. Do not remove or reassign the live legacy database to roll
back staging. The existing September 21 checkout was preserved.
