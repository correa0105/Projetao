-- Enquadramento particular, vinculado à versão do background ativo.
CREATE TABLE kingdom_editor_views (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  background_updated_at timestamptz,
  center_x double precision NOT NULL CHECK (center_x BETWEEN -40000 AND 40000),
  center_y double precision NOT NULL CHECK (center_y BETWEEN -40000 AND 40000),
  zoom double precision NOT NULL CHECK (zoom BETWEEN 0.03 AND 32),
  angle double precision NOT NULL CHECK (angle >= 0 AND angle < 6.283185307179586),
  updated_at timestamptz NOT NULL DEFAULT now()
);
