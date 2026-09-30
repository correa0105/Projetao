CREATE TABLE character_mounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id),
  mount_id text NOT NULL CHECK (mount_id IN ('riding-horse','warhorse','pony','mule')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  price_cp integer NOT NULL CHECK (price_cp > 0),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(character_id, idempotency_key)
);
CREATE INDEX character_mounts_owner_idx ON character_mounts(character_id);
