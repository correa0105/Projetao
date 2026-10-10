-- The first completion batch supplied spiked magical suits as single items.
-- Capture owned whole suits before the reviewed bundle catalog splits their weights.
-- seedArmorPieces grants the other five pieces once and marks each snapshot applied.
-- Purchase records, balances, parent units and equipped selections remain unchanged.
INSERT INTO armor_bundle_backfills(character_id,item_id,quantity)
SELECT i.character_id,i.item_id,i.quantity
FROM inventory i JOIN catalog_items c ON c.id=i.item_id
WHERE c.raw_data->>'shop_magic_completion'='true'
  AND c.raw_data->>'magic_kind'='armor'
  AND c.raw_data->>'base_item'='spiked-armor'
  AND c.raw_data->>'armor_bundle_parent' IS NULL;

INSERT INTO armor_bundle_backfills(user_id,item_id,quantity)
SELECT v.user_id,v.item_id,v.quantity
FROM account_vault v JOIN catalog_items c ON c.id=v.item_id
WHERE c.raw_data->>'shop_magic_completion'='true'
  AND c.raw_data->>'magic_kind'='armor'
  AND c.raw_data->>'base_item'='spiked-armor'
  AND c.raw_data->>'armor_bundle_parent' IS NULL;
