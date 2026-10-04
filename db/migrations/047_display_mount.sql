ALTER TABLE character_mounts ADD COLUMN displayed boolean NOT NULL DEFAULT false;
WITH latest AS (
  SELECT id, row_number() OVER (PARTITION BY character_id ORDER BY created_at DESC,id) AS position FROM character_mounts
)
UPDATE character_mounts SET displayed=true FROM latest WHERE character_mounts.id=latest.id AND latest.position=1;
CREATE UNIQUE INDEX character_mounts_one_displayed ON character_mounts(character_id) WHERE displayed;
