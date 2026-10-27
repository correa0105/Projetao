ALTER TABLE characters DROP CONSTRAINT characters_creation_slot_check;
ALTER TABLE characters ADD CONSTRAINT characters_creation_slot_check CHECK(creation_slot BETWEEN 1 AND 4);
ALTER TABLE character_art_jobs DROP CONSTRAINT character_art_jobs_creation_slot_check;
ALTER TABLE character_art_jobs ADD CONSTRAINT character_art_jobs_creation_slot_check CHECK(creation_slot BETWEEN 1 AND 4);
ALTER TABLE character_slot_rolls DROP CONSTRAINT character_slot_rolls_slot_check;
ALTER TABLE character_slot_rolls ADD CONSTRAINT character_slot_rolls_slot_check CHECK(slot BETWEEN 1 AND 4);

-- No automatic entitlement: existing accounts retain two slots.
CREATE TABLE character_account_settings (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  max_characters smallint NOT NULL DEFAULT 2 CHECK(max_characters IN(2,4)),
  camp_character_ids uuid[] CHECK(camp_character_ids IS NULL OR cardinality(camp_character_ids)=2),
  revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE character_capacity_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
  previous_limit smallint NOT NULL,
  new_limit smallint NOT NULL CHECK(new_limit IN(2,4)),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
