-- Blind Tasting App - initial schema
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query)

create extension if not exists pgcrypto;

-- ========== TABLES ==========

-- Public-safe event info (no secrets here - readable by anyone with the row,
-- and this is the table Realtime broadcasts from).
create table event (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  share_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  results_visibility text not null default 'manual'
    check (results_visibility in ('manual', 'after_all_done', 'live')),
  results_open boolean not null default false,
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

create table parameter (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references event(id) on delete cascade,
  name text not null,
  weight numeric not null default 1,
  scale_min int not null default 1,
  scale_max int not null default 5,
  sort_order int not null default 0
);
create index parameter_event_id_idx on parameter(event_id);

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
--   - event / item / parameter: publicly readable (needed to render the
--     tasting), never writable by anon (event creation & host actions go
--     through server-side code using the service role key).
--   - event_admin: no policies at all -> invisible to anon, service-role only.
--   - participant / score: publicly readable+writable, since joining and
--     scoring is meant to work for any visitor with the link, no login.

alter table event enable row level security;
alter table event_admin enable row level security;
alter table item enable row level security;
alter table parameter enable row level security;
alter table participant enable row level security;
alter table score enable row level security;

create policy "event readable by anyone" on event
  for select using (true);

create policy "item readable by anyone" on item
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
