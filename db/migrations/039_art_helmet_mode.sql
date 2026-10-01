ALTER TABLE character_art_jobs ADD COLUMN helmet_mode text NOT NULL DEFAULT 'closed'
  CHECK (helmet_mode IN ('open','closed'));
