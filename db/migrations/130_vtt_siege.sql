-- Authoritative ammunition, loading and actions stay outside client-saved map JSON.
CREATE TABLE vtt_siege_weapons (
 room_id uuid NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE,
 token_id uuid NOT NULL,
 scene_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('cannon','harpoon')),
 stage text NOT NULL DEFAULT 'empty' CHECK(stage IN('empty','loaded','aimed')),
 ammunition integer NOT NULL DEFAULT 10 CHECK(ammunition BETWEEN 0 AND 9999),
 revision integer NOT NULL DEFAULT 0,
 aim jsonb,
 last_shot jsonb,
 muted boolean NOT NULL DEFAULT false,
 PRIMARY KEY(room_id,token_id)
);
CREATE TABLE vtt_siege_turns (
 room_id uuid PRIMARY KEY REFERENCES vtt_rooms(id) ON DELETE CASCADE,
 turn_id uuid NOT NULL DEFAULT gen_random_uuid(),
 actor_id uuid,
 round integer NOT NULL DEFAULT 1
);
CREATE TABLE vtt_siege_actions (
 room_id uuid NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE,
 turn_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 used integer NOT NULL DEFAULT 0 CHECK(used>=0),
 budget integer NOT NULL DEFAULT 1 CHECK(budget BETWEEN 1 AND 10),
 PRIMARY KEY(room_id,turn_id,actor_id)
);
CREATE TABLE vtt_siege_commands (
 room_id uuid NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE,
 operation_id uuid NOT NULL,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 request_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(room_id,operation_id)
);
