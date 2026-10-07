CREATE TABLE armor_bundle_backfills (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  character_id uuid REFERENCES characters(id) ON DELETE CASCADE,
  user_id text REFERENCES "user"(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES catalog_items(id),
  quantity integer NOT NULL CHECK(quantity>0),
  applied_at timestamptz,
  CHECK(num_nonnulls(character_id,user_id)=1)
);
-- Capture pre-update whole suits once. Plate already has migration038 snapshots.
-- Granting their remaining pieces preserves owned units and total carrying weight;
-- no purchase, balance, equipment selection, or historical price is rewritten.
INSERT INTO armor_bundle_backfills(character_id,item_id,quantity)
SELECT i.character_id,i.item_id,i.quantity FROM inventory i JOIN catalog_items c ON c.id=i.item_id
WHERE c.id<>'plate-armor' AND (
  c.id IN('padded-armor','leather-armor','studded-leather','hide-armor','chain-shirt','scale-mail','breastplate','half-plate-armor','ring-mail','chain-mail','splint-armor')
  OR c.raw_data->>'barding'='true'
  OR c.raw_data->>'base_item' IN('padded-armor','leather-armor','studded-leather','hide-armor','chain-shirt','scale-mail','breastplate','half-plate-armor','ring-mail','chain-mail','splint-armor','plate-armor')
);
INSERT INTO armor_bundle_backfills(user_id,item_id,quantity)
SELECT v.user_id,v.item_id,v.quantity FROM account_vault v JOIN catalog_items c ON c.id=v.item_id
WHERE c.id<>'plate-armor' AND (
  c.id IN('padded-armor','leather-armor','studded-leather','hide-armor','chain-shirt','scale-mail','breastplate','half-plate-armor','ring-mail','chain-mail','splint-armor')
  OR c.raw_data->>'barding'='true'
  OR c.raw_data->>'base_item' IN('padded-armor','leather-armor','studded-leather','hide-armor','chain-shirt','scale-mail','breastplate','half-plate-armor','ring-mail','chain-mail','splint-armor','plate-armor')
);
