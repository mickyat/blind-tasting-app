-- Lets the organizer attach a real photo and/or a free-text label to an
-- item after the event was created (e.g. a photo of the wine label, or "300
-- gr entrecote from butcher X"). Additive only - safe on the existing DB.
-- No new storage bucket needed - item photos reuse the existing public
-- `event-logos` bucket (uploaded server-side via service role, same as the
-- event logo already does).

alter table item add column if not exists image_url text;
alter table item add column if not exists custom_label text;
