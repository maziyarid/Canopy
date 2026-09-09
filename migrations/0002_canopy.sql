-- Canopy studio: projects, scoped client access, keywords, SERP history.

create table if not exists studio_settings (
  user_id text primary key,
  mangools_key text not null default '',
  monday_webhook text not null default '',
  default_location_id integer not null default 2840,
  default_language_id integer not null default 1000,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id text primary key,
  owner_id text not null,
  name text not null,
  domain text not null default '',
  location_id integer not null default 2840,
  language_id integer not null default 1000,
  platform_id integer not null default 1,
  competitors text not null default '',
  tracking_id text not null default '',
  notes text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create index if not exists projects_owner_idx on projects (owner_id);

create table if not exists project_access (
  id text primary key,
  project_id text not null,
  email text not null,
  user_id text,
  role text not null default 'client',
  keyword_filter text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists project_access_email_idx on project_access (email);
create index if not exists project_access_project_idx on project_access (project_id);
create unique index if not exists project_access_unique on project_access (project_id, email);

create table if not exists keywords (
  id text primary key,
  project_id text not null,
  seed text not null default '',
  keyword text not null,
  location_id integer not null default 2840,
  language_id integer not null default 1000,
  volume integer not null default 0,
  msv text not null default '[]',
  kd integer,
  cpc double precision not null default 0,
  ppc double precision not null default 0,
  opportunity double precision not null default 0,
  status text not null default 'new',
  keyword_id text not null default '',
  notes text not null default '',
  agent text not null default '',
  last_fetched text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists keywords_project_idx on keywords (project_id);

create table if not exists rank_history (
  id text primary key,
  project_id text not null,
  keyword text not null,
  device text not null default 'desktop',
  rank integer,
  prev integer,
  best integer,
  visits integer not null default 0,
  volume integer not null default 0,
  url text not null default '',
  checked_at text not null,
  created_at timestamptz not null default now()
);
create index if not exists rank_history_project_idx on rank_history (project_id, keyword);

create table if not exists serp_rows (
  id text primary key,
  project_id text not null,
  keyword text not null,
  position integer not null,
  url text not null default '',
  title text not null default '',
  domain text not null default '',
  kd integer,
  features text not null default '',
  fetched_at text not null
);
create index if not exists serp_rows_project_idx on serp_rows (project_id);

create table if not exists competitors (
  id text primary key,
  project_id text not null,
  domain text not null,
  keyword text not null,
  volume integer not null default 0,
  kd integer,
  cpc double precision not null default 0,
  position integer,
  created_at timestamptz not null default now()
);

create table if not exists gaps (
  id text primary key,
  project_id text not null,
  keyword text not null,
  volume integer not null default 0,
  cpc double precision not null default 0,
  your_position integer,
  competitor text not null,
  competitor_position integer
);

create table if not exists briefs (
  id text primary key,
  project_id text not null,
  keyword text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists agent_runs (
  id text primary key,
  project_id text not null,
  agent text not null,
  action text not null,
  input text not null default '',
  output text not null default '',
  status text not null default 'ok',
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id text primary key,
  project_id text not null,
  user_id text not null,
  level text not null default 'info',
  action text not null,
  detail text not null default '',
  credits integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists monday_events (
  id text primary key,
  project_id text not null,
  event_type text not null,
  payload text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
