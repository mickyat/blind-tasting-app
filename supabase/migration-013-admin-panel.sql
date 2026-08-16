-- Backs the owner-only /admin stats panel (see src/lib/admin/*, src/app/admin/*):
--   1. event.locale - captured at creation time from the visitor's resolved
--      locale (src/i18n/request.ts resolveLocale()), so the admin panel can
--      show a Hebrew-vs-English breakdown. Events created before this
--      migration simply have locale = null ("unknown / pre-feature").
--   2. admin_login_attempt - one row per FAILED admin login, used to
--      rate-limit brute-force guesses against ADMIN_PASSWORD. No RLS
--      policies (same pattern as event_admin) - invisible to the anon key,
--      only ever touched by the service-role client from admin login
--      server actions.

alter table event add column if not exists locale text;

create table if not exists admin_login_attempt (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_login_attempt_ip_created_idx on admin_login_attempt(ip, created_at);

alter table admin_login_attempt enable row level security;
