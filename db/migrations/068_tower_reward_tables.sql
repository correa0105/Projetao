ALTER TABLE tower_floors ADD COLUMN base_gold_cp integer CHECK(base_gold_cp BETWEEN 0 AND 100000000);
ALTER TABLE tower_floors ADD COLUMN base_crystals integer CHECK(base_crystals BETWEEN 0 AND 1000000);
CREATE TABLE tower_reward_tables (
 tier integer PRIMARY KEY CHECK(tier BETWEEN 0 AND 100),
 revision integer NOT NULL DEFAULT 0,
 rows jsonb NOT NULL CHECK(jsonb_typeof(rows)='array'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tower_reward_tables(tier,rows)
SELECT tier,jsonb_agg(jsonb_build_object(
 'min',lo,'max',hi,'rarity',rarity,
 'relic',label||' · '||CASE tier WHEN 0 THEN 'Fragmento do Limiar' WHEN 1 THEN 'Selo do Limiar' WHEN 2 THEN 'Coração Prismático' WHEN 3 THEN 'Semente do Véu' WHEN 4 THEN 'Brasa Imortal' WHEN 5 THEN 'Lágrima do Inverno' WHEN 6 THEN 'Fragmento da Aurora' WHEN 7 THEN 'Selo do Andar 35' WHEN 8 THEN 'Selo do Andar 40' WHEN 9 THEN 'Selo do Andar 45' WHEN 10 THEN 'Selo do Andar 50' WHEN 11 THEN 'Selo do Andar 55' WHEN 12 THEN 'Selo do Andar 60' WHEN 13 THEN 'Selo do Andar 65' WHEN 14 THEN 'Selo do Andar 70' WHEN 15 THEN 'Selo do Andar 75' WHEN 16 THEN 'Selo do Andar 80' WHEN 17 THEN 'Selo do Andar 85' WHEN 18 THEN 'Selo do Andar 90' WHEN 19 THEN 'Selo do Andar 95' WHEN 20 THEN 'Selo do Andar 100' ELSE 'Selo da Ascensão '||tier END,
 'gold_cp',gold*(tier+1)*100,'crystals',crystals*(tier+1),'item_id',NULL,'quantity',1
) ORDER BY lo)
FROM generate_series(0,100) tier CROSS JOIN (VALUES
 (1,50,'Comum','Estilhaço',5,2), (51,75,'Incomum','Insígnia',15,5),
 (76,90,'Raro','Núcleo',35,12), (91,98,'Épico','Relíquia',70,24), (99,100,'Lendário','Coração',140,50)
) r(lo,hi,rarity,label,gold,crystals) GROUP BY tier;
ALTER TABLE tower_claims ADD COLUMN loot_table jsonb;
ALTER TABLE tower_claims ADD COLUMN item_id text REFERENCES catalog_items(id);
ALTER TABLE tower_claims ADD COLUMN item_quantity integer NOT NULL DEFAULT 0 CHECK(item_quantity BETWEEN 0 AND 99);
UPDATE tower_claims c SET loot_table=t.rows FROM tower_reward_tables t WHERE t.tier=c.tier;
CREATE TABLE tower_item_grants (
 run_id uuid NOT NULL, character_id uuid NOT NULL,
 item_id text NOT NULL REFERENCES catalog_items(id), quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 99),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(run_id,character_id,item_id),
 FOREIGN KEY(run_id,character_id) REFERENCES tower_claims(run_id,character_id) ON DELETE CASCADE
);
