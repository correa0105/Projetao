CREATE TABLE lore_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id text NOT NULL REFERENCES world_regions(id),
  parent_id uuid REFERENCES lore_folders(id),
  name varchar(80) NOT NULL,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX lore_folder_root_name ON lore_folders(region_id,lower(name)) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX lore_folder_child_name ON lore_folders(parent_id,lower(name)) WHERE parent_id IS NOT NULL;
INSERT INTO lore_folders(region_id,name)
SELECT r.id,f.name FROM world_regions r
CROSS JOIN (VALUES ('Cidades'),('Capital'),('Religião'),('Lendas'),('Criaturas'),('História')) AS f(name);

CREATE TABLE lore_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id text NOT NULL REFERENCES world_regions(id),
  folder_id uuid NOT NULL REFERENCES lore_folders(id),
  author_id text REFERENCES "user"(id) ON DELETE SET NULL,
  legacy_id text UNIQUE REFERENCES world_entries(id),
  title varchar(140) NOT NULL,
  subtitle varchar(300) NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(blocks)='array'),
  revision integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lore_pages_region_folder ON lore_pages(region_id,folder_id);
CREATE TABLE lore_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES lore_pages(id) ON DELETE CASCADE,
  image_data bytea NOT NULL,
  mime_type text NOT NULL DEFAULT 'image/webp',
  width integer NOT NULL,
  height integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lore_images_page ON lore_images(page_id);
CREATE TABLE lore_page_versions (
  page_id uuid NOT NULL REFERENCES lore_pages(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  editor_id text REFERENCES "user"(id) ON DELETE SET NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(page_id,revision)
);
