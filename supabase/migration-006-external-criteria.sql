-- External (organizer-entered, non-participant) criteria per item type,
-- e.g. price or local/imported. Additive only - safe on the existing DB.

create table external_criterion (
  id uuid primary key default gen_random_uuid(),
  item_type_id uuid not null references item_type(id) on delete cascade,
  name text not null,
  weight numeric not null default 1,
  calc_type text not null default 'manual' check (calc_type in ('manual', 'threshold', 'options')),
  -- 'manual': no config needed, the raw_value on item_external_value IS the score.
  -- 'threshold': config = { "thresholds": [{"max": 40, "score": 5}, ...], "defaultScore": 1 }
  --   raw_value on item_external_value is the numeric input (e.g. a price).
  -- 'options': config = { "options": [{"label": "יבוא", "score": 3}, ...] }
  --   raw_value on item_external_value is the chosen label.
  config jsonb,
  sort_order int not null default 0
);
create index external_criterion_item_type_id_idx on external_criterion(item_type_id);

create table item_external_value (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references item(id) on delete cascade,
  criterion_id uuid not null references external_criterion(id) on delete cascade,
  raw_value text,
  unique (item_id, criterion_id)
);
create index item_external_value_item_id_idx on item_external_value(item_id);

alter table external_criterion enable row level security;
alter table item_external_value enable row level security;

create policy "external_criterion readable by anyone" on external_criterion
  for select using (true);

create policy "item_external_value readable by anyone" on item_external_value
  for select using (true);
