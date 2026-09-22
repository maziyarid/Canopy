-- Maz Robot runtime safety primitives: encrypted credentials + worker leasing/retry state.

create table if not exists credential_vault (
  id text primary key,
  tenant_id text not null,
  project_id text not null default '',
  provider text not null,
  label text not null default '',
  key_version integer not null default 1,
  algorithm text not null default 'aes-256-gcm',
  nonce_b64 text not null,
  ciphertext_b64 text not null,
  auth_tag_b64 text not null,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists credential_vault_scope_idx
  on credential_vault(tenant_id, project_id, provider);

alter table social_publication_jobs
  add column if not exists max_attempts integer not null default 5;
alter table social_publication_jobs
  add column if not exists locked_by text not null default '';
alter table social_publication_jobs
  add column if not exists lease_until timestamptz;
alter table social_publication_jobs
  add column if not exists completed_at timestamptz;
alter table social_publication_jobs
  add column if not exists dead_lettered_at timestamptz;
alter table social_publication_jobs
  add column if not exists failure_class text not null default '';

create index if not exists social_publication_jobs_lease
  on social_publication_jobs(status, lease_until, not_before);
