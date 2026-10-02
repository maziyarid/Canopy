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
