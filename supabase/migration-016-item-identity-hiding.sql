-- Lets the organizer prepare all item details (real name, photo,
-- description) up front, but keep participants blind to an item's true
-- identity throughout scoring - revealing it only when the organizer
-- reveals that item's results (reusing the existing manual-selection
-- mechanism, see results_reveal_mode/item.include_in_results - no
-- separate reveal action). Off by default, purely additive: existing
-- events, and the existing always-visible item-photo use case (e.g.
-- costume contests), are completely unaffected.

alter table event add column if not exists hide_item_identity boolean not null default false;

-- Organizer-settable temporary placeholder shown to participants instead
-- of the real label/photo/description while hidden. Null falls back to an
-- auto "Item N" (computed client-side from the item's position within its
-- item type, not stored). Stored separately from item.label - the real
-- name is never overwritten.
alter table item add column if not exists blind_label text;
