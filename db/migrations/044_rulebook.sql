CREATE TABLE rulebook_documents (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id=1),
  document jsonb NOT NULL CHECK (jsonb_typeof(document)='object' AND document->>'version'='1'),
  revision integer NOT NULL DEFAULT 0 CHECK (revision>=0),
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rulebook_versions (
  document_id smallint NOT NULL REFERENCES rulebook_documents(id),
  revision integer NOT NULL CHECK (revision>=0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  editor_id text REFERENCES "user"(id) ON DELETE SET NULL,
  document_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(document_id,revision)
);
CREATE TABLE rulebook_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by text REFERENCES "user"(id) ON DELETE SET NULL,
  name varchar(160) NOT NULL,
  image_data bytea NOT NULL,
  mime_type text NOT NULL DEFAULT 'image/webp' CHECK (mime_type='image/webp'),
  width integer NOT NULL CHECK (width>0 AND width<=8192),
  height integer NOT NULL CHECK (height>0 AND height<=8192),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rulebook_images_uploader ON rulebook_images(uploaded_by);
