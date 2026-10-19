CREATE TABLE guild_facility_definitions (
  room text PRIMARY KEY CHECK (room IN ('main','forge','lounge','meeting','alchemy','training','library','leader')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  description text NOT NULL CHECK (char_length(description) <= 2000),
  upgrade_description text NOT NULL CHECK (char_length(upgrade_description) <= 2000),
  x real NOT NULL CHECK (x BETWEEN 0.03 AND 0.97),
  y real NOT NULL CHECK (y BETWEEN 0.4 AND 0.97),
  scale real NOT NULL CHECK (scale BETWEEN 0.04 AND 0.6),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
