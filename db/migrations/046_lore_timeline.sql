CREATE TABLE lore_timeline (
  id smallint PRIMARY KEY CHECK (id = 1),
  document jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
