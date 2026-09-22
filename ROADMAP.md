# ADA + Ms Robot + Maz Robot Roadmap

Last updated: 2026-09-21

## Product boundaries

- **ADA** owns orchestration, context, agent routing, approvals and resilience.
- **Ms Robot** owns operations intelligence, analytics/provider evidence, inquiry workflows and dashboards.
- **Maz Robot** owns multi-tenant social connections, scheduling, publication jobs, provider receipts and social metrics.
- **Qalam** owns writing-policy/profile resolution and writing QA; publication remains a Maz Robot/provider action.
- Legacy **Canopy** identifiers may remain where renaming creates migration risk; user-facing product name is **Ms Robot**.

## Authority model

1. Runtime/DB/queues: execution truth.
2. Git: code truth.
3. Agiflow: programme/task/blocker truth.
4. Provider APIs: external evidence with explicit freshness.
5. Chat/ADA: bounded reasoning/operator surface, never an implicit source of truth.

## Current source baseline

- Repository: `maziyarid/Canopy`
- Recovery worktree: `/srv/canopy-handoff/ms-robot-unified-20260921`
- Implementation branch: `feat/ms-robot-unified-20260921`
- Recovery base: `5931c7f`
- Repair commit: `01dd863`
- Analytics contracts cherry-pick: `720e46b`
- Analytics gateway client cherry-pick: `a422eb5`
## Phase status

### P0 — Source recovery and build integrity — AAX-42
**Status: implementation branch clean; promotion pending.**

Completed:
- reproduced 101 TypeScript errors across 12 files;
- separated unreachable legacy-demo modules from production typecheck without deleting history;
- repaired active auth/middleware/server-function merge boundaries;
- restored server-side Mangools helper and Qalam-labelled draft brief path;
- made generic PWA tests hermetic to product-specific `site.json`;
- updated migration-plan tests for a real application with ordered app migrations;
- reconciled isolated analytics contracts/client commits.

Verified gates:
- `npm run typecheck`: PASS;
- `npm test`: PASS;
- `npm run lint`: PASS with warnings only.

Completed additional gates:
- non-migrating production Vite/Nitro build: PASS;
- fixed missing PGlite serverless assets by packaging pglite.data, pglite.wasm and initdb.wasm;
- browser smoke: HTTP 200 desktop/mobile, no console/page errors, no horizontal overflow;
- active UI metadata/app name now uses Ms Robot while legacy repository/database identifiers remain intact.

Remaining:
- push branch, review diff, then promote through normal Git workflow;
- process the supplied Ms Robot brand kit when its raw archive is accessible; do not invent replacement identity assets.

### P1 — Analytics/provider gateway — AAX-50, AAX-64, AAX-66, AAX-67, AAX-68
**Status: GSC live read-only path verified; provider runtime/admin control plane implemented; GA4/GTM/Clarity/Bing/SEO-provider credentials or adapters remain pending.**
Completed baseline:
- `ms-robot-analytics.service` deployed on `127.0.0.1:9130`;
- `ms-robot-google-provider.service` deployed on `127.0.0.1:9131`, reusing the existing VPS service account with the Search Console read-only scope;
- live connection test enumerates 7 authorised Search Console properties without exposing credentials;
- real `teznevise.ir` 27-day GSC sync completed with 409 durable metric rows (27 site/day + 382 query/page), and the Ms Robot snapshot reports GSC health `ok`;
- Google discovery tests now distinguish provider blockers: GA4 has no authorised accounts/properties for the current service account; GTM API is disabled in the existing Google Cloud project, so both remain explicitly `not_configured`;
- bearer-authenticated `/v1/*` provider API with public minimal `/health`;
- durable SQLite provider state + sync ledger at `/var/lib/ms-robot-analytics/state.sqlite3`;
- providers default to explicit `not_configured`; refresh attempts are recorded as `blocked/not_configured` until real credentials exist;
- service restart persistence verified; hardened systemd security exposure score 2.8/OK;
- gateway unit tests PASS (auth + blocked-not-stuck behaviour + full registry refresh contract);
- typed Provider Admin server surface + workspace Providers UI implemented without exposing credentials;
- provider registry and sync ledger are visible per project/site;
- provider states remain explicit: GSC is live/verified; GA4/GTM/Clarity/Bing/Semrush/Ubersuggest/Mangools remain `not_configured` or adapter-gated until verified;
- live runtime verified that GTM, Bing Webmaster and Semrush refresh requests persist as `blocked/not_configured` with the requested `28d` window rather than pretending success.
- GSC trigger-to-investigation monitor is live with stable fingerprints/deduplication; current runtime detected an open Teznevise traffic-surge investigation and Bluethesis sitemap-warning investigation from fresh GSC evidence.
- daily portfolio GSC sync→monitor execution is enabled through `ms-robot-gsc-monitor.timer`; the oneshot runs without ChatGPT/MCP, is persistent across downtime, and is sandboxed at systemd exposure 2.8/OK;
- the scheduled monitor now emits evidence-backed `ms_robot.analytics.signal` events into the local ADA bridge; stable evidence-derived idempotency suppresses duplicate queue entries while changed/resolved evidence can produce new events;

