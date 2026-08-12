-- Blind Tasting App - schema (v4: item types + descriptive/checklist questions)
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- This DROPS and recreates every table.

drop table if exists checklist_answer cascade;
drop table if exists score cascade;
drop table if exists participant cascade;
drop table if exists parameter cascade;
drop table if exists category cascade;
drop table if exists item cascade;
drop table if exists item_type cascade;
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

-- An event can combine several tasting types in one evening (e.g. wine AND
-- meat). Each item type has its own questionnaire (categories/parameters)
-- and its own items.
create table item_type (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references event(id) on delete cascade,
  name text not null,
  template text,
  sort_order int not null default 0
);
create index item_type_event_id_idx on item_type(event_id);

create table item (
  id uuid primary key default gen_random_uuid(),
  item_type_id uuid not null references item_type(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);
create index item_item_type_id_idx on item(item_type_id);

-- A category groups related sub-questions (e.g. "Nose" containing
-- "Intensity", "Fruitiness", "Complexity") and carries its own weight in
-- the item's final score.
create table category (
  id uuid primary key default gen_random_uuid(),
  item_type_id uuid not null references item_type(id) on delete cascade,
  name text not null,
  weight numeric not null default 1,
  sort_order int not null default 0
);
create index category_item_type_id_idx on category(item_type_id);

-- A parameter is a sub-question inside exactly one category. 'scale' is the
-- original numeric 1-5 style question feeding the weighted score. 'checklist'
-- is a descriptive question (pick one or more options, no numeric score) -
-- it never contributes to the weighted average, only to a separate
-- "descriptive summary" of frequencies.
create table parameter (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references category(id) on delete cascade,
  name text not null,
  weight numeric not null default 1,
  kind text not null default 'scale' check (kind in ('scale', 'checklist')),
  scale_min int,
  scale_max int,
  options jsonb,
  multi_select boolean not null default false,
  sort_order int not null default 0,
  check (
    (kind = 'scale' and scale_min is not null and scale_max is not null and scale_max > scale_min)
    or
    (kind = 'checklist' and options is not null)
  )
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

-- Numeric answers to 'scale' parameters.
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

-- Answers to 'checklist' parameters: one row per chosen option (naturally
-- supports multi-select; single-select just means the app keeps exactly one
-- row per participant/item/parameter).
create table checklist_answer (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participant(id) on delete cascade,
  item_id uuid not null references item(id) on delete cascade,
  parameter_id uuid not null references parameter(id) on delete cascade,
  option text not null,
  unique (participant_id, item_id, parameter_id, option)
);
create index checklist_answer_participant_id_idx on checklist_answer(participant_id);
create index checklist_answer_item_id_idx on checklist_answer(item_id);

-- ========== ROW LEVEL SECURITY ==========
-- No login system in this app: the "anon" key is used by every visitor
-- (host and participants alike).
--   - event / item_type / item / category / parameter: publicly readable,
--     never writable by anon (event creation & host actions go through
--     server-side code using the service role key).
--   - event_admin: no policies at all -> invisible to anon, service-role only.
--   - participant / score / checklist_answer: publicly readable+writable,
--     since joining and answering is meant to work for any visitor with the
--     link, no login.

alter table event enable row level security;
alter table event_admin enable row level security;
alter table item_type enable row level security;
alter table item enable row level security;
alter table category enable row level security;
alter table parameter enable row level security;
alter table participant enable row level security;
alter table score enable row level security;
alter table checklist_answer enable row level security;

create policy "event readable by anyone" on event
  for select using (true);

create policy "item_type readable by anyone" on item_type
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

create policy "checklist_answer readable by anyone" on checklist_answer
  for select using (true);
create policy "anyone can insert checklist answers" on checklist_answer
  for insert with check (true);
create policy "anyone can delete their checklist answers" on checklist_answer
  for delete using (true);

-- ========== REALTIME ==========
-- Broadcast row changes so the results screen updates without a refresh.

alter publication supabase_realtime add table event;
alter publication supabase_realtime add table participant;
alter publication supabase_realtime add table score;
alter publication supabase_realtime add table checklist_answer;
