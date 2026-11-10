ALTER TABLE character_mounts DROP CONSTRAINT character_mounts_mount_id_check;
ALTER TABLE character_mounts ADD CONSTRAINT character_mounts_mount_id_check CHECK (
  mount_id IN ('riding-horse', 'warhorse', 'pony', 'mule')
  OR (mount_id = 'eclipse-stag' AND price_cp = 0 AND prestige_art IS NOT NULL AND coat = 'original')
);

CREATE TABLE vtt_companion_aid (
  character_id uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  last_used_at timestamptz NOT NULL DEFAULT now()
);
