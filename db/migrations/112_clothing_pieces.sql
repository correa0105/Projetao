-- Capture only existing complete outfits. Seed grants the missing components once.
-- The original ID remains the tunic, preserving ownership, equipment and purchases.
CREATE TABLE clothing_bundle_backfills (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  character_id uuid REFERENCES characters(id) ON DELETE CASCADE,
  user_id text REFERENCES "user"(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES catalog_items(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  applied_at timestamptz,
  CHECK (num_nonnulls(character_id, user_id) = 1)
);
INSERT INTO clothing_bundle_backfills(character_id,item_id,quantity)
SELECT character_id,item_id,quantity FROM inventory WHERE item_id IN (
  'cosmetic-outfit-traveler','cosmetic-outfit-traveler-ivory','cosmetic-outfit-traveler-blue','cosmetic-outfit-traveler-wine','cosmetic-outfit-traveler-charcoal'
);
INSERT INTO clothing_bundle_backfills(user_id,item_id,quantity)
SELECT user_id,item_id,quantity FROM account_vault WHERE item_id IN (
  'cosmetic-outfit-traveler','cosmetic-outfit-traveler-ivory','cosmetic-outfit-traveler-blue','cosmetic-outfit-traveler-wine','cosmetic-outfit-traveler-charcoal'
);
