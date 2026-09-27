CREATE TABLE achievement_shelves (
  character_id uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  frame text NOT NULL DEFAULT 'copper' CHECK (frame IN ('copper', 'wood', 'stone')),
  slots jsonb NOT NULL DEFAULT '[null,null,null]'::jsonb CHECK (jsonb_typeof(slots)='array' AND jsonb_array_length(slots)=3),
  updated_at timestamptz NOT NULL DEFAULT now()
);
