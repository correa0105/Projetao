CREATE TABLE vtt_rooms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL REFERENCES "user"(id),
 invite text NOT NULL UNIQUE, document jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vtt_rooms_owner ON vtt_rooms(owner_id);
CREATE TABLE vtt_members (room_id uuid NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, PRIMARY KEY(room_id,user_id));
CREATE TABLE vtt_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE,
 name text NOT NULL, kind text NOT NULL CHECK(kind IN('image','audio')), mime text NOT NULL,
 bytes bytea NOT NULL, width integer, height integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vtt_assets_room ON vtt_assets(room_id);
CREATE TABLE vtt_messages (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, room_id uuid NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE,
 author_id text NOT NULL REFERENCES "user"(id), author text NOT NULL, text text NOT NULL DEFAULT '',
 roll jsonb, private boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vtt_messages_room ON vtt_messages(room_id,id DESC);
