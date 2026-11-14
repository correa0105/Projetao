ALTER TABLE profession_projects
 ADD COLUMN last_assisted_at timestamptz,
 ADD COLUMN assist_count integer NOT NULL DEFAULT 0 CHECK(assist_count>=0),
 ADD COLUMN seconds_saved integer NOT NULL DEFAULT 0 CHECK(seconds_saved>=0);
CREATE TABLE profession_project_assists (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES profession_projects(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
 previous_ready_at timestamptz NOT NULL,
 ready_at timestamptz NOT NULL,
 reduced_seconds integer NOT NULL CHECK(reduced_seconds BETWEEN 1 AND 1800),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(project_id,request_id)
);
