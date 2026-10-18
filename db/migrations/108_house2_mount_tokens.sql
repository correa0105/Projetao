ALTER TABLE house2_tokens
  ADD COLUMN mount_id uuid REFERENCES character_mounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT house2_tokens_one_companion CHECK (pet_id IS NULL OR mount_id IS NULL);

DROP INDEX house2_tokens_character;
CREATE UNIQUE INDEX house2_tokens_character
  ON house2_tokens(neighborhood_id,character_id) WHERE pet_id IS NULL AND mount_id IS NULL;
CREATE UNIQUE INDEX house2_tokens_mount
  ON house2_tokens(neighborhood_id,mount_id) WHERE mount_id IS NOT NULL;
