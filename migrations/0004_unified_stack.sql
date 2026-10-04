-- ADA + Ms Robot + Maz Robot shared data primitives.
-- Legacy Canopy project IDs remain the workspace/site identifiers.

create table if not exists tenants (
  id text primary key,
  owner_id text not null,
  name text not null default 'Personal workspace',
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create unique index if not exists tenants_owner_idx on tenants (owner_id);

insert into tenants (id, owner_id, name)
select 'user:' || owner_id, owner_id, 'Personal workspace'
from projects group by owner_id
on conflict (id) do nothing;

alter table projects add column if not exists tenant_id text not null default '';
update projects set tenant_id = 'user:' || owner_id where tenant_id = '';
create index if not exists projects_tenant_idx on projects (tenant_id);

create table if not exists tenant_members (
  id text primary key, tenant_id text not null, user_id text not null,
  role text not null default 'member', created_at timestamptz not null default now()
);
create unique index if not exists tenant_members_unique on tenant_members (tenant_id, user_id);

create table if not exists provider_connections (
  id text primary key, project_id text not null, provider text not null,
  account_ref text not null default '', credential_ref text not null default '',
  auth_type text not null default '', permission_tier text not null default 'read',
  scopes text not null default '[]', status text not null default 'not_configured',
  last_success timestamptz, last_attempt timestamptz, next_sync timestamptz,
  freshness timestamptz, last_error text not null default '',
  enabled boolean not null default true, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists provider_connections_unique on provider_connections(project_id, provider, account_ref);
create index if not exists provider_connections_project_idx on provider_connections(project_id);

create table if not exists provider_sync_runs (
  id text primary key, project_id text not null, provider text not null,
  requested_window text not null default '', cursor_ref text not null default '',
  rows_written integer not null default 0, status text not null, retry_count integer not null default 0,
  quota_state text not null default '', error_class text not null default '',
  freshness timestamptz, idempotency_key text not null,
  started_at timestamptz not null default now(), finished_at timestamptz
);
create unique index if not exists provider_sync_runs_idem on provider_sync_runs(idempotency_key);
create index if not exists provider_sync_runs_project_idx on provider_sync_runs(project_id, provider, started_at);

create table if not exists platform_capability_registry (
  platform text primary key, capability_state text not null,
  publishing_capability text not null default '[]', auth_method text not null default '',
  required_account_type text not null default '', review_requirements text not null default '',
  billing_model text not null default '', commercial_saas_state text not null default '',
  policy_evidence_state text not null default 'unverified', docs_ref text not null default '',
  last_policy_review timestamptz, updated_at timestamptz not null default now()
);

create table if not exists social_connections (
  id text primary key, project_id text not null, platform text not null,
  account_ref text not null, display_name text not null default '', credential_ref text not null default '',
  capability_state text not null, status text not null default 'disconnected',
  scopes text not null default '[]', token_expires_at timestamptz,
  metadata text not null default '{}', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists social_connections_unique on social_connections(project_id, platform, account_ref);
create index if not exists social_connections_project_idx on social_connections(project_id);
create table if not exists social_schedules (
  id text primary key, project_id text not null, name text not null, timezone text not null,
  cadence text not null, approval_policy text not null default 'manual', enabled boolean not null default true,
  next_run_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists social_content_items (
  id text primary key, project_id text not null, qalam_profile_ref text not null default '',
  language text not null default 'fa', body text not null default '', media_manifest text not null default '[]',
  status text not null default 'draft', approval_state text not null default 'pending',
  created_by text not null default '', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_content_project_idx on social_content_items(project_id, status);

create table if not exists social_publication_jobs (
  id text primary key, project_id text not null, social_connection_id text not null,
  content_item_id text not null, schedule_id text not null default '',
  idempotency_key text not null, status text not null default 'pending',
  attempt_count integer not null default 0, estimated_cost double precision not null default 0,
  not_before timestamptz, last_error text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists social_publication_jobs_idem on social_publication_jobs(idempotency_key);
create index if not exists social_publication_jobs_due on social_publication_jobs(status, not_before);

create table if not exists social_publication_results (
  id text primary key, job_id text not null, attempt_no integer not null default 1,
  provider_post_id text not null default '', provider_url text not null default '',
  status text not null, request_receipt text not null default '{}', response_receipt text not null default '{}',
  published_at timestamptz, readback_at timestamptz, created_at timestamptz not null default now()
);
create unique index if not exists social_publication_results_attempt on social_publication_results(job_id, attempt_no);

create table if not exists social_metrics (
  id text primary key, project_id text not null, social_connection_id text not null,
  publication_result_id text not null default '', provider text not null, metric_name text not null,
  metric_value double precision not null, metric_date text not null, freshness timestamptz not null,
  provenance text not null default '{}', created_at timestamptz not null default now()
);
create index if not exists social_metrics_lookup on social_metrics(project_id, provider, metric_date);

create table if not exists workspace_entitlements (
  project_id text primary key, plan_key text not null default 'internal', workspace_limit integer not null default 1,
  channel_limit integer not null default 20, schedule_limit integer not null default 100,
  ai_generation_limit integer not null default 1000, storage_mb_limit integer not null default 2048,
  seat_limit integer not null default 10, updated_at timestamptz not null default now()
);
create table if not exists operation_receipts (
  id text primary key, project_id text not null, actor_ref text not null default '',
  operation text not null, target_ref text not null default '', status text not null,
  approval_ref text not null default '', idempotency_key text not null default '',
  evidence text not null default '{}', created_at timestamptz not null default now()
);
create index if not exists operation_receipts_project_idx on operation_receipts(project_id, created_at);
