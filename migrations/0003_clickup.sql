-- ClickUp integration for SEO content management

create table if not exists clickup_settings (
  id text primary key default gen_random_uuid(),
  user_id text not null unique,
  api_key text not null,
  team_id text not null default '',
  folder_id text not null default '',
  list_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clickup_settings_user_idx on clickup_settings (user_id);

-- Track which keywords are linked to ClickUp tasks
alter table keywords add column if not exists clickup_task_id text default '';
alter table keywords add column if not exists clickup_task_url text default '';

-- ClickUp task sync history
create table if not exists clickup_sync_log (
  id text primary key default gen_random_uuid(),
  project_id text not null,
  user_id text not null,
  action text not null,
  task_id text not null,
  keyword text not null default '',
  status text not null default 'success',
  error_message text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists clickup_sync_log_project_idx on clickup_sync_log (project_id);
create index if not exists clickup_sync_log_task_idx on clickup_sync_log (task_id);

-- Content publication tracking
create table if not exists published_content (
  id text primary key default gen_random_uuid(),
  project_id text not null,
  url text not null,
  title text not null,
  keyword text not null default '',
  content_type text not null default 'blog',
  publish_date timestamptz not null default now(),
  author text not null default '',
  status text not null default 'published',
  backlinks integer not null default 0,
  social_shares integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists published_content_project_idx on published_content (project_id);
create index if not exists published_content_url_idx on published_content (url);
create index if not exists published_content_keyword_idx on published_content (keyword);

-- Link tracking for published content
create table if not exists content_links (
  id text primary key default gen_random_uuid(),
  content_id text not null,
  url text not null,
  anchor_text text not null default '',
  target_url text not null,
  is_internal boolean not null default true,
  is_dofollow boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists content_links_content_idx on content_links (content_id);

-- Multi-source SEO data cache
create table if not exists seo_data_cache (
  id text primary key default gen_random_uuid(),
  project_id text not null,
  data_source text not null,
  keyword text not null default '',
  url text not null default '',
  metric_name text not null,
  metric_value double precision not null default 0,
  data_date date not null default CURRENT_DATE,
  created_at timestamptz not null default now()
);

create index if not exists seo_data_cache_project_idx on seo_data_cache (project_id);
create index if not exists seo_data_cache_source_idx on seo_data_cache (data_source);
create index if not exists seo_data_cache_keyword_idx on seo_data_cache (keyword);
create index if not exists seo_data_cache_date_idx on seo_data_cache (data_date);
