ALTER TABLE profession_projects ADD COLUMN legacy_profession_id text
 CHECK (legacy_profession_id IS NULL OR (legacy_profession_id='brewing' AND profession_id='alchemy'
 AND recipe->'output'->>'item_id' LIKE 'potion-%'));
DROP INDEX profession_one_active_project;
CREATE UNIQUE INDEX profession_one_active_project ON profession_projects(character_id,profession_id)
 WHERE claimed_at IS NULL AND canceled_at IS NULL AND legacy_profession_id IS NULL;
CREATE UNIQUE INDEX profession_one_legacy_project ON profession_projects(character_id,legacy_profession_id)
 WHERE claimed_at IS NULL AND canceled_at IS NULL AND legacy_profession_id IS NOT NULL;
CREATE TABLE profession_recipe_corrections (
 project_id uuid PRIMARY KEY REFERENCES profession_projects(id) ON DELETE CASCADE,
 from_profession text NOT NULL,
 to_profession text NOT NULL,
 reason text NOT NULL,
 corrected_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
