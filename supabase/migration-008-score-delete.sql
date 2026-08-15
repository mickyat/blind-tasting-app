-- Lets a participant clear a scale answer (delete their score row), not
-- just overwrite it. Additive only - safe on the existing DB.

create policy "anyone can delete their scores" on score
  for delete using (true);
