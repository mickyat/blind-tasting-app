-- Lets the organizer control how much of the ranking is shown on the
-- public/shared results screen (some competitions - grandma's couscous
-- contest, a kibbutz cake vote - don't want it visible who came in last).
-- The underlying data is always kept in full in the DB; this only affects
-- what the results screen displays. 'manual' mode uses item.include_in_results
-- (organizer picks which items to reveal, from the host dashboard, once
-- real scores exist). Additive only - safe on the existing DB.

alter table event add column if not exists results_reveal_mode text not null default 'all'
  check (results_reveal_mode in ('top1', 'top3', 'all', 'manual'));

alter table item add column if not exists include_in_results boolean not null default true;
