-- Adds event theme + optional logo. Additive only - safe to run on the
-- existing database, no data loss.

alter table event add column if not exists theme text not null default 'default'
  check (theme in ('default', 'wine', 'meat', 'beer', 'coffee'));

alter table event add column if not exists logo_url text;
