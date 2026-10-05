ALTER TABLE character_pets ADD COLUMN displayed boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX character_pets_one_display ON character_pets(character_id) WHERE displayed;
-- Show the oldest companion for existing characters; future choices are never reseeded.
UPDATE character_pets SET displayed=true WHERE id IN (
  SELECT DISTINCT ON (character_id) id FROM character_pets ORDER BY character_id,created_at,id
);
CREATE TABLE pet_breed_names (
  pet_id text NOT NULL,
  appearance text NOT NULL,
  name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 80),
  revision integer NOT NULL DEFAULT 1 CHECK(revision >= 1),
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(pet_id,appearance)
);
