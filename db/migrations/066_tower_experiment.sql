CREATE TABLE tower_expeditions (
 id uuid PRIMARY KEY, master_id text REFERENCES "user"(id) ON DELETE SET NULL,
 name varchar(80) NOT NULL, status text NOT NULL DEFAULT 'preparing' CHECK(status IN ('preparing','active','completed','cancelled')),
 cleared_floor integer NOT NULL DEFAULT 0 CHECK(cleared_floor BETWEEN 0 AND 30),
 bosses jsonb NOT NULL DEFAULT '[]'::jsonb, revision integer NOT NULL DEFAULT 0,
 summary varchar(1500) NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE INDEX tower_expeditions_created_idx ON tower_expeditions(created_at DESC);
CREATE TABLE tower_members (
 run_id uuid NOT NULL REFERENCES tower_expeditions(id) ON DELETE CASCADE,
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 PRIMARY KEY(run_id,character_id)
);
CREATE INDEX tower_members_character_idx ON tower_members(character_id);
CREATE TABLE tower_wallets (
 character_id uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
 crystals integer NOT NULL DEFAULT 0 CHECK(crystals >= 0)
);
CREATE TABLE tower_claims (
 run_id uuid NOT NULL, character_id uuid NOT NULL,
 floor integer NOT NULL CHECK(floor BETWEEN 1 AND 30), tier integer NOT NULL CHECK(tier BETWEEN 0 AND 6),
 base_gold_cp integer NOT NULL CHECK(base_gold_cp>=0), base_crystals integer NOT NULL CHECK(base_crystals>=0),
 roll integer CHECK(roll BETWEEN 1 AND 100), rarity text, relic text,
 bonus_gold_cp integer NOT NULL DEFAULT 0 CHECK(bonus_gold_cp>=0), bonus_crystals integer NOT NULL DEFAULT 0 CHECK(bonus_crystals>=0),
 created_at timestamptz NOT NULL DEFAULT now(), rolled_at timestamptz,
 PRIMARY KEY(run_id,character_id),
 FOREIGN KEY(run_id,character_id) REFERENCES tower_members(run_id,character_id) ON DELETE CASCADE,
 CHECK((roll IS NULL AND rolled_at IS NULL AND rarity IS NULL AND relic IS NULL) OR (roll IS NOT NULL AND rolled_at IS NOT NULL AND rarity IS NOT NULL AND relic IS NOT NULL))
);
