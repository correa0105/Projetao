CREATE TABLE event_scene (
  id smallint PRIMARY KEY CHECK(id=1), document jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0, updated_by text REFERENCES "user"(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE event_images (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),author_id text NOT NULL REFERENCES "user"(id),bytes bytea NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE board_posts ADD COLUMN event_presentation jsonb NOT NULL DEFAULT '{"eyebrow":"Encontro da Alvorada","image":"","animation":"float","featured":false,"link":""}'::jsonb;
ALTER TABLE board_posts ADD COLUMN event_revision integer NOT NULL DEFAULT 1;
