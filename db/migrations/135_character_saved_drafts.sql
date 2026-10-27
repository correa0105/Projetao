-- Remove failed drafts from the UI without losing quota or slot-roll history.
CREATE TABLE character_art_archives (
  job_id uuid PRIMARY KEY REFERENCES character_art_jobs(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  archived_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX character_art_archives_user ON character_art_archives(user_id);
