CREATE TABLE character_equipment (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('head','armor','main_hand','off_hand','ring_left','ring_right','neck','cloak','hands','feet','back','belt')),
  item_id text NOT NULL REFERENCES catalog_items(id),
  equipped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(character_id,slot)
);
CREATE INDEX character_equipment_items ON character_equipment(character_id,item_id);
CREATE TABLE character_art_equipment (
  job_id uuid NOT NULL REFERENCES character_art_jobs(id) ON DELETE CASCADE,
  slot text NOT NULL,
  item_id text NOT NULL REFERENCES catalog_items(id),
  name text NOT NULL,
  image bytea NOT NULL,
  PRIMARY KEY(job_id,slot)
);
