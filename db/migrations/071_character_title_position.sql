ALTER TABLE characters ADD COLUMN title_position text NOT NULL DEFAULT 'below'
  CHECK (title_position IN ('below', 'beside'));
