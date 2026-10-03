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


## 2026-10-03 trailing-dot host conflict

`https://example.com./` and `example.com` normalise to the same host because `site_key` strips a trailing dot after the www prefix. Different project ids on those keys are `site_map_invalid` before discovery or `create_or_run_sync`. Process proof: `test_trailing_dot_host_conflicts_with_apex_before_discovery`. The www/apex proof does not cover the trailing dot. Promotion readiness fails closed if the strip or that proof is removed. Scheduled portfolio sync stays disabled. This does not merge main or deploy.


## 2026-10-03 scheme-less path conflict

`example.com/blog` and `example.com` normalise to the same host. A scheme-less key is not a second site identity: `bare_host` drops path, query, fragment, and userinfo before the www/trailing-dot normalisation. Different project ids on those keys are `site_map_invalid` before discovery or `create_or_run_sync`. Process proof: `test_scheme_less_path_conflicts_with_apex_before_discovery`. The URL-path www proof does not cover a scheme-less path. Promotion readiness fails closed if `bare_host` or that proof is removed. Scheduled portfolio sync stays disabled. This does not merge main or deploy.


## 2026-10-03 port and IDNA host conflict

`example.com:443` and `https://www.example.com/` normalise to the same host. `exämple.com` and `xn--exmple-cua.com` normalise to the same punycode host. `strip_port` drops a single numeric port, and `normalise_host` IDNA-encodes before the project conflict check. Different project ids on those keys are `site_map_invalid` before discovery or `create_or_run_sync`. Process proof: `test_port_and_idna_conflict_with_apex_before_discovery`. Promotion readiness fails closed if `strip_port`, the IDNA encode, or that proof is removed. Scheduled portfolio sync stays disabled. This does not merge main or deploy.


## 2026-10-03 IPv6 bracket port conflict

`[2001:db8::1]:443` and `https://[2001:db8::1]/` normalise to the same host. `strip_port` keeps the address inside brackets and drops the mapped port, so a bracketed IPv6 literal is not a second site identity. Different project ids on those keys are `site_map_invalid` before discovery or `create_or_run_sync`. Process proof: `test_ipv6_bracket_port_conflicts_with_url_host_before_discovery`. The numeric `host:port` proof does not cover bracketed IPv6. Promotion readiness fails closed if the bracket handling or that proof is removed. Scheduled portfolio sync stays disabled. This does not merge main or deploy.


## 2026-10-03 percent-encoded host conflict

`https://ex%61mple.com` and `example.com` normalise to the same host. `decode_host` applies one percent-decode before the port, www, trailing-dot, and IDNA conflict check. A leftover `%` fails closed without echoing the raw key. Different project ids on those keys are `site_map_invalid` before discovery or `create_or_run_sync`. Process proof: `test_percent_encoded_host_conflicts_with_apex_before_discovery`. The IDNA proof does not cover a percent-encoded label. Promotion readiness fails closed if `decode_host` or that proof is removed. Scheduled portfolio sync stays disabled. This does not merge main or deploy.
- 2026-10-03: decoded scheme/path residue fails closed before discovery; Unicode and punycode forms of the same host conflict. Scheduled portfolio sync stays disabled.


## 2026-10-03 empty host label

`.example.com` and `example..com` are not site identities. `assert_hostname` rejects a leading dot and an empty label before discovery or `create_or_run_sync`, and does not echo the raw key. Process proof: `test_empty_label_hosts_exit_before_discovery`. Promotion readiness fails closed if that rejection or proof is removed. Scheduled portfolio sync stays disabled. This does not merge main or deploy.


## 2026-10-03 control-character host

`example.com` plus a NUL, other ASCII controls, DEL, or a mapped Unicode space is not a site identity. `assert_hostname` rejects controls before discovery, and the IDNA result is checked again so a non-breaking space cannot become a trailing ASCII space. The raw key is not echoed. Process proof: `test_control_and_nbsp_hosts_exit_before_discovery`. Promotion readiness fails closed if that rejection or proof is removed. Scheduled portfolio sync stays disabled. This does not merge main or deploy.
