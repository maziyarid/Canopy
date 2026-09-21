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
**Status: local provider runtime baseline deployed; live provider adapters/credentials pending.**
Completed baseline:
- `ms-robot-analytics.service` deployed on `127.0.0.1:9130`;
- bearer-authenticated `/v1/*` provider API with public minimal `/health`;
- durable SQLite provider state + sync ledger at `/var/lib/ms-robot-analytics/state.sqlite3`;
- providers default to explicit `not_configured`; refresh attempts are recorded as `blocked/not_configured` until real credentials exist;
- service restart persistence verified; systemd security exposure score 3.4/OK;
- gateway unit tests PASS (auth + blocked-not-stuck behaviour).

Next:
- connect the already-merged Ms Robot gateway client to the local runtime;
- add provider registry, health, capability and sync-ledger persistence;
- Google: GSC + GA4 + GTM read-only by default;
- Bing Webmaster adapter;
- Clarity and approved SEO-provider adapters;
- explicit freshness, quota/cost, retry/backoff and circuit-breaker state;
- Search Console trigger-to-investigation workflow; no automatic production mutation.

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
**Status: planned.**

Implement shared Tenant → Workspace/Site → SocialConnection → Schedule → ContentItem → PublicationJob → PublicationResult model, shared credential references, RBAC, idempotency, retry, audit receipts, quotas and entitlement boundaries.
### P4 — Social adapters — AAX-72..AAX-78
**Status: planned / provider-gated.**

Order:
1. Telegram Bot API V1.
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
| 2026-09-21 | runtime verification | Vite/Nitro build PASS; PGlite assets packaged; desktop/mobile browser smoke PASS with HTTP 200 and no runtime console/page errors. |
| 2026-09-21 | branding checkpoint | Active app title/metadata switched from Canopy to Ms Robot; legacy technical identifiers preserved. |

## Tracking rule

Every material implementation checkpoint must be recorded in both:
1. this roadmap/progress log; and
2. the relevant Agiflow AAX task comment/status.

Do not mark roadmap phases or Agiflow tasks complete from code changes alone; attach verification evidence and record any external provider blocker explicitly.