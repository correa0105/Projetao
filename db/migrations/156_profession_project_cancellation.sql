ALTER TABLE profession_projects
 ADD COLUMN canceled_at timestamptz,
 ADD COLUMN canceled_by text REFERENCES "user"(id) ON DELETE SET NULL,
 ADD COLUMN cancellation_request_id uuid,
 ADD CONSTRAINT profession_canceled_not_claimed CHECK(canceled_at IS NULL OR claimed_at IS NULL);
DROP INDEX profession_one_active_project;
CREATE UNIQUE INDEX profession_one_active_project ON profession_projects(character_id)
 WHERE claimed_at IS NULL AND canceled_at IS NULL;
