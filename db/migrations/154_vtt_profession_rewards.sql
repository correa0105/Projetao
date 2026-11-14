ALTER TABLE vtt_members ADD COLUMN last_seen_at timestamptz;
ALTER TABLE vtt_rooms ADD COLUMN material_owner_seen_at timestamptz;
CREATE TABLE vtt_profession_rewards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 room_id uuid REFERENCES vtt_rooms(id) ON DELETE SET NULL,
 mission_id uuid REFERENCES board_posts(id) ON DELETE SET NULL,
 title text NOT NULL,
 tables jsonb NOT NULL,
 roster jsonb NOT NULL,
 opened_by text REFERENCES "user"(id) ON DELETE SET NULL,
 request_id uuid NOT NULL,
 request_payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz,
 UNIQUE(room_id,request_id)
);
CREATE UNIQUE INDEX one_open_profession_reward_per_room ON vtt_profession_rewards(room_id) WHERE completed_at IS NULL;
CREATE UNIQUE INDEX one_profession_reward_per_mission ON vtt_profession_rewards(mission_id) WHERE mission_id IS NOT NULL;
CREATE TABLE vtt_profession_reward_rolls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reward_id uuid NOT NULL REFERENCES vtt_profession_rewards(id) ON DELETE CASCADE,
 player_id text NOT NULL,
 character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
 profession_id text NOT NULL,
 profession_level integer NOT NULL CHECK(profession_level BETWEEN 0 AND 10),
 table_level integer NOT NULL CHECK(table_level IN(0,1,3,6,10)),
 multiplier integer NOT NULL CHECK(multiplier IN(1,2)),
 value integer NOT NULL CHECK(value BETWEEN 1 AND 100),
 item_id text REFERENCES catalog_items(id),
 quantity integer NOT NULL CHECK(quantity BETWEEN 0 AND 198),
 rolled_by text REFERENCES "user"(id) ON DELETE SET NULL,
 request_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 granted_at timestamptz,
 UNIQUE(reward_id,player_id),
 UNIQUE(reward_id,request_id),
 CHECK((item_id IS NULL AND quantity=0)OR(item_id IS NOT NULL AND quantity>0))
);
CREATE TABLE vtt_table_conclusions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 room_id uuid REFERENCES vtt_rooms(id) ON DELETE SET NULL,
 reward_id uuid NOT NULL UNIQUE REFERENCES vtt_profession_rewards(id) ON DELETE CASCADE,
 mission_id uuid REFERENCES board_posts(id) ON DELETE SET NULL,
 summary text NOT NULL,
 recorded_by text REFERENCES "user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