Next:
- Google: grant the existing service account read access to required GA4 properties; enable the Tag Manager API in the existing project and grant least-privilege container access; keep GSC on the verified service-account path;
- Bing Webmaster adapter;
- Clarity and approved SEO-provider adapters;
- explicit freshness, quota/cost, retry/backoff and circuit-breaker state;
- Search Console monitor + scheduled execution + ADA bridge handoff are implemented/live; current runtime investigations are mirrored to Agiflow follow-up tasks TNS-41 and TNS-42. Next expand indexing/crawl/security signal coverage and add the bounded ADA consumer that acknowledges/routes bridge events into Agiflow. No automatic production mutation.

### P2 — ADA operations console / event router — AAX-44, AAX-45, AAX-49, AAX-52
**Status: bridge exists; UI/workflows pending.**

Existing:
- `ms-robot-bridge.service` on `127.0.0.1:9110`;
- durable event state and bearer-authenticated boundary.

Next:
- event router/agent registry;
- inquiry intake + deterministic routing;
- lead lifecycle/attribution;
- approval queue, incidents, retries, receipts and Agiflow summaries in Ms Robot.

### P3 — Maz Robot core — AAX-70, AAX-71
**Status: shared schema + capability registry + encrypted-vault crypto + publication state machine implemented; durable DB worker/UI pending.**

Implemented baseline:
- migration `0004_unified_stack.sql` reuses existing `projects` as workspace/site identity and backfills per-owner tenants;
- provider connections + provider sync ledger;
- social connections, schedules, Qalam-linked content items, publication jobs/results and social metrics;
- workspace entitlements and operation receipts;
- platform capability registry with explicit provider gates;
- permanent PGLite migration regression test and social capability tests.

Implemented runtime-safety baseline:
- `0005_social_runtime.sql` adds scoped encrypted credential storage plus publication lease/max-attempt/dead-letter fields;
- AES-256-GCM credential primitive uses scoped associated data and fails closed on wrong key/scope;
- database vault store enforces project scope, persists ciphertext only, emits secret-free operation receipts and supports key-version rotation;
- publication state machine enforces platform capability gates, stable per-platform idempotency, bounded retry/backoff and dead-letter semantics;
- regression test proves a successful platform is not republished when a sibling platform fails and retries.
- database-backed publication store now atomically leases one due job with FOR UPDATE SKIP LOCKED, persists provider success receipts, suppresses duplicate publish after prior success, releases retry leases with not_before, and records terminal dead-letter state;
- publication worker binds the DB store + project-scoped vault resolver + Telegram adapter, validates migration/vault prerequisites, and has no PGLite fallback;

Remaining:
- encrypted vault DB CRUD/key rotation/access receipts implemented; remaining secret lifecycle work is operator key provisioning/rotation runbook + production key custody;
- publication worker code + hardened systemd unit implemented and installed fail-closed; production activation remains blocked on durable DATABASE_URL + vault key provisioning;
- tenant-isolation/RBAC integration tests against real sessions;
- admin/client UI.
### P4 — Social adapters — AAX-72..AAX-78
**Status: Telegram Bot API adapter implemented/tested; live credentials and other provider gates pending.**

Order:
1. Telegram Bot API V1 — adapter implemented (`bcf6ffb`); live bot/channel verification pending.
2. Pinterest Trial → Standard.
3. Meta adapter with review/verification gates.
4. LinkedIn eligibility + skeleton.
5. X adapter behind payment/cost gate.
6. Reddit skeleton behind commercial-contract gate.
7. YouTube/TikTok conditional adapters behind audit/approval gates.

No adapter is reported as production-available before its real provider eligibility is verified.

### P5 — Cross-product analytics/Qalam loop — AAX-79
**Status: planned.**

Maz Robot publication receipts and provider metrics feed Ms Robot; ADA can query normalized evidence; Qalam profile changes remain proposed/reviewed rather than automatically globalised.

## Production completion gates

A phase is not “done” until applicable gates pass:
- typecheck, tests and lint;
- migration dry-run/plan review;
- tenant-isolation and RBAC tests;
- restart/reboot persistence where relevant;
- retry/idempotency/dead-letter verification;
- secret redaction and least-privilege review;
- browser/mobile/RTL/accessibility smoke tests;
- live provider read-back where credentials/eligibility exist;
- Git commit/branch/PR or explicit promotion record;
- Agiflow task evidence and remaining blockers updated.

