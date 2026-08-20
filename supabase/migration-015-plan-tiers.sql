-- Adds the three not-yet-sold paid plan tiers as DATA ONLY - no payment
-- gateway or purchase flow exists yet (see src/lib/plans.ts). Purely
-- infrastructure, so that turning one on later is a write to an existing
-- column, not new code.
--
-- NULL in either limit column now means "unlimited" - both columns were
-- NOT NULL (only 'free' existed, always real numbers), so that has to be
-- relaxed first.

alter table plan alter column max_participants_per_event drop not null;
alter table plan alter column max_lifetime_events drop not null;

insert into plan (id, max_participants_per_event, max_lifetime_events) values
  -- One-time pass tied to a single EVENT (event.plan_id below), not a
  -- visitor - never assigned as a visitor's own plan, so
  -- max_lifetime_events is not actually meaningful for this row. NULL
  -- here is a safe "no restriction" default rather than an arbitrary
  -- number, in case it's ever read by mistake.
  ('event_pass', 50, null),
  -- Annual subscription ($120/yr, not charged anywhere yet), tied to the
  -- VISITOR (visitor_event_count.plan_id below), not a single event.
  ('annual', 100, null),
  -- Fully unlimited, not marketed/sold yet - a future row.
  ('business', null, null)
on conflict (id) do nothing;

-- event_pass is a one-time pass that unlocks ONE specific event, so it's
-- assigned on `event` itself, not on the visitor who created it.
alter table event add column if not exists plan_id text not null default 'free' references plan(id);

-- annual/business are assigned per-VISITOR (the organizer), not per event -
-- visitor_event_count already tracks visitors individually, so it's the
-- natural home for this.
alter table visitor_event_count add column if not exists plan_id text not null default 'free' references plan(id);
