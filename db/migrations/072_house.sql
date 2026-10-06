CREATE TABLE house_homes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), character_id uuid NOT NULL UNIQUE REFERENCES characters(id),
 name text NOT NULL, revision integer NOT NULL DEFAULT 0, rooms jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE house_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), character_id uuid NOT NULL REFERENCES characters(id),
 catalog_id text NOT NULL, content jsonb NOT NULL DEFAULT '{}', image bytea,
 source text NOT NULL, sender_id text REFERENCES "user"(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX house_items_character_idx ON house_items(character_id);
CREATE TABLE house_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), character_id uuid NOT NULL REFERENCES characters(id),
 idempotency_key uuid NOT NULL, request jsonb NOT NULL, total_cp integer NOT NULL CHECK(total_cp>=0),
 item_id uuid NOT NULL REFERENCES house_items(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(character_id,idempotency_key)
);
CREATE TABLE house_invites (
 home_id uuid NOT NULL REFERENCES house_homes(id), user_id text NOT NULL REFERENCES "user"(id),
 status text NOT NULL CHECK(status IN('pending','accepted','declined','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(home_id,user_id)
);
CREATE TABLE house_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), home_id uuid NOT NULL REFERENCES house_homes(id),
 user_id text NOT NULL REFERENCES "user"(id), character_id uuid NOT NULL REFERENCES characters(id),
 body text NOT NULL, idempotency_key uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(home_id,user_id,idempotency_key)
);
CREATE INDEX house_messages_home_idx ON house_messages(home_id,created_at,id);
CREATE TABLE house_variants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), character_id uuid NOT NULL REFERENCES characters(id),
 name text NOT NULL, image bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE house_presence (
 home_id uuid NOT NULL REFERENCES house_homes(id), user_id text NOT NULL REFERENCES "user"(id),
 character_id uuid NOT NULL REFERENCES characters(id), variant_id uuid REFERENCES house_variants(id),
 room text NOT NULL, x real NOT NULL, y real NOT NULL, scale real NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(home_id,user_id)
);
CREATE TABLE house_reward_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), catalog_id text NOT NULL,
 mission_id uuid REFERENCES board_posts(id), achievement_code text, mission_count integer,
 active boolean NOT NULL DEFAULT true, created_by text NOT NULL REFERENCES "user"(id),
 CHECK(num_nonnulls(mission_id,achievement_code,mission_count)=1),
 CHECK(mission_count IS NULL OR mission_count>0)
);
CREATE TABLE house_reward_grants (
 character_id uuid NOT NULL REFERENCES characters(id), rule_id uuid NOT NULL REFERENCES house_reward_rules(id),
 item_id uuid NOT NULL REFERENCES house_items(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(character_id,rule_id)
);
CREATE TABLE house_gift_audit (
 item_id uuid PRIMARY KEY REFERENCES house_items(id), from_character uuid NOT NULL REFERENCES characters(id),
 to_character uuid NOT NULL REFERENCES characters(id), sent_by text NOT NULL REFERENCES "user"(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE house_admin_grants (
 granted_by text NOT NULL REFERENCES "user"(id),idempotency_key uuid NOT NULL,
 character_id uuid NOT NULL REFERENCES characters(id),catalog_id text NOT NULL,reason text NOT NULL,
 item_id uuid NOT NULL REFERENCES house_items(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(granted_by,idempotency_key)
);