## Progress log
| Date | Commit / evidence | Change |
| --- | --- | --- |
| 2026-09-21 | `5931c7f` | Advanced legacy merge recovered as starting point; known broken with 101 TS errors. |
| 2026-09-21 | `01dd863` | Reconciled active merge boundaries, auth middleware, helper exports, Qalam draft brief path and hermetic tests. |
| 2026-09-21 | `720e46b` | Added shared analytics contracts. |
| 2026-09-21 | `a422eb5` | Added server-only analytics gateway client. |
| 2026-09-21 | verification | Typecheck PASS; tests PASS; lint exits 0 with warnings only. |
| 2026-09-21 | `244d54e` + `da98651` | Deployed local Ms Robot analytics gateway baseline; removed accidental Python bytecode artefacts and added prevention ignore rule. |
| 2026-09-21 | `23fe903` | Added shared tenant/provider/social schema, SaaS entitlements, capability registry and permanent migration/capability regression tests. |
| 2026-09-21 | `bcf6ffb` | Added server-only Telegram Bot API publication adapter with media/button payloads, provider receipt IDs and rate-limit metadata tests. |
| 2026-09-21 | `986f413` | Repaired the unified migration regression test lint gate; migration test remains green. |
| 2026-09-21 | `b70bcea` | Added project-scoped Provider Admin UI/server surface and expanded gateway registry/sync-ledger contract. |
| 2026-09-21 | `0988e64` | Hardened `ms-robot-analytics.service`; restart persistence verified and systemd exposure reduced from 7.8 EXPOSED to 2.8 OK. |
| 2026-09-21 | runtime verification | Vite/Nitro build PASS; PGlite assets packaged; desktop/mobile browser smoke PASS with HTTP 200 and no runtime console/page errors. |
| 2026-09-21 | branding checkpoint | Active app title/metadata switched from Canopy to Ms Robot; legacy technical identifiers preserved. |

| 2026-09-21 | live GSC verification | Deployed/wired the local read-only Google provider; 7 authorised properties discovered; `teznevise.ir` sync completed with 409 stored rows and GSC snapshot health `ok`. |

| 2026-09-21 | Google discovery checkpoint | Provider connection tests added for GA4/GTM: GA4 currently has no authorised accounts; GTM is blocked by the API being disabled in the existing project. |

| 2026-09-21 | `54ee810` + live verification | Added durable GSC investigation monitor, dedupe/resolution logic and API endpoints; live runtime byte-matches branch and returned two current evidence-backed investigations. |

| 2026-09-21 | scheduled GSC monitor | Enabled persistent daily `ms-robot-gsc-monitor.timer`; live oneshot exit 0; all 7 GSC properties refreshed/checked; runtime investigations mirrored to TNS-41 and TNS-42; systemd exposure 2.8/OK. |

| 2026-09-21 | ADA bridge monitor handoff | Daily GSC job now queues `ms_robot.analytics.signal` events to ADA with evidence-hash idempotency; repeated live run returned duplicate=true and bridge queue count remained 2. |
| 2026-09-21 | `cfd33d2` | Added persistent Ms Robot analytics -> ADA control-core event projection; live two-event handoff/ack verified and timer activated. |

| 2026-09-21 | Maz Robot runtime-safety tests | Added encrypted credential-vault primitive and publication retry/idempotency engine; dedicated tests PASS (5/5), full application test suite PASS (196 script/core + 44 app/auth/social tests), typecheck PASS and lint 0 errors. |

| 2026-09-21 | DB publication-store integration | Added atomic Postgres/PGLite claim/lease + context + success/retry/dead transitions; DB integration tests 2/2 PASS, complete test suite PASS (196 script/core + 46 app/auth/social), typecheck PASS, lint 0 errors. |

| 2026-09-21 | Vault DB integration | Added project-scoped encrypted credential store/read/rotate with access receipts; cross-project read and wrong-scope/key fail closed; vault integration tests 2/2 PASS, full suite PASS (196 script/core + 48 app/auth/social), typecheck PASS, lint 0 errors. |

| 2026-09-21 | Maz Robot worker checkpoint | Worker unit installed but intentionally disabled/inactive: missing `/etc/maz-robot-worker.env` causes systemd condition skip; direct preflight without config exits 78 with `DATABASE_URL is required`; unit branch/runtime hashes match and exposure is 4.6/OK. Full suite PASS (196 script/core + 50 app/auth/social/worker), typecheck PASS, lint 0 errors. |

## Tracking rule

Every material implementation checkpoint must be recorded in both:
1. this roadmap/progress log; and
2. the relevant Agiflow AAX task comment/status.

Do not mark roadmap phases or Agiflow tasks complete from code changes alone; attach verification evidence and record any external provider blocker explicitly.
| 2026-09-21 | ADA analytics event projector | Added and deployed ada_event_projector.py plus persistent ms-robot-analytics-event-router.timer; two queued analytics events were projected into control-core/Agiflow and acknowledged, a repeat run produced queued=0, and the hardened service is branch/runtime byte-identical. |
