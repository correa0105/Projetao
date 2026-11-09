CREATE TABLE prestige_retirement_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  rewards integer[] CHECK (cardinality(rewards)=20 AND array_position(rewards,NULL) IS NULL),
  revision integer NOT NULL DEFAULT 0,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL
);
INSERT INTO prestige_retirement_settings(singleton) VALUES (true);

CREATE TABLE prestige_wallets (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  points integer NOT NULL CHECK(points>=0)
);
ALTER TABLE characters ADD COLUMN retirement_cycle integer NOT NULL DEFAULT 0 CHECK(retirement_cycle>=0);
ALTER TABLE character_sheets ADD COLUMN retirement_rebuild boolean NOT NULL DEFAULT false;
CREATE TABLE character_retirements (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  cycle integer NOT NULL CHECK(cycle>=0),
  request_id uuid NOT NULL,
  request jsonb NOT NULL,
  mode text NOT NULL CHECK(mode IN ('restart','permanent')),
  name text NOT NULL,
  level integer NOT NULL CHECK(level BETWEEN 5 AND 20),
  previous_class text NOT NULL,
  previous_sheet jsonb,
  points integer NOT NULL CHECK(points>=0),
  reward_revision integer NOT NULL,
  retired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(character_id,cycle),
  UNIQUE(user_id,request_id)
);
CREATE INDEX character_retirements_user ON character_retirements(user_id,retired_at DESC);

ALTER TABLE player_guilds
  ADD COLUMN prestige_points integer NOT NULL DEFAULT 0 CHECK(prestige_points>=0),
  ADD COLUMN tower_crystals integer NOT NULL DEFAULT 0 CHECK(tower_crystals>=0);

CREATE TABLE guild_special_contributions (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  guild_id uuid REFERENCES player_guilds(id) ON DELETE SET NULL,
  character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
  currency text NOT NULL CHECK(currency IN ('prestige','crystals')),
  amount integer NOT NULL CHECK(amount>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,request_id)
);

CREATE TABLE special_shop_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL CHECK(currency IN ('prestige','crystals')),
  category text NOT NULL CHECK(
    (currency='prestige' AND category IN ('profile_border','weapon_skin','mount','pet'))
    OR (currency='crystals' AND category='tower_item')),
  name varchar(100) NOT NULL,
  description varchar(2000) NOT NULL,
  image_path varchar(250),
  target_key varchar(120),
  price integer NOT NULL CHECK(price BETWEEN 1 AND 1000000),
  active boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL
);
CREATE TABLE special_shop_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  character_id uuid REFERENCES characters(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES special_shop_offers(id),
  currency text NOT NULL CHECK(currency IN ('prestige','crystals')),
  price integer NOT NULL CHECK(price>0),
  snapshot jsonb NOT NULL,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,request_id),
  CHECK((currency='crystals' OR snapshot->>'category' IN ('mount','pet'))=(character_id IS NOT NULL))
);
CREATE UNIQUE INDEX special_shop_prestige_entitlement ON special_shop_purchases(user_id,offer_id)
  WHERE currency='prestige';

CREATE TABLE tower_expedition_rooms (
  run_id uuid PRIMARY KEY REFERENCES tower_expeditions(id) ON DELETE CASCADE,
  room_id uuid NOT NULL UNIQUE REFERENCES vtt_rooms(id) ON DELETE CASCADE
);
CREATE TABLE tower_shop_uses (
  purchase_id uuid PRIMARY KEY REFERENCES special_shop_purchases(id) ON DELETE CASCADE,
  room_id uuid REFERENCES vtt_rooms(id) ON DELETE SET NULL,
  run_id uuid REFERENCES tower_expeditions(id) ON DELETE SET NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE prestige_profile_borders (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES special_shop_purchases(id) ON DELETE CASCADE
);

CREATE TABLE prestige_weapon_skins (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES catalog_items(id),
  purchase_id uuid NOT NULL REFERENCES special_shop_purchases(id) ON DELETE CASCADE,
  PRIMARY KEY(character_id,item_id)
);

ALTER TABLE character_mounts ADD COLUMN prestige_art text;
ALTER TABLE character_pets ADD COLUMN prestige_art text;
ALTER TABLE character_mounts DROP CONSTRAINT character_mounts_price_cp_check;
ALTER TABLE character_mounts ADD CHECK(price_cp>0 OR (price_cp=0 AND prestige_art IS NOT NULL));
