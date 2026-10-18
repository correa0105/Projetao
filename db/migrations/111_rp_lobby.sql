CREATE TABLE rp_rooms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text UNIQUE,
 name text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('fixed','temporary')),
 owner_id text REFERENCES "user"(id) ON DELETE CASCADE,
 character_id uuid REFERENCES characters(id),
 document jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 0,
 expires_at timestamptz,
 closed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='fixed' AND owner_id IS NULL AND expires_at IS NULL) OR (kind='temporary' AND owner_id IS NOT NULL AND character_id IS NOT NULL AND expires_at IS NOT NULL))
);
CREATE UNIQUE INDEX rp_one_open_room_per_owner ON rp_rooms(owner_id) WHERE kind='temporary' AND closed_at IS NULL;
CREATE TABLE rp_room_invites (
 room_id uuid NOT NULL REFERENCES rp_rooms(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
 can_edit boolean NOT NULL DEFAULT false,
 PRIMARY KEY(room_id,user_id)
);
CREATE TABLE rp_room_presence (
 room_id uuid NOT NULL REFERENCES rp_rooms(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 x real NOT NULL DEFAULT 0.5 CHECK(x BETWEEN 0.03 AND 0.97),
 y real NOT NULL DEFAULT 0.84 CHECK(y BETWEEN 0.4 AND 0.98),
 scale real NOT NULL DEFAULT 0.16 CHECK(scale BETWEEN 0.06 AND 0.35),
 flip_x boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(room_id,user_id)
);
CREATE TABLE rp_room_messages (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 room_id uuid NOT NULL REFERENCES rp_rooms(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id),
 character_id uuid NOT NULL REFERENCES characters(id),
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 2000),
 request_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(room_id,user_id,request_id)
);
CREATE INDEX rp_message_recent ON rp_room_messages(room_id,id DESC);
INSERT INTO rp_rooms(slug,name,kind,document) VALUES
 ('beach','Praia do Porto','fixed','{"scene":"beach","placements":[]}'),
 ('market','Mercado da Cidade','fixed','{"scene":"market","placements":[]}'),
 ('plaza','Praça da Fonte','fixed','{"scene":"plaza","placements":[]}'),
 ('tavern','Taverna da Lareira','fixed','{"scene":"tavern","placements":[]}');
