CREATE TABLE character_pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id),
  pet_id text NOT NULL CHECK(pet_id IN ('dog','cat','rabbit','owl','fox','raven','frog','snake','rat','guinea-pig')),
  name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 40),
  price_cp integer NOT NULL CHECK(price_cp >= 0),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(character_id,idempotency_key)
);
CREATE INDEX character_pets_character ON character_pets(character_id,created_at DESC);
