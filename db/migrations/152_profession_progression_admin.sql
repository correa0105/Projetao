CREATE TABLE profession_administrator_access (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 granted_by text REFERENCES "user"(id) ON DELETE SET NULL,
 reason text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE profession_projects ADD COLUMN materials_waived boolean NOT NULL DEFAULT false;
CREATE TABLE profession_experience_rewards (
 project_id uuid PRIMARY KEY REFERENCES profession_projects(id) ON DELETE CASCADE,
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 profession_id text NOT NULL,
 experience integer NOT NULL CHECK(experience BETWEEN 1 AND 10000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE character_profession_progress (
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 profession_id text NOT NULL,
 experience bigint NOT NULL DEFAULT 0 CHECK(experience>=0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(character_id,profession_id)
);
INSERT INTO profession_experience_rewards(project_id,character_id,profession_id,experience)
 SELECT id,character_id,profession_id,20 FROM profession_projects WHERE claimed_at IS NOT NULL
 ON CONFLICT(project_id) DO NOTHING;
INSERT INTO character_profession_progress(character_id,profession_id,experience)
 SELECT character_id,profession_id,sum(experience) FROM profession_experience_rewards GROUP BY character_id,profession_id
 ON CONFLICT(character_id,profession_id) DO NOTHING;
