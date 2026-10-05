-- AAX-164: capability-based delegated Google access.
-- Existing provider_connections remains the read/reporting connection registry.
-- Write/admin profiles point only to encrypted credential_vault references.

create table if not exists google_connection_profiles (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  provider text not null check(provider in ('gsc','ga4','gtm','google_ads')),
  profile_mode text not null check(profile_mode in ('write','admin')),
  account_ref text not null default '',
  credential_ref text not null references credential_vault(id),
  auth_type text not null default 'oauth2' check(auth_type in ('oauth2','service_account')),
  scopes text not null default '[]',
  resource_bindings text not null default '[]',
  status text not null default 'pending'
    check(status in ('pending','active','disabled','revoked','error')),
  token_expires_at timestamptz,
  last_verified_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists google_connection_profiles_unique
  on google_connection_profiles(project_id,provider,profile_mode,account_ref);
create index if not exists google_connection_profiles_project_idx
  on google_connection_profiles(project_id,provider,status);

create table if not exists google_capability_grants (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  principal_user_id text not null,
  role_template text not null default '',
  provider text not null check(provider in ('gsc','ga4','gtm','google_ads')),
  capability text not null,
  resource_type text not null,
  resource_ref text not null,
  connection_profile_id text not null references google_connection_profiles(id) on delete cascade,
  status text not null default 'active' check(status in ('active','revoked','expired')),
  expires_at timestamptz,
  granted_by text not null,
  grant_receipt_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists google_capability_grants_lookup
  on google_capability_grants(project_id,principal_user_id,provider,capability,status);
create index if not exists google_capability_grants_resource
  on google_capability_grants(project_id,resource_type,resource_ref,status);

create table if not exists google_action_proposals (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  actor_ref text not null,
  connection_profile_id text not null references google_connection_profiles(id),
  provider text not null check(provider in ('gsc','ga4','gtm','google_ads')),
  capability text not null,
  action text not null,
  resource_type text not null,
  resource_ref text not null,
  payload text not null default '{}',
  payload_hash text not null,
  deterministic_diff text not null default '{}',
  snapshot_hash text not null default '',
  approval_policy text not null check(approval_policy in ('grant','ada')),
  approval_ref text not null default '',
  approval_payload_hash text not null default '',
  idempotency_key text not null,
  status text not null default 'pending'
    check(status in ('pending','pending_approval','ready','executing','succeeded','failed','rejected','cancelled','expired')),
  provider_request_id text not null default '',
  result_receipt text not null default '{}',
  last_error text not null default '',
  expires_at timestamptz,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists google_action_proposals_idempotency
  on google_action_proposals(project_id,idempotency_key);
create index if not exists google_action_proposals_queue
  on google_action_proposals(project_id,status,created_at);
