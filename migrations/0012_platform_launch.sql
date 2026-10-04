-- Additive product-owned mappings. Provision explicitly after reviewed identity linking.
-- No email linking, users, memberships, owners or secrets are created here.
create table if not exists platform_launch_mappings (
  principal_id text not null, platform_tenant_id text not null,
  platform_workspace_id text not null, user_id text not null references "user"(id),
  project_id text not null references projects(id) on delete cascade, tenant_id text not null references tenants(id),
  status text not null default 'active' check(status in ('active','revoked')),
  primary key(principal_id,platform_tenant_id,platform_workspace_id)
);
create table if not exists platform_launch_sessions (
  session_id text primary key references "session"(id) on delete cascade,
  receipt_id text not null unique,
  principal_id text not null, platform_tenant_id text not null,
  platform_workspace_id text not null, user_id text not null,
  project_id text not null, tenant_id text not null,
  expires_at timestamptz not null, revoked_at timestamptz
);
