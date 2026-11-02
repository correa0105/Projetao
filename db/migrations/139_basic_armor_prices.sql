-- Balance the remaining basic armor offers. Keep existing splint/plate overrides intact.
SELECT pg_advisory_xact_lock(74261924);
CREATE TEMP TABLE basic_armor_prices(id text PRIMARY KEY,price_cp integer) ON COMMIT DROP;
INSERT INTO basic_armor_prices VALUES
 ('padded-armor',6000),('leather-armor',10000),('hide-armor',12000),
 ('ring-mail',25000),('studded-leather',40000),('chain-shirt',30000),
 ('scale-mail',50000),('chain-mail',65000),('breastplate',70000),
 ('half-plate-armor',110000),('shield',20000);
-- A common enchantment adds value to its armor instead of discounting it.
INSERT INTO basic_armor_prices
 SELECT magic.id,GREATEST(magic.price_cp,reference.price_cp+20000)
 FROM catalog_items magic JOIN (
  SELECT id,price_cp FROM basic_armor_prices
  UNION ALL SELECT 'splint-armor',120000 UNION ALL SELECT 'plate-armor',150000
 )reference ON reference.id=magic.raw_data->>'base_item'
 WHERE magic.active AND magic.price_cp IS NOT NULL AND lower(magic.raw_data->>'rarity')='common'
 AND coalesce(magic.raw_data->>'equipment_target','human')='human'
 AND magic.price_cp<reference.price_cp+20000;
INSERT INTO economy_price_history(version,item_id,before_price_cp,after_price_cp,before_override)
 SELECT 'basic-armor-20261102',p.id,c.price_cp,p.price_cp,to_jsonb(o)
 FROM basic_armor_prices p LEFT JOIN catalog_items c ON c.id=p.id
 LEFT JOIN shop_price_overrides o ON o.item_id=p.id;
INSERT INTO shop_price_overrides(item_id,price_cp)
 SELECT id,price_cp FROM basic_armor_prices
 ON CONFLICT(item_id) DO UPDATE SET price_cp=excluded.price_cp,updated_at=now();
UPDATE catalog_items c SET price_cp=p.price_cp FROM basic_armor_prices p WHERE c.id=p.id;
-- Archive the former definitions; keep all owned pieces and purchase grants.
INSERT INTO economy_settings_history(version,area,reference,document)
 SELECT 'partial-armor-20261102','catalog_item',id,
 jsonb_build_object('weight_lb',weight_lb,'raw_data',raw_data)
 FROM catalog_items WHERE id ~ '(^|-)(breastplate|half-plate)(-|$)'
 AND coalesce(raw_data->>'equipment_target','human')='human';
