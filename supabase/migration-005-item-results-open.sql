-- Per-item results publishing. Additive only - safe on the existing DB.

alter table item add column if not exists results_open boolean not null default false;

alter publication supabase_realtime add table item;
