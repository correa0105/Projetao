ALTER TABLE character_art_jobs
  ADD COLUMN retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  ADD COLUMN next_attempt_at timestamptz DEFAULT now(),
  ADD COLUMN last_error_code text;

CREATE INDEX character_art_jobs_retry_queue
  ON character_art_jobs (next_attempt_at, created_at, id)
  WHERE status = 'queued';
