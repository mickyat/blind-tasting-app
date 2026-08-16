-- Lets the organizer give specific participants ("judges") a fixed
-- percentage weight in an item's final score, from the host dashboard,
-- any time after they've joined. Participants with no weight (the common
-- case) are "regular" - they evenly split whatever percentage isn't
-- claimed by judges. A null judge_weight is the default and preserves
-- today's plain-average behavior exactly. Additive only - safe on the
-- existing DB.

alter table participant add column if not exists judge_weight numeric
  check (judge_weight is null or (judge_weight > 0 and judge_weight <= 100));
