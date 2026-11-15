DROP INDEX profession_one_active_project;
CREATE UNIQUE INDEX profession_one_active_project ON profession_projects(character_id,profession_id)
 WHERE claimed_at IS NULL AND canceled_at IS NULL;
