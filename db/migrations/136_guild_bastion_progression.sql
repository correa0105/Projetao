ALTER TABLE guild_facility_definitions ADD COLUMN progression jsonb
  CHECK (progression IS NULL OR jsonb_typeof(progression)='object');

-- Durable company achievements: a member leaving never erases completed work.
-- References deliberately do not cascade from missions, characters or tower runs.
CREATE TABLE guild_bastion_credits (
  guild_id uuid NOT NULL REFERENCES player_guilds(id) ON DELETE CASCADE,
  metric text NOT NULL CHECK(metric IN ('missions','monster_tag','tower_crystals')),
  reference text NOT NULL,
  tag_id uuid REFERENCES mission_tags(id),
  amount bigint NOT NULL CHECK(amount>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(guild_id,metric,reference),
  CHECK ((metric='monster_tag')=(tag_id IS NOT NULL))
);
CREATE INDEX guild_bastion_metric ON guild_bastion_credits(guild_id,metric,tag_id);

INSERT INTO guild_bastion_credits(guild_id,metric,reference,amount,created_at)
SELECT m.guild_id,'missions',r.post_id::text,1,min(r.awarded_at)
FROM mission_rewards r JOIN player_guild_members m ON m.character_id=r.character_id
WHERE r.awarded_at>=m.joined_at GROUP BY m.guild_id,r.post_id
ON CONFLICT DO NOTHING;
INSERT INTO guild_bastion_credits(guild_id,metric,reference,tag_id,amount,created_at)
SELECT m.guild_id,'monster_tag',r.post_id::text||':'||r.character_id::text||':'||r.tag_id::text,r.tag_id,1,r.awarded_at
FROM character_tag_credits r JOIN player_guild_members m ON m.character_id=r.character_id
WHERE r.awarded_at>=m.joined_at ON CONFLICT DO NOTHING;
INSERT INTO guild_bastion_credits(guild_id,metric,reference,amount,created_at)
SELECT m.guild_id,'tower_crystals',r.run_id::text||':'||r.character_id::text||':base',r.base_crystals,r.created_at
FROM tower_claims r JOIN player_guild_members m ON m.character_id=r.character_id
WHERE r.created_at>=m.joined_at AND r.base_crystals>0 ON CONFLICT DO NOTHING;
INSERT INTO guild_bastion_credits(guild_id,metric,reference,amount,created_at)
SELECT m.guild_id,'tower_crystals',r.run_id::text||':'||r.character_id::text||':bonus',r.bonus_crystals,r.rolled_at
FROM tower_claims r JOIN player_guild_members m ON m.character_id=r.character_id
WHERE r.rolled_at>=m.joined_at AND r.bonus_crystals>0 ON CONFLICT DO NOTHING;

CREATE TABLE guild_bastion_custom_progress (
  guild_id uuid NOT NULL REFERENCES player_guilds(id) ON DELETE CASCADE,
  key text NOT NULL CHECK(key ~ '^[a-z][a-z0-9_]{1,59}$'),
  value bigint NOT NULL CHECK(value>=0 AND value<=1000000000),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  PRIMARY KEY(guild_id,key)
);
CREATE TABLE guild_bastion_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id uuid REFERENCES player_guilds(id) ON DELETE SET NULL,
  user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  kind text NOT NULL,
  reference text NOT NULL,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
