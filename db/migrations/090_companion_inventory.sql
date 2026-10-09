-- Inventory remains the authoritative purchased stock. These rows place units
-- in an individual animal's bag, including equipped units; human availability
-- excludes every placed copy. No purchase, gold, artwork or stock is rewritten.
CREATE TABLE companion_inventory (
  wardrobe_id uuid NOT NULL,
  character_id uuid NOT NULL,
  item_id text NOT NULL REFERENCES catalog_items(id),
  quantity integer NOT NULL CHECK(quantity>0),
  PRIMARY KEY(wardrobe_id,item_id),
  FOREIGN KEY(wardrobe_id,character_id) REFERENCES companion_wardrobes(id,character_id) ON DELETE CASCADE
);
CREATE INDEX companion_inventory_character ON companion_inventory(character_id,item_id);
INSERT INTO companion_inventory(wardrobe_id,character_id,item_id,quantity)
SELECT wardrobe_id,character_id,item_id,count(*)::integer
FROM companion_equipment WHERE item_id IS NOT NULL GROUP BY wardrobe_id,character_id,item_id;
CREATE TABLE inventory_bag_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id),
  item_id text NOT NULL REFERENCES catalog_items(id),
  source text NOT NULL,
  destination text NOT NULL,
  quantity integer NOT NULL CHECK(quantity>0),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,idempotency_key)
);
