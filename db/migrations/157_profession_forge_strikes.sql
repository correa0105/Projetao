ALTER TABLE profession_projects
 ADD COLUMN strike_count integer NOT NULL DEFAULT 0 CHECK(strike_count BETWEEN 0 AND 9),
 ADD COLUMN last_struck_at timestamptz;
CREATE TABLE profession_project_strikes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES profession_projects(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
 count_after integer NOT NULL CHECK(count_after BETWEEN 0 AND 9),
 completed_assist boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(project_id,request_id),
 CHECK(NOT completed_assist OR count_after=0)
);
