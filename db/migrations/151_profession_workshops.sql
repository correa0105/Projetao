CREATE TABLE profession_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 recipe_id text NOT NULL, profession_id text NOT NULL, recipe jsonb NOT NULL,
 request_id uuid NOT NULL, step integer NOT NULL DEFAULT 0 CHECK(step BETWEEN 0 AND 64),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), ready_at timestamptz NOT NULL,
 claimed_at timestamptz, granted jsonb NOT NULL DEFAULT '[]',
 UNIQUE(character_id,request_id)
);
CREATE UNIQUE INDEX profession_one_active_project ON profession_projects(character_id) WHERE claimed_at IS NULL;
CREATE INDEX profession_projects_history ON profession_projects(character_id,created_at DESC);
CREATE TABLE profession_project_actions (
 project_id uuid NOT NULL REFERENCES profession_projects(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(project_id,request_id)
);
CREATE TABLE profession_material_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
 room_id uuid REFERENCES vtt_rooms(id) ON DELETE SET NULL,
 character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
 material_id text NOT NULL REFERENCES catalog_items(id), quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 99),
 reason text NOT NULL, request_id uuid NOT NULL, payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(actor_id,request_id)
);
