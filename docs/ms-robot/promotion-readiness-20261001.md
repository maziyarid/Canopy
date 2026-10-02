# Promotion readiness — 1 October 2026

`ops/ms-robot/promotion_readiness.py` inspects the integration tree and always reports `not_promotable` while human launch gates remain open.

It fails closed if migrations 0006-0011 are missing or duplicated, if medical manual-note refusals are removed, or if scheduled portfolio ingestion no longer requires `MS_ROBOT_PROJECT_SITE_MAP_JSON` and authorised-property refusal.

Running the check does not merge, deploy, enable scheduled sync, or assign legacy rows. Production stays on its current release.

`ops/ms-robot/provider_retry_checkpoint.py` bounds provider retries and fails closed on missing site maps, unauthorised properties, and unconfigured adapters. It does not enable scheduled portfolio sync.

Sync failure paths on this branch attach that checkpoint: `create_or_run_sync` returns `retry_checkpoint`, and a missing site map or unauthorised GSC property stays `failed_closed` (not requeued).

The portfolio CLI prints that same `retryCheckpoint` with `retryable=false` when `MS_ROBOT_PROJECT_SITE_MAP_JSON` is absent, then exits 1 before discovery or `create_or_run_sync`.

An invalid, empty, or ambiguous `MS_ROBOT_PROJECT_SITE_MAP_JSON` prints `retryCheckpoint.retryable=false` with `errorClass=site_map_invalid` and exits 1 before discovery or `create_or_run_sync`. Process proof covers malformed JSON, two keys that normalise to one site with different project ids (`https://example.com/` and `sc-domain:example.com`), a project id outside `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`, and a blank site key.

A non-string project id (number, boolean, array, or object) is rejected as `site_map_invalid` before discovery or `create_or_run_sync`. String project ids are unchanged.

A project id of `legacy` (any case) is rejected as `site_map_invalid` before discovery or `create_or_run_sync`. That name is reserved for the SQLite migration scope and must not become a scheduled tenant.

An unauthorised mapped property stays `gsc_property_not_authorised` / `failed_closed` / `retryable=false` / attempt 1. A second portfolio process against the same database still exits 1 and does not call `create_or_run_sync`. Discovery may run again; that is not a retry of the refusal. Scheduled portfolio sync stays disabled.

Client note reads filter visibility, review state and section grants in SQL before the page limit. An older approved note is not hidden by newer internal notes. The reader still returns at most 100 visible notes. The snapshot passes `notesTruncated` into the journal mount, which already has a `warnings` array and sets the omission warning. `ClientReportView` only has per-section `warning`, so no journal warnings array was added. If that slot appears later, promotion readiness fails closed unless it copies the same omission warning.

## 2026-10-02 whitespace project id

A mapped project id that is only whitespace is stripped and then rejected by the existing site-map pattern before GSC discovery. Process proof: `test_whitespace_only_project_id_exits_1_without_discovery`. Promotion readiness fails closed if that proof or the strip-before-pattern order is removed. Scheduled portfolio sync stays disabled.

## 2026-10-02 www and apex conflict

`https://www.example.com/path` and `example.com` normalise to the same host. Different project ids on those keys are `site_map_invalid` before discovery or `create_or_run_sync`. Process proof: `test_www_and_apex_project_conflict_exits_1_without_discovery`. The existing `sc-domain` conflict proof does not cover the `www` prefix. Promotion readiness fails closed if the prefix strip or that proof is removed. Scheduled portfolio sync stays disabled.

## Upstream tree reconciliation (2026-10-02)

Promotion readiness now fails closed if the integration tree drops the PR #4 SQLite coordinator (`0b914518350ae0ff4293887aaaaaa5aea96b92fc`) or the PR #5 worker-bound ClickUp claim (`63988c96676e6a5be675b13dec5e94c2e7f06548`). This check does not merge those branches and does not authorise promotion.


## 2026-10-02 migration number identity

Promotion readiness now fails closed if PR #4 `0006`/`0007` lose `quota_state` / `provider_sync_runs_idem`, or if PR #5 `0008` `seo_data_cache_identity_idx` is copied onto those numbers. The files stay `0006`, `0007`, and `0008`. This does not merge main and does not renumber PostgreSQL migrations.


## 2026-10-03 SQLite coordinator does not apply PostgreSQL 0008

The analytics SQLite coordinator does not read `migrations/*.sql`. After `ensure_analytics_schema`, the runtime database has no `seo_data_cache` table and no `seo_data_cache_identity_idx`. Promotion readiness fails closed if `sqlite_migrations.py` starts referencing `seo_data_cache` or if `test_sqlite_coordinator_does_not_apply_postgres_0008` is removed. PostgreSQL 0006/0007 stay on PR #4 and 0008 stays on PR #5. This does not merge main, deploy, or enable scheduled portfolio sync.
