CREATE TABLE achievement_definitions (
  code text PRIMARY KEY CHECK (code IN ('first_character','first_purchase','first_mission','north_veteran','first_story','shop_patron','north_renown')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  description text NOT NULL CHECK (char_length(description) <= 1000),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_by text REFERENCES "user"(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
