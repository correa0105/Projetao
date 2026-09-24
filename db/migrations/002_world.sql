CREATE TABLE characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name varchar(60) NOT NULL, race varchar(30) NOT NULL, class varchar(30) NOT NULL,
  level smallint NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 20),
  background varchar(40) NOT NULL DEFAULT 'Aventureiro', biography varchar(2000) NOT NULL DEFAULT '',
  stats jsonb NOT NULL DEFAULT '[15,14,13,12,10,8]',
  hp smallint NOT NULL CHECK (hp > 0), armor_class smallint NOT NULL DEFAULT 12,
  gold_cp integer NOT NULL DEFAULT 15000 CHECK (gold_cp >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX characters_user_idx ON characters(user_id);
CREATE TABLE catalog_items (
  id text PRIMARY KEY, name text NOT NULL, original_name text NOT NULL,
  category text NOT NULL, description text NOT NULL, price_cp integer NOT NULL CHECK (price_cp > 0),
  weight_lb numeric(8,2) NOT NULL DEFAULT 0 CHECK (weight_lb >= 0),
  source text NOT NULL, source_url text NOT NULL, raw_data jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE inventory (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES catalog_items(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (character_id, item_id)
);
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES catalog_items(id), quantity integer NOT NULL CHECK (quantity > 0),
  total_cp integer NOT NULL CHECK (total_cp > 0), idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (character_id, idempotency_key)
);
CREATE INDEX purchases_character_idx ON purchases(character_id, created_at DESC);
CREATE TABLE board_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_id text REFERENCES "user"(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('mission','event','hook')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','active','completed','closed')),
  title varchar(100) NOT NULL, description varchar(3000) NOT NULL,
  location varchar(100) NOT NULL, difficulty text NOT NULL CHECK (difficulty IN ('Tranquila','Moderada','Perigosa')),
  reward_cp integer NOT NULL DEFAULT 0 CHECK (reward_cp >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz
);
CREATE INDEX board_feed_idx ON board_posts(status, kind, created_at DESC);
CREATE TABLE mission_participants (
  post_id uuid NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (post_id, character_id)
);
CREATE TABLE achievements (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code IN ('first_character','first_purchase','first_mission')),
  unlocked_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (character_id, code)
);
CREATE TABLE world_entries (
  id text PRIMARY KEY, section text NOT NULL CHECK (section IN ('world','lore','rules','house','mercenaries')),
  title text NOT NULL, subtitle text NOT NULL, body text NOT NULL, tag text NOT NULL
);
