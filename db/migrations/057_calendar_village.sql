CREATE TABLE guild_calendar (
  id smallint PRIMARY KEY CHECK(id=1),
  document jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Replace the old palace background while preserving all edited scene content and layers.
UPDATE event_scene SET document=jsonb_set(document,'{background}','"/notice-village-empty-v4.png"'::jsonb),revision=revision+1,updated_at=now()
WHERE document->>'background'='/events/hall-v1.webp';
