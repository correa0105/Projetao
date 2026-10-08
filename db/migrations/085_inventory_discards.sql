CREATE TABLE inventory_discards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id),
  item_id text NOT NULL REFERENCES catalog_items(id),
  source text NOT NULL CHECK (source IN ('backpack', 'vault')),
  quantity integer NOT NULL CHECK (quantity > 0),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX inventory_discards_character_idx ON inventory_discards(character_id, created_at DESC);
