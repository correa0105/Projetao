ALTER TABLE vtt_members ADD COLUMN role text NOT NULL DEFAULT 'player' CHECK (role IN ('player','spectator'));
ALTER TABLE vtt_members ADD COLUMN viewing_user_id text REFERENCES "user"(id) ON DELETE SET NULL;
