# SDD ledger — plan: docs/ms-robot/integration-plan-20260930.md

Recovery complete: live PR4 head 0b914518350ae0ff4293887aaaaaa5aea96b92fc;
PR5 63988c9; PR6 7afb88a; PR7 7589244; PR8 051cc93; PR9 bb53bde.
Independent integration checkout preserves the dirty 21 September checkout.

Pre-flight: reporting consumed fictitious app-SQL analytics tables while the
provider ledger actually lives in SQLite behind the gateway. Dashboard and
insight components were not mounted and section grants were not persisted.
Combined migration expectation omitted privacy migration 0009.

Ruling: use the scoped gateway as the reporting reader, with only supported GSC
site_daily metrics — the durable analytics source is SQLite — unsupported
providers remain explicit, and their reports are incomplete until implemented.

Ruling: clients receive no aggregate report until owner-granted sections exist;
overview derives only from granted detail — prevent overview or cached admin
payloads bypassing grants — existing clients need deliberate owner configuration.

Ruling: keyword-scoped members cannot read project aggregates — aggregate data
cannot be safely restricted to their keywords — their existing keyword views
remain available, aggregate report access requires an unrestricted membership.

Ruling: keep unmapped live rows in legacy scope and never guess project IDs — no
canonical site-to-project registry is configured — client launch waits for a
verified mapping and migration/promotion evidence.

Ruling: migrations 0010 and 0011 belong to this integration branch, not PR9's
previous isolated lane — grants and notes now need durable storage — downstream
branches must reconcile migration numbering before merging.

Ruling: allow optional persistent single-process PGLite with a stable auth secret;
production refuses volatile storage — low-cost staging needs durability — local
directories cannot be shared by multiple writer instances; scale uses PostgreSQL.

Ruling: disable free-text medical notes until retention policy is approved —
analytics observations contain aggregate provider evidence only — medical manual
notes remain unavailable, and clinical inquiry retention is not activated.

RED→GREEN: public hash privacy regression, scoped reporting/weighted GSC totals,
grant/overview/cache-date boundaries, gateway date filtering before limit, and
durable note storage including review/edit-history and stale-edit refusal.

Verification before final review: script suite 199/199 and TypeScript suite
197/197 passed before note/durability additions; Python gateway suite 18/18 passed;
typecheck and production build passed; lint zero errors, nine existing warnings.
Updated note persistence/restart test and typecheck/build pass after additions.
Final full-suite and browser/restart staging results will be recorded separately.

Fresh live provider check: GA4 account discovery HTTP200 with zero accounts;
GTM account discovery HTTP403. GSC synced seven sites on 29 September; latest
stored data date 28 September. Live database still uses legacy unscoped schema.

No launch-ready claim. No client-facing production promotion yet.

## Final independent review and fix pass

One fresh-context reviewer found no Critical findings and three Important
findings. All three were reproduced and fixed with regression checks:

1. Remove whole PII HMAC markers before phone/email matching, preventing a
   numeric substring inside a hash from leaving a client-visible suffix.
2. Partition snapshot and refresh-replay identities by current canonical site,
   exact dates and gateway availability, preventing a changed site returning
   an earlier site's cached report.
3. Establish period coverage from completed scoped sync receipts. Unproven
   coverage remains partial, with stored dates and evidence ranges shown;
   sparse rows alone never prove missing days had zero activity.

Closed Minor: client note reads apply approval, visibility and section-grant
filters before the page limit, so newer internal notes cannot hide an older
approved client note. A full visible page now sets truncated when another
matching row remains, and the report returns notesTruncated plus visibleNoteLimit
instead of silently omitting older notes. The reader still returns at most 100
visible notes.

Ruling: enable authentication in the integration build and update old template
test expectations — production must never inherit the recovery checkout's
disabled-auth flag — real owner/client signup and persistence were verified on
isolated staging; shared MaziyarID login still needs separate acceptance.

Ruling: record inferred period coverage conservatively — sync receipt ranges
prove retrieval, not rows for every date — partial totals are labelled and note
evidence uses the stored range. No provider lag is rewritten as measured zero.

Ruling: open a combined review checkpoint without production promotion — broad
continuation authorises reversible integration, but ownership/account/policy
inputs remain unresolved — original slice PRs and live services remain intact.

## Final verification

- `npm test`: 199/199 script checks and 206/206 TypeScript checks, zero failures.
- `npm run typecheck`: passed.
- `npm run lint`: zero errors, nine pre-existing warnings.
- Authentication-enabled production build: passed, including PGLite assets.
- Python gateway/migration suite: 19/19 passed.
- Staging owner/client desktop/mobile browser flow: passed, zero page errors
  and no horizontal overflow; screenshots inspected.
- Process restart: owner session, client Search grant, approved note and fixture
  metrics persisted; clients saw no owner controls or unapproved notes.
- Copied live SQLite migration: four concurrent starts, unchanged counts and
  integrity `ok`; 12,187 metrics and 81 receipts preserved under legacy scope.

Evidence screenshots contain synthetic data only, under
`docs/ms-robot/staging-evidence-20260930/`. The production database and services
were not promoted. This evidence closes the integration verification work,
not all AAX-80/81/82 acceptance criteria or the AAX-128 launch gates.

## Disposition of items the reviewer declined to judge

Remaining provider adapters, queue stages, comparison/export/retention and brand
acceptance are product launch blockers, as retained in the reporting-reader and
review-checkpoint rulings. They are not silently waived by the integration plan.
Canonical legacy ownership and provider-account authorisation remain unverified;
the legacy-scope and checkpoint rulings prohibit guessed assignment or a
connected-provider claim. Multi-process PGLite remains unsupported under the
single-writer ruling; using it across writers risks inconsistent data.

The reviewer did not independently run browser/auth/secrets/production checks.
The implementer subsequently verified real local signup and owner/client
desktop/mobile flows on the built staging app. Shared MaziyarID login and
production promotion are still open under the auth and checkpoint rulings;
conflating local staging with production acceptance could bypass identity gates.

Ruling: accept the copied SQLite migration as staging preservation evidence,
not production migration approval — four concurrent starts preserved counts,
legacy scope and integrity, while the reviewer did not independently rerun it —
if that proof is insufficient for the production environment, promotion must
wait for its own backup, migration and rollback verification to avoid data loss.
