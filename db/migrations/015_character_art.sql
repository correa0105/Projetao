-- Private source images, generation queue and final cutouts live in PostgreSQL.
ALTER TABLE characters ADD COLUMN portrait_revision integer NOT NULL DEFAULT 0;
CREATE TABLE character_portraits (
  character_id uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  image bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE character_art_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  character_id uuid REFERENCES characters(id) ON DELETE CASCADE,
  creation jsonb,
  reference bytea,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  idempotency_key uuid NOT NULL,
  prompt_version text NOT NULL DEFAULT '1',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE(user_id,idempotency_key),
  CHECK (character_id IS NOT NULL OR creation IS NOT NULL)
);
CREATE INDEX character_art_queue_idx ON character_art_jobs(created_at) WHERE status='queued';
CREATE INDEX character_art_owner_idx ON character_art_jobs(user_id,created_at);
CREATE INDEX character_art_quota_idx ON character_art_jobs(character_id,created_at);
CREATE TABLE character_art_worker (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  heartbeat_at timestamptz NOT NULL,
  available boolean NOT NULL DEFAULT false
);
