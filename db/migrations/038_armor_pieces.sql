ALTER TABLE character_equipment DROP CONSTRAINT character_equipment_slot_check;
ALTER TABLE character_equipment ADD CONSTRAINT character_equipment_slot_check CHECK(slot IN ('head','armor','shoulders','bracers','legs','main_hand','off_hand','ring_left','ring_right','neck','cloak','hands','feet','back','belt'));
CREATE TABLE armor_piece_backfills (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  character_id uuid REFERENCES characters(id) ON DELETE CASCADE,
  user_id text REFERENCES "user"(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK(quantity>0),
  applied_at timestamptz,
  CHECK(num_nonnulls(character_id,user_id)=1)
);
-- Snapshot only suits owned before this update. Future purchases already deliver the pieces.
INSERT INTO armor_piece_backfills(character_id,quantity) SELECT character_id,quantity FROM inventory WHERE item_id='plate-armor';
INSERT INTO armor_piece_backfills(user_id,quantity) SELECT user_id,quantity FROM account_vault WHERE item_id='plate-armor';
CREATE TABLE purchase_item_grants (
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES catalog_items(id),
  quantity integer NOT NULL CHECK(quantity>0),
  PRIMARY KEY(purchase_id,item_id)
);
