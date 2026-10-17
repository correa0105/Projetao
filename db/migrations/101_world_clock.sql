CREATE TABLE world_clock_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  anchor_minutes integer NOT NULL CHECK(anchor_minutes BETWEEN 0 AND 1439),
  anchor_at timestamptz NOT NULL DEFAULT now(),
  revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
  changed_by text REFERENCES "user"(id) ON DELETE SET NULL
);
INSERT INTO world_clock_state(singleton,anchor_minutes)
SELECT true,extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo')::int*60
  +extract(minute FROM now() AT TIME ZONE 'America/Sao_Paulo')::int;
CREATE TABLE world_clock_changes (
  id bigserial PRIMARY KEY,
  actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
  previous_minutes integer NOT NULL CHECK(previous_minutes BETWEEN 0 AND 1439),
  new_minutes integer NOT NULL CHECK(new_minutes BETWEEN 0 AND 1439),
  revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
