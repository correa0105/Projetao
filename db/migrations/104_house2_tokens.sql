-- Visitors move their own actors independently of house layout revisions.
ALTER TABLE house2_plots ADD COLUMN door_open boolean NOT NULL DEFAULT false;
CREATE TABLE house2_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id uuid NOT NULL REFERENCES house2_neighborhoods(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  pet_id uuid REFERENCES character_pets(id) ON DELETE CASCADE,
  x double precision NOT NULL CHECK(x BETWEEN -50 AND 150),
  y double precision NOT NULL CHECK(y BETWEEN -15 AND 185),
  rotation double precision NOT NULL DEFAULT 0 CHECK(rotation>=0 AND rotation<360),
  size double precision NOT NULL DEFAULT 1 CHECK(size BETWEEN .35 AND 3),
  revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(x-size/2>=-50 AND x+size/2<=150 AND y-size/2>=-15 AND y+size/2<=185)
);
CREATE UNIQUE INDEX house2_tokens_character ON house2_tokens(neighborhood_id,character_id) WHERE pet_id IS NULL;
CREATE UNIQUE INDEX house2_tokens_pet ON house2_tokens(neighborhood_id,pet_id) WHERE pet_id IS NOT NULL;
CREATE INDEX house2_tokens_neighborhood ON house2_tokens(neighborhood_id);
