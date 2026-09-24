-- A cartographer's draft is private until its placement is incorporated into the scene.
CREATE TABLE kingdom_editor_drafts (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
