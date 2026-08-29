-- Lightweight organizer feedback channel: a free-text form on the host
-- dashboard (src/components/HostDashboard.tsx, submitFeedback in
-- src/app/actions.ts) writes here, and the owner-only /admin panel
-- (src/lib/admin/feedback.ts) reads/deletes. No RLS policies -> invisible
-- to the anon key, same pattern as event_admin/admin_login_attempt - every
-- access goes through a server action using the service-role client.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- The event's share_token (not its internal id) - enough for the owner
  -- to cross-reference which event a note came from, without the feedback
  -- table itself needing a foreign key into event data.
  event_ref text,
  message text not null,
  contact text,
  locale text
);
create index if not exists feedback_created_at_idx on feedback(created_at desc);

alter table feedback enable row level security;
