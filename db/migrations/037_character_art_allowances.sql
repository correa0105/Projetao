CREATE TABLE character_art_allowances (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  unlimited boolean NOT NULL DEFAULT false
);
