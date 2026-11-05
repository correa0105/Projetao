ALTER TABLE character_art_jobs ADD COLUMN deadline_at timestamptz;
UPDATE character_art_jobs SET deadline_at=created_at+interval '5 minutes';
ALTER TABLE character_art_jobs ALTER COLUMN deadline_at SET DEFAULT (now()+interval '5 minutes'),
  ALTER COLUMN deadline_at SET NOT NULL;

ALTER TABLE companion_art_jobs ADD COLUMN deadline_at timestamptz;
UPDATE companion_art_jobs SET deadline_at=created_at+interval '5 minutes';
ALTER TABLE companion_art_jobs ALTER COLUMN deadline_at SET DEFAULT (now()+interval '5 minutes'),
  ALTER COLUMN deadline_at SET NOT NULL;

CREATE INDEX character_art_jobs_deadline ON character_art_jobs(deadline_at) WHERE status IN('queued','running');
CREATE INDEX companion_art_jobs_deadline ON companion_art_jobs(deadline_at) WHERE status IN('queued','running');
