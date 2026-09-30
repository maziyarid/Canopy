-- Narrative records remain separate from numeric provider facts.
create table if not exists report_insights (
  id text primary key, project_id text not null, site text not null,
  period_start date not null, period_end date not null, generated_at timestamptz not null,
  revision integer not null default 0, payload text not null,
  check (period_start <= period_end)
);
create index if not exists report_insights_project_period_idx on report_insights(project_id, site, period_end, generated_at);
