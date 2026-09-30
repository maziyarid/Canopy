-- AAX-55 privacy: medical vs thesis data-domain classification.
-- Website domain remains projects.domain; this is a separate classification.
-- Default 'other' for existing rows. App enforces immutability after create.

alter table projects
  add column if not exists data_domain text not null default 'other';

-- Constrain allowed values without breaking existing data.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_data_domain_check'
  ) then
    alter table projects
      add constraint projects_data_domain_check
      check (data_domain in ('medical', 'thesis', 'other'));
  end if;
end$$;

create index if not exists projects_data_domain_idx on projects (data_domain);
