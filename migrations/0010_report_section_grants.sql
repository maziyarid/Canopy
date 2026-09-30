-- Existing clients receive no aggregate reports until the owner grants sections.
alter table project_access add column if not exists report_sections text not null default '[]';
