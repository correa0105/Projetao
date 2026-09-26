CREATE TABLE character_sheets (
  character_id uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  choices jsonb NOT NULL,
  rolls jsonb,
  assignment jsonb,
  finalized_at timestamptz,
  prepared jsonb NOT NULL DEFAULT '[]',
  notes text NOT NULL DEFAULT '',
  current_hp smallint,
  temp_hp smallint NOT NULL DEFAULT 0 CHECK (temp_hp >= 0),
  inspiration boolean NOT NULL DEFAULT false,
  death_success smallint NOT NULL DEFAULT 0 CHECK (death_success BETWEEN 0 AND 3),
  death_failure smallint NOT NULL DEFAULT 0 CHECK (death_failure BETWEEN 0 AND 3),
  slots_used smallint NOT NULL DEFAULT 0 CHECK (slots_used >= 0),
  hit_dice_used smallint NOT NULL DEFAULT 0 CHECK (hit_dice_used >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (finalized_at IS NULL OR (rolls IS NOT NULL AND assignment IS NOT NULL))
);
