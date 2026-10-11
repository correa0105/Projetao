CREATE TABLE mission_tags (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(char_length(name) BETWEEN 2 AND 60),
 canonical_name text NOT NULL UNIQUE, description text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
 revision integer NOT NULL DEFAULT 1, created_by text REFERENCES "user"(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mission_post_tags (
 post_id uuid NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
 tag_id uuid NOT NULL REFERENCES mission_tags(id), PRIMARY KEY(post_id,tag_id)
);
CREATE INDEX mission_post_tags_tag_idx ON mission_post_tags(tag_id);
-- Separate durable credits/totals: removing an old post never spends a player's tags.
CREATE TABLE character_tag_credits (
 post_id uuid NOT NULL, character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 tag_id uuid NOT NULL REFERENCES mission_tags(id), awarded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(post_id,character_id,tag_id)
);
CREATE TABLE character_tag_totals (
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE, tag_id uuid NOT NULL REFERENCES mission_tags(id),
 total numeric NOT NULL CHECK(total>=0 AND total=trunc(total)), PRIMARY KEY(character_id,tag_id)
);
CREATE TABLE tag_achievements (
 code text PRIMARY KEY CHECK(code ~ '^tag_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 tag_id uuid NOT NULL REFERENCES mission_tags(id), target numeric NOT NULL CHECK(target>0 AND target=trunc(target)),
 title text NOT NULL CHECK(char_length(title) BETWEEN 2 AND 120), description text NOT NULL,
 active boolean NOT NULL DEFAULT true, rewards jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(rewards)='array'),
 revision integer NOT NULL DEFAULT 1, created_by text REFERENCES "user"(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tag_id,target)
);
CREATE TABLE tag_achievement_grants (
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE, code text NOT NULL REFERENCES tag_achievements(code),
 rule_revision integer NOT NULL, rewards jsonb NOT NULL, awarded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(character_id,code)
);
ALTER TABLE achievements DROP CONSTRAINT achievements_code_check;
ALTER TABLE achievements ADD CONSTRAINT achievements_code_check CHECK(code IN ('first_character','first_purchase','first_mission','north_veteran','first_story','shop_patron','north_renown') OR code ~ '^tag_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
INSERT INTO mission_tags(id,name,canonical_name,description) VALUES('d70910aa-47e5-4884-a261-100000000001','Goblin','goblin','Missões envolvendo goblins.');
