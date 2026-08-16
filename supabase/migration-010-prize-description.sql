-- Optional free-text "prize description" for organizer/business collabs
-- (e.g. "Top taster wins a bottle from Winery X"), shown near the winner
-- announcement on the results screen and in the winner share card. No
-- validation beyond a reasonable length (enforced client-side only, same
-- pattern as every other free-text field in this app). Additive only -
-- safe on the existing DB.

alter table event add column if not exists prize_description text;
