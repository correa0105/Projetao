ALTER TABLE special_shop_offers DROP CONSTRAINT special_shop_offers_check;
ALTER TABLE special_shop_offers ADD CONSTRAINT special_shop_offers_check CHECK (
  (currency='prestige' AND category IN ('profile_border','weapon_skin','prestige_weapon','mount','pet'))
  OR (currency='crystals' AND category='tower_item')
);
ALTER TABLE special_shop_purchases DROP CONSTRAINT special_shop_purchases_check;
ALTER TABLE special_shop_purchases ADD CONSTRAINT special_shop_purchases_check CHECK (
  (currency='crystals' OR snapshot->>'category' IN ('mount','pet','prestige_weapon'))=(character_id IS NOT NULL)
);
CREATE UNIQUE INDEX special_shop_prestige_weapon_entitlement
  ON special_shop_purchases(user_id, (snapshot->>'target_key'))
  WHERE currency='prestige' AND snapshot->>'category'='prestige_weapon';

CREATE TABLE vtt_prestige_weapon_attacks (
  attack_message_id bigint PRIMARY KEY REFERENCES vtt_messages(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  scene_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  target_id uuid NOT NULL,
  item_id text NOT NULL REFERENCES catalog_items(id),
  mode text NOT NULL CHECK(mode IN ('normal','advantage','disadvantage')),
  critical boolean NOT NULL,
  damage_formula text,
  damage_message_id bigint UNIQUE,
  UNIQUE(room_id,author_id,request_id)
);

INSERT INTO catalog_items(id,name,original_name,category,description,price_cp,weight_lb,source,source_url,raw_data,image_path,active)
VALUES
  ('prestige-espada-aurora-velada','Espada da Aurora Velada','Espada da Aurora Velada','Armas',
   'Espada longa evolutiva. +1 no nível 5, +2 no 11 e +3 no 17, no ataque e no dano. A partir do nível 11, um crítico causa 1d4 extra de dano.',40000,3,
   'Alvorada Cinzenta','', '{"base_item":"longsword","rarity":"uncommon"}','/shop/reliquias-forja/aurora-velada.webp',false),
  ('prestige-arco-do-eclipse','Arco do Eclipse','Arco do Eclipse','Armas',
   'Arco longo evolutivo. +1 no nível 5 e +2 no 13, no ataque e no dano. Do nível 5 em diante, causa +2 de dano a alvos entre 40 e 150 pés.',40000,2,
   'Alvorada Cinzenta','', '{"base_item":"longbow","rarity":"uncommon"}','/shop/reliquias-forja/arco-do-eclipse.webp',false),
  ('prestige-martelo-sentinela','Martelo da Sentinela','Martelo da Sentinela','Armas',
   'Martelo de guerra raro. Do nível 9 em diante, +2 no ataque e no dano. O portador com metade dos PV ou menos causa +2 de dano adicional.',400000,2,
   'Alvorada Cinzenta','', '{"base_item":"warhammer","rarity":"rare"}','/shop/reliquias-forja/martelo-da-sentinela.webp',false),
  ('prestige-rapieira-ressaca','Rapieira da Ressaca','Rapieira da Ressaca','Armas',
   'Rapieira incomum. Do nível 5 em diante, +1 no ataque e no dano. Causa +1 de dano adicional contra alvos com metade dos PV ou menos.',40000,2,
   'Alvorada Cinzenta','', '{"base_item":"rapier","rarity":"uncommon"}','/shop/reliquias-forja/rapieira-da-ressaca.webp',false)
ON CONFLICT (id) DO NOTHING;
