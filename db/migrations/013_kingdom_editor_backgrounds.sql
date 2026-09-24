-- Cada cartógrafo pode ensaiar um fundo próprio sem alterar a cena comum.
CREATE TABLE kingdom_editor_backgrounds (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  image_data bytea NOT NULL,
  width integer NOT NULL CHECK (width > 0 AND width <= 12288),
  height integer NOT NULL CHECK (height > 0 AND height <= 12288),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
