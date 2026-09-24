CREATE TABLE guild_staff (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('staff', 'admin'))
);
ALTER TABLE characters ADD COLUMN experience integer NOT NULL DEFAULT 0 CHECK (experience >= 0);
ALTER TABLE board_posts
  ADD COLUMN starts_at timestamptz,
  ADD COLUMN completion_summary varchar(5000),
  ADD COLUMN source_mission_id uuid REFERENCES board_posts(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX one_hook_per_mission ON board_posts(source_mission_id) WHERE source_mission_id IS NOT NULL;
CREATE INDEX upcoming_missions ON board_posts(starts_at) WHERE kind='mission' AND status='open';
CREATE TABLE mission_rewards (
  post_id uuid NOT NULL,
  character_id uuid NOT NULL,
  experience integer NOT NULL CHECK (experience BETWEEN 0 AND 1000000),
  awarded_by text REFERENCES "user"(id) ON DELETE SET NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, character_id),
  FOREIGN KEY (post_id, character_id) REFERENCES mission_participants(post_id, character_id) ON DELETE CASCADE
);
