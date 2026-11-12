CREATE TABLE page_tutorial_preferences (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  page text NOT NULL,
  dismissed boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,page)
);
