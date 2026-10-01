# Promotion readiness — 1 October 2026

`ops/ms-robot/promotion_readiness.py` inspects the integration tree and always reports `not_promotable` while human launch gates remain open.

It fails closed if migrations 0006-0011 are missing or duplicated, if medical manual-note refusals are removed, or if scheduled portfolio ingestion no longer requires `MS_ROBOT_PROJECT_SITE_MAP_JSON` and authorised-property refusal.

Running the check does not merge, deploy, enable scheduled sync, or assign legacy rows. Production stays on its current release.
