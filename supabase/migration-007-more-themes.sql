-- Adds 5 new theme options (whiskey, cheese, sausage, burger, pizza).
-- Finds whatever the existing theme check constraint is actually named
-- (Postgres auto-names it, and it may differ from installation to
-- installation) and replaces it, so this doesn't depend on guessing.

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'event'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%theme%'
  loop
    execute format('alter table event drop constraint %I', con.conname);
  end loop;
end $$;

alter table event add constraint event_theme_check
  check (theme in ('default', 'wine', 'meat', 'beer', 'coffee', 'whiskey', 'cheese', 'sausage', 'burger', 'pizza'));
