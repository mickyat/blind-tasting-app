-- Groundwork for a future paid-plan system: a single `plan` table as the
-- source of truth for limits, plus a durable per-visitor lifetime event
-- counter (visitor_event_count) that deliberately never decrements on
-- delete - the whole point is to stop "free up a slot" by deleting and
-- recreating an event. Both limits are enforced SOFTLY for now
-- (informational banners only - see src/app/actions.ts createEvent,
-- src/app/page.tsx, src/components/HostDashboard.tsx) since no live
-- payment system exists yet. When one does, turning on real enforcement
-- should only need a code change at those soft-check call sites, not new
-- infrastructure - this data model is already the intended source of truth.

create table plan (
  id text primary key,
  max_participants_per_event integer not null,
  max_lifetime_events integer not null
);

insert into plan (id, max_participants_per_event, max_lifetime_events)
values ('free', 12, 3)
on conflict (id) do nothing;

-- Keyed by an anonymous visitor_id cookie (src/lib/visitor.ts), set the
-- first time a browser creates an event - not tied to any single event, so
-- deleting an event never touches this row. No RLS policies on this one
-- (service-role only, same pattern as event_admin/admin_login_attempt) -
-- per-visitor counts aren't meant to be publicly queryable.
create table visitor_event_count (
  visitor_id uuid primary key,
  event_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table plan enable row level security;
alter table visitor_event_count enable row level security;

create policy "plan readable by anyone" on plan
  for select using (true);
