-- User-global integration credentials share the existing encrypted vault.
-- Settings owners need not have a project or tenant. Never infer either scope.
alter table credential_vault
  add column if not exists owner_user_id text not null default '';

alter table credential_vault add constraint credential_vault_settings_scope
  check (owner_user_id = '' or
    (tenant_id = '' and project_id = '' and
     provider in ('mangools', 'monday_webhook', 'clickup')));

create unique index credential_vault_settings_owner_provider
  on credential_vault(owner_user_id, provider) where owner_user_id <> '';

-- Old values remain readable to the JavaScript data-migration hook in this
-- same transaction. New plaintext writes are rejected immediately. The hook
-- encrypts existing values, clears these columns and validates the constraints
-- before the migration is recorded. Never apply this file without that hook.
alter table studio_settings add constraint studio_settings_mangools_encrypted
  check (mangools_key = '') not valid;
alter table studio_settings add constraint studio_settings_monday_encrypted
  check (monday_webhook = '') not valid;
alter table clickup_settings add constraint clickup_settings_key_encrypted
  check (api_key = '') not valid;
