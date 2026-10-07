-- Keep purchases, gifts and reward audit references while removing a player's item.
ALTER TABLE house_items ADD COLUMN deleted_at timestamptz;
