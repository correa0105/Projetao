CREATE TABLE lore_folder_managers (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE
);
INSERT INTO lore_folder_managers(user_id)
SELECT id FROM "user" WHERE lower(trim(email))='limawelsn@gmail.com'
ON CONFLICT DO NOTHING;

ALTER TABLE lore_folders ADD COLUMN deleted_at timestamptz;
ALTER TABLE lore_folders ADD COLUMN revision integer NOT NULL DEFAULT 0;
DROP INDEX lore_folder_root_name;
DROP INDEX lore_folder_child_name;
CREATE UNIQUE INDEX lore_folder_root_name ON lore_folders(region_id,lower(name)) WHERE parent_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX lore_folder_child_name ON lore_folders(parent_id,lower(name)) WHERE parent_id IS NOT NULL AND deleted_at IS NULL;
CREATE TABLE lore_folder_deletions (
  id uuid PRIMARY KEY,
  root_id uuid NOT NULL REFERENCES lore_folders(id),
  folder_ids uuid[] NOT NULL,
  page_moves jsonb NOT NULL DEFAULT '[]',
  deleted_by text REFERENCES "user"(id) ON DELETE SET NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz
);
