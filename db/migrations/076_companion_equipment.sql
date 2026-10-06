-- Keep purchased stable tack attached to its original animal. Wardrobe edits
-- never rewrite the purchase ledger, and inventory equipment reserves copies.
CREATE TABLE companion_wardrobes (
  id uuid PRIMARY KEY,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN('mount','pet')),
  mount_id uuid UNIQUE REFERENCES character_mounts(id) ON DELETE CASCADE,
  pet_id uuid UNIQUE REFERENCES character_pets(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  image_revision integer NOT NULL DEFAULT 0 CHECK(image_revision>=0),
  UNIQUE(id,character_id),
  CHECK((kind='mount' AND mount_id=id AND pet_id IS NULL) OR (kind='pet' AND pet_id=id AND mount_id IS NULL))
);
CREATE TABLE companion_equipment (
  wardrobe_id uuid NOT NULL,
  character_id uuid NOT NULL,
  slot text NOT NULL CHECK(slot IN('head','armor','shoulders','bracers','legs','feet','neck','cloak','back','belt','saddle')),
  item_id text REFERENCES catalog_items(id),
  legacy_id text,
  equipped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(wardrobe_id,slot),
  FOREIGN KEY(wardrobe_id,character_id) REFERENCES companion_wardrobes(id,character_id) ON DELETE CASCADE,
  CHECK((item_id IS NOT NULL AND legacy_id IS NULL) OR(item_id IS NULL AND legacy_id IS NOT NULL))
);
CREATE INDEX companion_equipment_stock ON companion_equipment(character_id,item_id);
CREATE TABLE companion_art_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  wardrobe_id uuid NOT NULL REFERENCES companion_wardrobes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN('mount','pet')),
  species_id text NOT NULL,
  appearance text NOT NULL,
  name text NOT NULL,
  equipment_revision integer NOT NULL,
  reference bytea,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','completed','failed','stale')),
  idempotency_key uuid NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE(user_id,idempotency_key)
);
CREATE UNIQUE INDEX companion_art_pending ON companion_art_jobs(wardrobe_id) WHERE status IN('queued','running');
CREATE INDEX companion_art_queue ON companion_art_jobs(created_at) WHERE status='queued';
CREATE INDEX companion_art_quota ON companion_art_jobs(character_id,created_at);
CREATE TABLE companion_art_equipment (
  job_id uuid NOT NULL REFERENCES companion_art_jobs(id) ON DELETE CASCADE,
  slot text NOT NULL,
  item_id text NOT NULL,
  name text NOT NULL,
  image bytea NOT NULL,
  PRIMARY KEY(job_id,slot)
);
CREATE TABLE companion_artworks (
  wardrobe_id uuid PRIMARY KEY REFERENCES companion_wardrobes(id) ON DELETE CASCADE,
  equipment_revision integer NOT NULL,
  image bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
