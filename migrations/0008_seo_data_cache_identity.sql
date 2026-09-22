-- Canonical identity for the in-app Postgres seo_data_cache path.
-- Numbered 0008 so it does not collide with PR #4 / AAX-68
-- migrations/0006_provider_sync_ledger.sql and
-- migrations/0007_provider_sync_project_idempotency.sql (provider_sync_runs).
-- PR #4 SQLite provider_metric uniqueness is a separate store.

delete from seo_data_cache
where id in (
  select id from (
    select id,
           row_number() over (
             partition by project_id, data_source, keyword, url, metric_name, data_date
             order by created_at desc, id desc
           ) as rn
    from seo_data_cache
  ) ranked
  where rn > 1
);

create unique index if not exists seo_data_cache_identity_idx
  on seo_data_cache (project_id, data_source, keyword, url, metric_name, data_date);
