# Promotion readiness — 1 October 2026

`ops/ms-robot/promotion_readiness.py` inspects the integration tree and always reports `not_promotable` while human launch gates remain open.

It fails closed if migrations 0006-0011 are missing or duplicated, if medical manual-note refusals are removed, or if scheduled portfolio ingestion no longer requires `MS_ROBOT_PROJECT_SITE_MAP_JSON` and authorised-property refusal.

Running the check does not merge, deploy, enable scheduled sync, or assign legacy rows. Production stays on its current release.

`ops/ms-robot/provider_retry_checkpoint.py` bounds provider retries and fails closed on missing site maps, unauthorised properties, and unconfigured adapters. It does not enable scheduled portfolio sync.

Sync failure paths on this branch attach that checkpoint: `create_or_run_sync` returns `retry_checkpoint`, and a missing site map or unauthorised GSC property stays `failed_closed` (not requeued).

The portfolio CLI prints that same `retryCheckpoint` with `retryable=false` when `MS_ROBOT_PROJECT_SITE_MAP_JSON` is absent, then exits 1 before discovery or `create_or_run_sync`.
