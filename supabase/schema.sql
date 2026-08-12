-- Blind Tasting App - schema (v3: categories + theme/logo)
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- This DROPS and recreates every table. For an existing DB you want to keep,
-- use supabase/migration-003-theme-logo.sql instead (additive, no data loss).

drop table if exists score cascade;
drop table if exists participant cascade;
drop table if exists parameter cascade;
drop table if exists category cascade;
drop table if exists item cascade;
drop table if exists event_admin cascade;
drop table if exists event cascade;

create extension if not exists pgcrypto;

-- ========== TABLES ==========

create table event (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  share_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  results_visibility text not null default 'manual'
    check (results_visibility in ('manual', 'after_all_done', 'live')),
  results_open boolean not null default false,
  theme text not null default 'default'
    check (theme in ('default', 'wine', 'meat', 'beer', 'coffee')),
  logo_url text,
  created_at timestamptz not null default now()
);

-- Host secret lives in its own table so it can never leak through a public
-- SELECT or a Realtime payload on `event`. Only accessed server-side.
create table event_admin (
  event_id uuid primary key references event(id) on delete cascade,
  host_token text not null unique default encode(gen_random_bytes(16), 'hex')
);

create table item (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references event(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);
create index item_event_id_idx on item(event_id);

-- A category groups related sub-questions (e.g. "Nose" containing
-- "Intensity", "Fruitiness", "Complexity") and carries its own weight in
-- the item's final score.
create table category (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references event(id) on delete cascade,
  name text not null,
  weight numeric not null default 1,
  sort_order int not null default 0
);
create index category_event_id_idx on category(event_id);

-- A parameter is a sub-question that lives inside exactly one category.
create table parameter (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references category(id) on delete cascade,
  name text not null,
  weight numeric not null default 1,
  scale_min int not null default 1,
  scale_max int not null default 5,
  sort_order int not null default 0
);
create index parameter_category_id_idx on parameter(category_id);

create table participant (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references event(id) on delete cascade,
  nickname text not null,
  session_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);
create index participant_event_id_idx on participant(event_id);

create table score (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participant(id) on delete cascade,
  item_id uuid not null references item(id) on delete cascade,
  parameter_id uuid not null references parameter(id) on delete cascade,
  value numeric not null,
  unique (participant_id, item_id, parameter_id)
);
create index score_participant_id_idx on score(participant_id);
create index score_item_id_idx on score(item_id);

-- ========== ROW LEVEL SECURITY ==========
-- No login system in this app: the "anon" key is used by every visitor
-- (host and participants alike). Access control is done per-table:
--   - event / item / category / parameter: publicly readable (needed to
--     render the tasting), never writable by anon (event creation & host
--     actions go through server-side code using the service role key).
--   - event_admin: no policies at all -> invisible to anon, service-role only.
--   - participant / score: publicly readable+writable, since joining and
--     scoring is meant to work for any visitor with the link, no login.

alter table event enable row level security;
alter table event_admin enable row level security;
alter table item enable row level security;
alter table category enable row level security;
alter table parameter enable row level security;
alter table participant enable row level security;
alter table score enable row level security;

create policy "event readable by anyone" on event
  for select using (true);

create policy "item readable by anyone" on item
  for select using (true);

create policy "category readable by anyone" on category
  for select using (true);

create policy "parameter readable by anyone" on parameter
  for select using (true);

create policy "participant readable by anyone" on participant
  for select using (true);
create policy "anyone can join as participant" on participant
  for insert with check (true);

create policy "score readable by anyone" on score
  for select using (true);
create policy "anyone can insert their scores" on score
  for insert with check (true);
create policy "anyone can update their scores" on score
  for update using (true) with check (true);

-- ========== REALTIME ==========
-- Broadcast row changes so the results screen updates without a refresh.

alter publication supabase_realtime add table event;
alter publication supabase_realtime add table participant;
alter publication supabase_realtime add table score;
