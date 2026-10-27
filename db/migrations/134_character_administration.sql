ALTER TABLE characters ADD COLUMN sheet_overrides jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(sheet_overrides)='object');
CREATE TABLE character_admin_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
  reason text NOT NULL,
  before_data jsonb NOT NULL,
  after_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX character_admin_edits_character ON character_admin_edits(character_id,created_at);
