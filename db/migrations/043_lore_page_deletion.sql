ALTER TABLE lore_pages
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by text REFERENCES "user"(id) ON DELETE SET NULL;
