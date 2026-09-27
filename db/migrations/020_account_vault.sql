CREATE TABLE account_vault (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES catalog_items(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id),
  item_id text NOT NULL REFERENCES catalog_items(id),
  direction text NOT NULL CHECK (direction IN ('to_vault', 'to_backpack')),
  quantity integer NOT NULL CHECK (quantity > 0),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX inventory_transfers_character_idx ON inventory_transfers(character_id, created_at DESC);
