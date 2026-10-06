# GA4 provenance reconciliation note

Status: source contract only. Not a runtime migration, deploy, or merge.

## Why this exists

PR #28 (`f28a7b07712bc3f85fb417447ce8030044b30aa5`) preserves GA4 completed-day windows, unique-user values, historical provenance, and collision omission. It is stacked on PR #20.

PR #21 (`1d987b81ae70fdcb387810e60c5ab7abf69742dd`) and PR #23 (`916ba0b3f44bb0603202ae5d8286d57a04dd6e0a`) are newer descendants. They do not contain those repairs. Copying PR #28's provider or gateway file over this stack would drop:

- PR #21 bounded GSC filter validation and the loopback MCP adapter;
- PR #23 delegated OAuth profiles, capability grants, and governed write host allowlist.

This branch records the reconciliation contract beside that stack. It does not modify `ops/google-provider` or `ops/analytics-gateway/gateway.py`.

## Rules that must survive the later hunk merge

1. Default sync and report windows close on the previous UTC calendar date. An explicit `endDate` stays inclusive and is not shifted.
2. Period unique users come only from an exact-window provider summary. Daily unique users are never summed into a period total.
3. Every row in a sanitized landing-page collision group is omitted. Unique users are never added across colliding rows.
4. Property, timezone, retrieval time, and quality stay on each measurement. Legacy rows with empty provenance stay unknown. They must not borrow the latest mutable site snapshot.
5. Mixed known property identities fail closed. A response-level source is only a compatibility summary of one consistent identity.
6. A successful scoped resync may replace its own slice only after the provider response succeeds. Upstream failure preserves prior rows.
7. The additive `provider_metric.source_metadata` migration stays source-only until backup and rollout review. No PostgreSQL `0006`/`0007`/`0008` change belongs in this reconciliation.
8. Reporting remains disabled until its separate authentication, binding, rate-limit, and activation gates. Delegated write profiles stay fail-closed without a provisioned OAuth web client.

## Verification boundary

`ops/analytics-gateway/test_ga4_provenance_contract.py` proves the pure rules above. It does not claim a live GA4 read, a production migration, or that PR #28 has been merged into this stack.
