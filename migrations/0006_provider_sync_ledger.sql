-- Ms Robot provider sync receipt expansion. Additive only.
alter table provider_sync_runs add column if not exists requested_start timestamptz;
alter table provider_sync_runs add column if not exists requested_end timestamptz;
alter table provider_sync_runs add column if not exists cursor_before text not null default '';
alter table provider_sync_runs add column if not exists cursor_after text not null default '';
alter table provider_sync_runs add column if not exists rows_received integer not null default 0;
alter table provider_sync_runs add column if not exists rows_inserted integer not null default 0;
alter table provider_sync_runs add column if not exists rows_updated integer not null default 0;
alter table provider_sync_runs add column if not exists rows_skipped integer not null default 0;
alter table provider_sync_runs add column if not exists rate_limit_state text not null default '';
alter table provider_sync_runs add column if not exists error_message_safe text;
alter table provider_sync_runs add column if not exists data_freshness timestamptz;
alter table provider_sync_runs add column if not exists code_version text not null default '';

alter table provider_sync_runs add column if not exists quota_state text not null default '';
create index if not exists provider_sync_runs_project_started_idx
  on provider_sync_runs(project_id, started_at desc);
