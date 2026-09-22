-- Scope provider sync idempotency to the owning Ms Robot project.
-- Additive repair for databases that already applied 0006.
drop index if exists provider_sync_runs_idem;
create unique index if not exists provider_sync_runs_idem
  on provider_sync_runs(project_id, idempotency_key);
